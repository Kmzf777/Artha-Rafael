// src/app/api/campanhas/route.ts
// Criação de campanha: resolve o recorte pela régua única de `src/lib/regras.ts`
// e enfileira um agendamento por lead. Nada sai daqui — quem fala com a Meta é
// o worker de `/api/fila/processar`. Spec §7.2.
import { NextResponse } from 'next/server'
import {
  ATRASO_PRIMEIRO_ENVIO_MS,
  SEGUNDOS_ENTRE_ENVIOS,
  valorDoCampo,
  type CampoVariavel,
} from '@/lib/disparos'
import { podeDisparar, recorteReativacao, type FiltroRecorte } from '@/lib/regras'
import { criarCampanha, listarCampanhas } from '@/server/repo/campanhas'
import { todosOsLeads } from '@/server/repo/leads'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(await listarCampanhas())
}

export async function POST(req: Request) {
  const { nome, template, filtro, variaveisPorLead } = (await req.json()) as {
    nome?: string
    template?: string
    filtro?: FiltroRecorte
    /** Nomes de campo do lead que preenchem {{1}}, {{2}}… Ex.: ['nome']. */
    variaveisPorLead?: CampoVariavel[]
  }

  if (!nome?.trim()) return NextResponse.json({ erro: 'nome vazio' }, { status: 400 })
  if (!template?.trim()) return NextResponse.json({ erro: 'template vazio' }, { status: 400 })

  const campos = variaveisPorLead ?? []
  const agora = new Date()
  // Lead de semente fica fora do recorte: enfileirar para depois recusar no
  // worker inflaria o total que a tela mostra e faria a campanha parecer maior
  // do que é. A trava do worker continua existindo como segunda camada.
  const reais = (await todosOsLeads()).filter(podeDisparar)
  const leads = recorteReativacao(reais, filtro ?? {}, agora)

  const comVariaveis = leads
    .map((l) => ({ id: l.id, variaveis: campos.map((c) => valorDoCampo(c, l, agora)) }))
    .filter((l) => l.variaveis.every((v) => v !== ''))

  // A fila nasce ESCALONADA: o primeiro sai depois do atraso e cada seguinte
  // `SEGUNDOS_ENTRE_ENVIOS` mais tarde. As constantes vêm de `@/lib/disparos`
  // porque é a mesma régua que a tela anuncia — número solto aqui viraria
  // promessa de tela que o backend não cumpre.
  const inicio = new Date(agora.getTime() + ATRASO_PRIMEIRO_ENVIO_MS).toISOString()

  const r = await criarCampanha({
    nome: nome.trim(),
    template: template.trim(),
    segmentoAlvo: filtro?.segmento ?? 'todos',
    leads: comVariaveis,
    agendadoPara: inicio,
    espacamentoSegundos: SEGUNDOS_ENTRE_ENVIOS,
  })

  // `recorte` é o mesmo total que a tela de Reativação estampa; `enfileirados` é
  // o que de fato entrou na fila. Divergem quando um lead não tem como preencher
  // uma variável, ou quando o unique (campanha_id, lead_id) barra reenfileirar.
  // `primeiroEm` e `espacamentoSegundos` são o horário REAL da fila — a tela de
  // confirmação mostra o que o servidor gravou, não uma estimativa própria.
  return NextResponse.json({
    ...r,
    recorte: leads.length,
    primeiroEm: inicio,
    espacamentoSegundos: SEGUNDOS_ENTRE_ENVIOS,
  })
}
