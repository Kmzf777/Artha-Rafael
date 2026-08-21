// src/app/api/mensagens/route.ts
// Envio livre. A janela de 24h é decidida NO SERVIDOR: o cliente pode estar com
// cache velho e o botão habilitado. Critério de aceitação 6.
import { NextResponse } from 'next/server'
import { telNorm11, toBrazilPhone } from '@/lib/phoneUtils'
import { enviarTexto, MetaError } from '@/server/meta/client'
import { buscarLeadPorTelefone } from '@/server/repo/leads'
import { inserirMensagem, janelaAberta } from '@/server/repo/mensagens'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { key, telefone, texto, enviadoPor } = (await req.json()) as {
    key: string
    telefone: string
    texto: string
    enviadoPor?: string
  }

  if (!texto?.trim()) return NextResponse.json({ erro: 'texto vazio' }, { status: 400 })
  // `Conversation.phone` é nulável (card só com bsuid): sem este corte, a
  // normalização abaixo estoura em 500 no lugar de recusar com 400.
  if (!telefone?.trim()) return NextResponse.json({ erro: 'telefone ausente' }, { status: 400 })

  // A checagem vem ANTES da Meta de propósito. Invertida, uma conversa paga
  // seria gasta para só depois ser recusada aqui.
  if (!(await janelaAberta(key))) {
    return NextResponse.json(
      { erro: 'janela_fechada', mensagem: 'A janela de 24h fechou. Só template aprovado pode sair.' },
      { status: 409 }
    )
  }

  const [identidade, phoneId] = key.split('::')

  try {
    // A Meta exige o destino COM DDI. A forma canônica que trafega no card tem
    // 11 dígitos e não é destino válido — `toBrazilPhone` repõe o 55 e deixa
    // passar intacto o número que já chega com ele.
    const resposta = await enviarTexto(toBrazilPhone(telefone), texto)
    const wamid = resposta.messages[0]?.id ?? null
    const lead = await buscarLeadPorTelefone(telefone)

    // `enviado_por` é coluna de `messages` (0001_schema.sql) que a forma de fio
    // não tem — e é dela que `inserirMensagem` deriva o tipo do parâmetro. Vai
    // por spread porque propriedade espalhada não passa pelo excess property
    // check do literal. O conserto de verdade é a coluna entrar em
    // `LinhaMensagem`, no repositório — que outro agente está editando agora.
    const autoria = { enviado_por: enviadoPor ?? null }

    await inserirMensagem({
      message_id: wamid,
      lead_id: lead?.id ?? null,
      // MESMA régua do inbound (`telNorm11(from) ?? from`, em parseWebhook): o
      // outbound precisa cair no mesmo card, senão a conversa racha em duas
      // linhas para a mesma pessoa. Para uma identidade que já é canônica isto
      // é idempotente; para bsuid, `telNorm11` devolve null e a identidade
      // segue intacta.
      phone: telNorm11(identidade) ?? identidade,
      phone_id: phoneId || null,
      message_type: 'text',
      content: texto,
      direction: 'outbound',
      created_at: new Date().toISOString(),
      status: 'enviado',
      ...autoria,
    })

    return NextResponse.json({ ok: true, message_id: wamid })
  } catch (e) {
    if (e instanceof MetaError) {
      return NextResponse.json({ erro: 'meta', codigo: e.codigo, detalhe: e.detalhe }, { status: 502 })
    }
    throw e
  }
}
