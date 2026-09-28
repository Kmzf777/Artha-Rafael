// src/app/api/webhook/route.ts
// Spec §6.1 e §6.2. Ordem obrigatória: assinatura → grava cru → responde 200
// → processa. A Meta re-entrega se demorarmos mais que ~5s, e re-entrega gera
// duplicata — por isso a idempotência por wamid.
import { after, NextResponse } from 'next/server'
import { ID_OPTOUT } from '@/lib/bot/roteiro'
import { parseWebhook } from '@/lib/webhookParse'
import { executarBot } from '@/server/bot/executar'
import { tentarReset } from '@/server/bot/reset'
import { env } from '@/server/env'
import { assinaturaConfere } from '@/server/meta/assinatura'
import { acharOuCriarLeadPorTelefone, marcarOptout } from '@/server/repo/leads'
import { aplicarStatus, inserirMensagem } from '@/server/repo/mensagens'
import { arquivarMidia } from '@/server/repo/midia'
import { db } from '@/server/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Verificação da Meta: devolve hub.challenge como TEXTO PURO, não JSON. */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams
  if (p.get('hub.mode') === 'subscribe' && p.get('hub.verify_token') === env.verifyToken) {
    return new Response(p.get('hub.challenge') ?? '', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }
  return new Response('forbidden', { status: 403 })
}

export async function POST(req: Request) {
  // Corpo CRU: o HMAC é sobre os bytes exatos. `req.json()` reserializa e a
  // assinatura deixa de bater.
  const cru = await req.text()

  if (!assinaturaConfere(cru, req.headers.get('x-hub-signature-256'), env.appSecret)) {
    return NextResponse.json({ erro: 'assinatura inválida' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(cru)
  } catch {
    return NextResponse.json({ erro: 'json inválido' }, { status: 400 })
  }

  // O payload cru é persistido ANTES de responder: se não conseguirmos gravar,
  // é melhor a Meta re-entregar do que perder a mensagem do lead.
  const { data: evento, error: erroEvento } = await db()
    .from('webhook_events').insert({ payload }).select('id').single()

  if (erroEvento || !evento) {
    console.error('[webhook] não consegui gravar o evento cru', erroEvento)
    return NextResponse.json({ erro: 'falha ao registrar evento' }, { status: 500 })
  }

  // Processa DEPOIS da resposta. A Meta re-entrega se demorarmos mais que ~5s,
  // e re-entrega em rajada de callbacks de status (612 leads) viraria loop.
  // `after` do Next 16 roda o trabalho fora do caminho da resposta.
  after(async () => {
    try {
      await processar(payload)
      await db().from('webhook_events')
        .update({ processado_em: new Date().toISOString() }).eq('id', evento.id)
    } catch (e) {
      // Não relança: o payload está salvo e pode ser reprocessado. O log é o
      // que impede o erro de sumir.
      console.error('[webhook] falha ao processar', evento.id, e)
      await db().from('webhook_events')
        .update({ erro: e instanceof Error ? e.message : String(e) }).eq('id', evento.id)
    }
  })

  return NextResponse.json({ ok: true })
}

async function processar(payload: unknown): Promise<void> {
  const { mensagens, statuses } = parseWebhook(payload)

  for (const m of mensagens) {
    const lead = m.phone ? await acharOuCriarLeadPorTelefone(m.phone, m.contact_name) : null
    await inserirMensagem({
      message_id: m.message_id,
      lead_id: lead?.id ?? null,
      phone: m.phone,
      phone_id: m.phone_id,
      bsuid: null,
      contact_name: m.contact_name,
      message_type: m.message_type,
      content: m.content,
      direction: 'inbound',
      created_at: m.created_at,
      raw_payload: null,
      media_id: m.media_id,
      media_mime_type: m.media_mime_type,
      media_storage_path: null,
      reply_to_message_id: m.reply_to_message_id,
      button_id: m.button_id,
    })
    if (m.media_id) await arquivarMidia(m.media_id, m.media_mime_type)
    if (lead) {
      await db().from('leads')
        .update({ ultima_interacao_em: m.created_at }).eq('id', lead.id)
    }

    // OPT-OUT INDEPENDE DO BOT. Spec 2026-09-26 §5.4, corrigida em 2026-09-28.
    //
    // `executarBot` desiste antes de gravar em três caminhos, e o mais provável
    // é o primeiro: operador que já falou desliga o bot para sempre naquela
    // conversa. É justamente quem já falou com o atendimento que tem mais
    // motivo para pedir para sair — e era esse lead que apertava o botão,
    // ouvia silêncio e voltava para a campanha seguinte.
    //
    // Fica FORA do try/catch do bot de propósito: se esta escrita falhar, o
    // banco está inacessível e o `inserirMensagem` acima já teria estourado.
    // As duas falham juntas ou passam juntas.
    if (lead && m.button_id === ID_OPTOUT) await marcarOptout(lead.id)

    // Bot de qualificação. Isolado no seu próprio try/catch: uma falha aqui não
    // pode impedir a marcação do evento como processado nem derrubar o
    // tratamento das outras mensagens do mesmo payload.
    try {
      // `!reset` vem antes: ele apaga o histórico que o bot leria, então rodar
      // os dois na mesma mensagem faria o bot decidir sobre uma conversa que
      // deixou de existir no meio do caminho.
      const resetou = await tentarReset({ phone: m.phone, phoneId: m.phone_id }, m.content)
      if (!resetou) {
        await executarBot({
          messageId: m.message_id,
          phone: m.phone,
          phoneId: m.phone_id,
          leadId: lead?.id ?? null,
        })
      }
    } catch (e) {
      console.error('[bot] falha ao executar', m.message_id, e)
    }
  }

  // SEQUENCIAL de propósito, não `Promise.all`: dois callbacks de status do
  // mesmo wamid no mesmo payload em paralelo abrem corrida. Ver critério 5.
  for (const s of statuses) await aplicarStatus(s.message_id, s.status)
}
