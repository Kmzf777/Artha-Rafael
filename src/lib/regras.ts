// Regras de negócio da base — a régua única do sistema (spec §5.2).
//
// Regra que sustenta o produto: o total de inativos que o Dashboard mostra e o
// total que a régua da Reativação encontra saem da MESMA função — `ehInativo`.
// Número divergente entre duas telas destrói a credibilidade na frente do
// cliente, e é o defeito mais grave possível neste projeto. Se um dia for
// preciso mudar o critério de "inativo", muda-se aqui, uma vez.
//
// Este módulo é puro: recebe os dados e o instante de referência, não os busca.
// Por isso serve tanto ao servidor (que passa `new Date()` e as linhas do
// Postgres) quanto à demo (que passa a âncora fixa e o dataset fictício).

import { AUTOR_BOT } from '@/lib/bot/roteiro'
import type {
  Agendamento,
  AgendamentoStatus,
  Campanha,
  Conversa,
  FunnelStage,
  Lead,
  Message,
  PlanoStatus,
  Segmento,
} from '@/mock/types'

// ---------------------------------------------------------------------------
// A régua
// ---------------------------------------------------------------------------

/** Faixas de dias sem acesso oferecidas como chip na tela de Reativação. */
export const FAIXAS_SEM_ACESSO = [30, 60, 90, 180] as const
export type FaixaSemAcesso = (typeof FAIXAS_SEM_ACESSO)[number]

/** Piso da régua: abaixo disso o usuário não é considerado inativo. */
export const DIAS_SEM_ACESSO_INATIVO: FaixaSemAcesso = 30

const DIA = 24 * 60 * 60 * 1000

/** Dias desde o último acesso à plataforma. `Infinity` = nunca acessou. */
export function diasSemAcesso(lead: Lead, agora: Date): number {
  if (lead.ultimoAcessoEm === null) return Infinity
  return Math.floor((agora.getTime() - new Date(lead.ultimoAcessoEm).getTime()) / DIA)
}

/** Assinatura em dia. `ativo` e `inativo` particionam a base: um ou o outro. */
export function ehAtivo(lead: Lead): boolean {
  return lead.planoStatus === 'ativo'
}

/** O universo da reativação. É este número que o Dashboard estampa. */
export function ehInativo(lead: Lead): boolean {
  return !ehAtivo(lead)
}

/**
 * A conversa está esperando resposta humana? Última mensagem do lead, ou do
 * bot — porque o bot não atende ninguém, ele entrega. O fecho dele é a
 * promessa de que alguém vai responder, então tirar a conversa da fila ali
 * seria esconder o lead de quem prometeu atender.
 *
 * Régua única: o tile do Dashboard (via `filaAtendimento`), a lista "Fila de
 * atendimento" do Dashboard e o tile de Relatórios não podem divergir sobre
 * quem está na fila. Parâmetros soltos, não um dos dois tipos de mensagem
 * (`Message` do servidor, `Conversation` de fio) — os dois chamam com o que
 * têm à mão.
 */
export function esperandoResposta(
  direcao: 'inbound' | 'outbound',
  enviadoPor: string | null | undefined
): boolean {
  return direcao === 'inbound' || enviadoPor === AUTOR_BOT
}

export type FiltroRecorte = {
  /** Piso de dias sem acesso. Padrão: 30. */
  diasSemAcesso?: FaixaSemAcesso
  planoStatus?: PlanoStatus | 'todos'
  segmento?: Segmento | 'todos'
}

/**
 * O recorte da campanha de reativação — a mesma régua do Dashboard, com os
 * filtros da tela por cima. Sem filtro nenhum devolve exatamente os inativos.
 */
export function recorteReativacao(leads: Lead[], filtro: FiltroRecorte, agora: Date): Lead[] {
  const piso = filtro.diasSemAcesso ?? DIAS_SEM_ACESSO_INATIVO
  const plano = filtro.planoStatus ?? 'todos'
  const segmento = filtro.segmento ?? 'todos'

  return leads.filter((lead) => {
    if (!ehInativo(lead)) return false
    if (diasSemAcesso(lead, agora) < piso) return false
    if (plano !== 'todos' && lead.planoStatus !== plano) return false
    if (segmento !== 'todos' && lead.segmento !== segmento) return false
    return true
  })
}

// ---------------------------------------------------------------------------
// Métricas
// ---------------------------------------------------------------------------

