// Submete as variantes de disparo à Meta para aprovação.
//
// Rodar:  npx tsx scripts/criar-template.ts            (as três)
//         npx tsx scripts/criar-template.ts mkt_rtv_trial_01   (só uma)
//
// Os rascunhos vêm de `src/lib/bot/roteiro.ts`, fonte única: o título do botão
// aparece no template aprovado E no payload que a fila manda, e duas fontes
// divergem em silêncio. `validarTemplate` roda antes de gastar cada chamada.
//
// NÃO PARA NA PRIMEIRA RECUSA. Uma variante recusada não pode impedir as outras
// duas de serem submetidas — cada aprovação é uma espera própria da Meta, e
// serializar as esperas por causa de uma recusa custa dias.
//
// NÃO usa `src/server/meta/client.ts`: aquele módulo é `server-only` e não
// carrega fora do Next.
import './env'
import { TEMPLATES_RTV } from '../src/lib/bot/roteiro'
import { validarTemplate } from '../src/lib/templates'

const token = process.env.WHATSAPP_ACCESS_TOKEN
const waba = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
const versao = process.env.GRAPH_API_VERSION || 'v21.0'

if (!token || !waba) {
  console.error('WHATSAPP_ACCESS_TOKEN e WHATSAPP_BUSINESS_ACCOUNT_ID são obrigatórias.')
  process.exit(1)
}

const pedido = process.argv[2]
const nomes = pedido ? [pedido] : Object.keys(TEMPLATES_RTV)

for (const nome of nomes) {
  if (!(nome in TEMPLATES_RTV)) {
    console.error(`"${nome}" não está em TEMPLATES_RTV. Disponíveis:`)
    for (const n of Object.keys(TEMPLATES_RTV)) console.error(`  ${n}`)
    process.exit(1)
  }
}

type Rascunho = (typeof TEMPLATES_RTV)[keyof typeof TEMPLATES_RTV]

function corpoDoPost(t: Rascunho): Record<string, unknown> {
  return {
    name: t.nome,
    language: t.idioma,
    category: t.categoria,
    components: [
      { type: 'BODY', text: t.corpo, example: { body_text: [t.exemplos] } },
      {
        type: 'BUTTONS',
        buttons: t.botoes.map((b) => ({ type: 'QUICK_REPLY', text: b.texto })),
      },
    ],
  }
}

async function submeter(t: Rascunho): Promise<boolean> {
  console.log('')
  console.log(`── ${t.nome} (${t.categoria}, ${t.idioma})`)
  console.log('')
  console.log(t.corpo)
  console.log('')
  console.log(t.botoes.map((b) => `[ ${b.texto} ]`).join(' '))
  console.log('')

  const erros = validarTemplate(t)
  if (erros.length > 0) {
    console.error('  Não passa na validação local, nem foi submetido:')
    for (const e of erros) console.error(`    ${e}`)
    return false
  }

  const resp = await fetch(`https://graph.facebook.com/${versao}/${waba!}/message_templates`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token!}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpoDoPost(t)),
  })
  const texto = await resp.text()

  if (!resp.ok) {
    console.error(`  A Meta recusou (${resp.status}):`)
    console.error(`  ${texto}`)
    return false
  }

  console.log(`  Submetido. ${texto}`)
  return true
}

async function main(): Promise<void> {
  let ok = 0
  for (const nome of nomes) {
    const sucesso = await submeter(TEMPLATES_RTV[nome as keyof typeof TEMPLATES_RTV])
    if (sucesso) ok += 1
  }

  console.log('')
  console.log(`Submetidas: ${ok} de ${nomes.length}`)
  console.log('A aprovação leva de minutos a alguns dias, e cada uma corre sozinha.')
  console.log('')

  // Sai com erro quando alguma não entrou, para o passo não parecer bem-sucedido
  // num script rodado dentro de outro.
  if (ok < nomes.length) process.exit(1)
}

void main()
