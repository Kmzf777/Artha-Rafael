// Submete `mkt_rtv_isencao_01` à Meta para aprovação.
//
// Rodar: npx tsx scripts/criar-template.ts
//
// O rascunho vem de `src/lib/bot/roteiro.ts`, fonte única: o título do botão
// aparece no template aprovado E no payload que a fila manda, e duas fontes
// divergem em silêncio. `validarTemplate` roda antes de gastar a chamada —
// pegar localmente o que a Meta recusaria é o motivo daquele módulo existir.
//
// NÃO usa `src/server/meta/client.ts`: aquele módulo é `server-only` e não
// carrega fora do Next.
import './env'
import { TEMPLATE_RTV } from '../src/lib/bot/roteiro'
import { validarTemplate } from '../src/lib/templates'

const token = process.env.WHATSAPP_ACCESS_TOKEN
const waba = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
const versao = process.env.GRAPH_API_VERSION || 'v21.0'

if (!token || !waba) {
  console.error('WHATSAPP_ACCESS_TOKEN e WHATSAPP_BUSINESS_ACCOUNT_ID são obrigatórias.')
  process.exit(1)
}

const erros = validarTemplate(TEMPLATE_RTV)
if (erros.length > 0) {
  console.error('O rascunho não passa na validação local:')
  for (const e of erros) console.error(`  ${e}`)
  process.exit(1)
}

const corpo = {
  name: TEMPLATE_RTV.nome,
  language: TEMPLATE_RTV.idioma,
  category: TEMPLATE_RTV.categoria,
  components: [
    {
      type: 'BODY',
      text: TEMPLATE_RTV.corpo,
      example: { body_text: [TEMPLATE_RTV.exemplos] },
    },
    {
      type: 'BUTTONS',
      buttons: TEMPLATE_RTV.botoes.map((b) => ({ type: 'QUICK_REPLY', text: b.texto })),
    },
  ],
}

async function main(): Promise<void> {
  console.log('')
  console.log(`Submetendo ${TEMPLATE_RTV.nome} (${TEMPLATE_RTV.categoria}, ${TEMPLATE_RTV.idioma})`)
  console.log('')
  console.log(TEMPLATE_RTV.corpo)
  console.log('')
  console.log(TEMPLATE_RTV.botoes.map((b) => `[ ${b.texto} ]`).join(' '))
  console.log('')

  const resp = await fetch(`https://graph.facebook.com/${versao}/${waba!}/message_templates`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token!}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })
  const texto = await resp.text()

  if (!resp.ok) {
    console.error(`A Meta recusou (${resp.status}):`)
    console.error(texto)
    process.exit(1)
  }

  console.log('Submetido. A aprovação leva de minutos a alguns dias.')
  console.log(texto)
  console.log('')
}

void main()