/** Tudo que `getMetrics` precisa ler. Quem chama busca; a regra só calcula. */
export type DadosMetrics = {
  leads: Lead[]
  conversas: Conversa[]
  mensagens: Message[]
  campanhas: Campanha[]
  agendamentos: Agendamento[]
}

export type Metrics = {
  totalLeads: number
  ativos: number
  inativos: number
  porSegmento: Record<Segmento, number>
  porEtapa: Record<FunnelStage, number>
  porPlanoStatus: Record<PlanoStatus, number>
  /** Cumulativo: quantos inativos passam por cada chip da régua. */
  inativosPorFaixa: Record<FaixaSemAcesso, number>
  conversas: {
    total: number
    naoLidas: number
    /**
     * Cards cuja última mensagem é do lead OU do bot — alguém está esperando
     * resposta. O bot entrega, não atende: seu fecho não tira ninguém da fila.
     */
    filaAtendimento: number
    janelaAberta: number
    atribuidas: number
  }
  mensagens: { total: number; enviadas: number; recebidas: number }
  campanhas: {
    total: number
    enviados: number
    entregues: number
    respondidos: number
    qualificados: number
    convertidos: number
    taxaEntrega: number
    taxaResposta: number
    taxaQualificacao: number
    taxaConversao: number
  }
  agendamentos: Record<AgendamentoStatus, number> & { total: number }
  receita: {
    /** Receita recorrente mensal da base ativa, em reais. */
    mrrAtual: number
    /** MRR que voltaria se todos os inativos que já pagaram retornassem. */
    mrrRecuperavel: number
    ticketMedio: number
  }
  churnPorSegmento: Record<Segmento, { total: number; ativos: number; inativos: number; churn: number }>
  /** Últimos 8 meses fechados até o mês da âncora, para o gráfico de série. */
  serieMensal: { mes: string; rotulo: string; ativos: number; inativos: number }[]
}

const SEGMENTOS: Segmento[] = ['artha', 'dhana', 'lucia']
const ETAPAS: FunnelStage[] = ['novo', 'contatado', 'qualificado', 'convertido', 'perdido']
const PLANOS: PlanoStatus[] = ['ativo', 'cancelado', 'trial_expirado', 'inadimplente']
const STATUS_AGENDAMENTO: AgendamentoStatus[] = ['pendente', 'enviando', 'enviado', 'falhou', 'cancelado']

function zeros<K extends string>(chaves: K[]): Record<K, number> {
  return Object.fromEntries(chaves.map((k) => [k, 0])) as Record<K, number>
}

/** Mensalidade equivalente: o plano anual de R$ 997 vale R$ 83,08 por mês. */
function mensalidade(lead: Lead): number {
  if (lead.planoValor === null) return 0
  return lead.planoValor === 997 ? 997 / 12 : lead.planoValor
}

const MESES_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function serieMensal(leads: Lead[], agora: Date): Metrics['serieMensal'] {
  const serie: Metrics['serieMensal'] = []
  for (let voltar = 7; voltar >= 0; voltar--) {
    const inicio = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - voltar, 1))
    const fim = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - voltar + 1, 1))
    // Base do mês: quem já era contato até o fim dele.
    const base = leads.filter((l) => new Date(l.primeiroContatoEm) < fim)
    // Ativo no mês: assinante de hoje, ou quem ainda acessava naquele mês.
    const ativos = base.filter(
      (l) => ehAtivo(l) || (l.ultimoAcessoEm !== null && new Date(l.ultimoAcessoEm) >= inicio)
    ).length
    serie.push({
      mes: inicio.toISOString().slice(0, 7),
      rotulo: `${MESES_PT[inicio.getUTCMonth()]}/${String(inicio.getUTCFullYear()).slice(2)}`,
      ativos,
      inativos: base.length - ativos,
    })
  }
  return serie
}

function taxa(parte: number, todo: number): number {
  return todo === 0 ? 0 : parte / todo
}

