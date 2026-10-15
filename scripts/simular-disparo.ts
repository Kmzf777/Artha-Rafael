// Simula o disparo de campanha para UM número com a janela de 24h aberta.
//
// Rodar: npx tsx scripts/simular-disparo.ts <telefone> <nome> [mkt_rtv_isencao_01]
//
// Fora da janela só template aprovado sai. Dentro dela, mensagem com botões sai
// sem template — e com os MESMOS ids `rtv:*` que o payload do template carrega,
// então o webhook roteia o toque pelo funil de campanha exatamente como faria
// num disparo real. Grava com `enviado_por` nulo, igual à fila.
import './env'
import { createClient } from '@supabase/supabase-js'
import { RTV_BOTOES, TEMPLATES_RTV } from '../src/lib/bot/roteiro'
import { telNorm11, toBrazilPhone } from '../src/lib/phoneUtils'

const [telefone, nome = 'tudo bem', template = 'mkt_rtv_isencao_01'] = process.argv.slice(2)
if (!telefone) {
  console.error('Uso: npx tsx scripts/simular-disparo.ts <telefone> [nome] [template]')
  process.exit(1)
}

const modelo = TEMPLATES_RTV[template as keyof typeof TEMPLATES_RTV]
if (!modelo) {
  console.error(`Template desconhecido: ${template}. Opções: ${Object.keys(TEMPLATES_RTV).join(', ')}`)
  process.exit(1)
}

async function main(): Promise<void> {
  const corpo = modelo.corpo.replace('{{1}}', nome)
  const versao = process.env.GRAPH_API_VERSION || 'v21.0'
  const resp = await fetch(
    `https://graph.facebook.com/${versao}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toBrazilPhone(telefone),
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: corpo },
          action: {
            buttons: RTV_BOTOES.map((b) => ({ type: 'reply', reply: { id: b.id, title: b.titulo } })),
          },
        },
      }),
    }
  )
  const json = (await resp.json()) as { messages?: { id: string }[]; error?: { message: string } }
  if (!resp.ok) throw new Error(`Meta recusou: ${json.error?.message ?? resp.status}`)

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  // Sem `campanha_id`, saída sem autor é lida como resposta HUMANA
  // (`ehDeHumano` em estado.ts) e o bot cala para sempre na conversa.
  const { data: campanha, error: erroCampanha } = await db
    .from('campanhas')
    .insert({ nome: `Simulação ${template}`, template, criada_por: 'simular-disparo' })
    .select('id')
    .single()
  if (erroCampanha) throw new Error(`Não criou a campanha: ${erroCampanha.message}`)

  const tel = telNorm11(telefone) ?? telefone
  const { data: lead } = await db.from('leads').select('id').eq('tel_norm', tel).maybeSingle()
  const { error } = await db.from('messages').insert({
    message_id: json.messages?.[0]?.id ?? null,
    lead_id: lead?.id ?? null,
    phone: tel,
    phone_id: process.env.WHATSAPP_PHONE_NUMBER_ID,
    message_type: 'interactive',
    content: corpo,
    direction: 'outbound',
    created_at: new Date().toISOString(),
    enviado_por: null,
    campanha_id: campanha.id,
  })
  if (error) console.error(`Enviada, mas não gravou no painel: ${error.message}`)
  console.log(`Enviada (${template}) para ${telefone}.`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