export function getMetrics(dados: DadosMetrics, agora: Date): Metrics {
  const { leads, conversas, mensagens, campanhas, agendamentos } = dados

  const porSegmento = zeros(SEGMENTOS)
  const porEtapa = zeros(ETAPAS)
  const porPlanoStatus = zeros(PLANOS)
  const inativosPorFaixa: Record<FaixaSemAcesso, number> = { 30: 0, 60: 0, 90: 0, 180: 0 }
  const churnPorSegmento = Object.fromEntries(
    SEGMENTOS.map((s) => [s, { total: 0, ativos: 0, inativos: 0, churn: 0 }])
  ) as Metrics['churnPorSegmento']

  let ativos = 0
  let mrrAtual = 0
  let mrrRecuperavel = 0

  for (const lead of leads) {
    porSegmento[lead.segmento] += 1
    porEtapa[lead.stage] += 1
    porPlanoStatus[lead.planoStatus] += 1
    churnPorSegmento[lead.segmento].total += 1

    if (ehAtivo(lead)) {
      ativos += 1
      mrrAtual += mensalidade(lead)
      churnPorSegmento[lead.segmento].ativos += 1
    } else {
      mrrRecuperavel += mensalidade(lead)
      churnPorSegmento[lead.segmento].inativos += 1
      const dias = diasSemAcesso(lead, agora)
      for (const faixa of FAIXAS_SEM_ACESSO) if (dias >= faixa) inativosPorFaixa[faixa] += 1
    }
  }

  for (const s of SEGMENTOS) {
    const c = churnPorSegmento[s]
    c.churn = taxa(c.inativos, c.total)
  }

  const ultimaPorConversa = new Map<string, Message>()
  for (const m of mensagens) {
    const atual = ultimaPorConversa.get(m.conversaId)
    if (!atual || new Date(m.criadoEm) > new Date(atual.criadoEm)) ultimaPorConversa.set(m.conversaId, m)
  }

  const totalCampanhas = campanhas.reduce(
    (acc, c) => ({
      enviados: acc.enviados + c.enviados,
      entregues: acc.entregues + c.entregues,
      respondidos: acc.respondidos + c.respondidos,
      qualificados: acc.qualificados + c.qualificados,
      convertidos: acc.convertidos + c.convertidos,
    }),
    { enviados: 0, entregues: 0, respondidos: 0, qualificados: 0, convertidos: 0 }
  )

  const porStatusAgendamento = zeros(STATUS_AGENDAMENTO)
  for (const a of agendamentos) porStatusAgendamento[a.status] += 1

  return {
    totalLeads: leads.length,
    ativos,
    inativos: leads.length - ativos,
    porSegmento,
    porEtapa,
    porPlanoStatus,
    inativosPorFaixa,
    conversas: {
      total: conversas.length,
      naoLidas: conversas.reduce((n, c) => n + c.naoLidas, 0),
      filaAtendimento: conversas.filter((c) => {
        const ultima = ultimaPorConversa.get(c.id)
        return ultima !== undefined && esperandoResposta(ultima.direcao, ultima.enviadoPor)
      }).length,
      janelaAberta: conversas.filter(
        (c) => c.janela24hExpiraEm !== null && new Date(c.janela24hExpiraEm) > agora
      ).length,
      atribuidas: conversas.filter((c) => c.atribuidoA !== null).length,
    },
    mensagens: {
      total: mensagens.length,
      enviadas: mensagens.filter((m) => m.direcao === 'outbound').length,
      recebidas: mensagens.filter((m) => m.direcao === 'inbound').length,
    },
    campanhas: {
      total: campanhas.length,
      ...totalCampanhas,
      taxaEntrega: taxa(totalCampanhas.entregues, totalCampanhas.enviados),
      taxaResposta: taxa(totalCampanhas.respondidos, totalCampanhas.entregues),
      taxaQualificacao: taxa(totalCampanhas.qualificados, totalCampanhas.respondidos),
      taxaConversao: taxa(totalCampanhas.convertidos, totalCampanhas.qualificados),
    },
    agendamentos: { ...porStatusAgendamento, total: agendamentos.length },
    receita: {
      mrrAtual: Math.round(mrrAtual),
      mrrRecuperavel: Math.round(mrrRecuperavel),
      ticketMedio: ativos === 0 ? 0 : Math.round(mrrAtual / ativos),
    },
    churnPorSegmento,
    serieMensal: serieMensal(leads, agora),
  }
}

/**
 * Se este lead pode receber disparo.
 *
 * Existe como regra única porque é a trava mais crítica do sistema: os
 * telefones da semente (`src/mock/db.ts`) são celulares brasileiros
 * estruturalmente válidos, com DDD real de Uberlândia, BH e São Paulo — eles
 * pertencem a pessoas de verdade. Um disparo acidental manda template real
 * para até 760 desconhecidos, junta denúncia por spam e derruba a reputação do
 * número da Artha: a operação inteira morre no primeiro disparo.
 *
 * Chamada em dois pontos de propósito — na montagem do recorte, para a
 * contagem da tela ser honesta, e dentro do worker, imediatamente antes da
 * chamada irreversível à Meta.
 */
export function podeDisparar(lead: Lead): boolean {
  return lead.ficticio !== true
}
