// Store em memória da demo (spec §4.4). Faz o papel do banco: os hooks leem
// daqui no `queryFn` e escrevem aqui na mutação. Trocar por Supabase depois é
// cirurgia de `queryFn`, não reescrita.
//
// Duas formas de dado convivem, de propósito:
//   · DOMÍNIO  (`src/mock/types.ts`)          — Lead, Conversa, Message…
//   · FIO      (`src/lib/conversationTypes.ts`) — Conversation, Message snake_case
// O fio é o que os módulos puros preservados (`timeline`, `listaConversas`,
// `janela24h`, `conversationKey`, `conversationFilter`) já sabem consumir, e é
// o que a tela de Conversas recebe. A tradução está toda neste arquivo.

// Imports relativos (e não `@/lib/...`) de propósito: `vitest.config.ts` não
// declara o alias `@`, e este módulo precisa carregar sob o test runner.
import { conversationKey } from '../lib/conversationKey'
import type { Conversation, Message as MensagemFio } from '../lib/conversationTypes'
import {
  AGENDAMENTOS,
  ANCORA,
  CAMPANHAS,
  CONVERSAS,
  LEADS,
  MENSAGENS,
  QUICK_REPLIES,
  TEMPLATES,
  WABA_PHONE_ID,
} from './db'
import type {
  Agendamento,
  Campanha,
  Conversa,
  DeliveryStatus,
  FunnelStage,
  Lead,
  Message,
  QuickReply,
  Segmento,
  Template,
} from './types'

/** Linha de mensagem como a tela consome: forma de fio + status de entrega. */
export type MensagemUI = MensagemFio & { status: DeliveryStatus | null }

/**
 * Dados que só existem na forma de fio (a mensagem citada e o mime da mídia).
 * Ficam fora de `Message` porque o contrato da spec §4.1 não os prevê, e
 * inventar campo no contrato é pior do que carregar um mapa lateral.
 */
type Extra = { respondeA: string | null; mime: string | null }

type Estado = {
  leads: Lead[]
  conversas: Conversa[]
  mensagens: Message[]
  campanhas: Campanha[]
  agendamentos: Agendamento[]
  extras: Map<string, Extra>
}

function estadoInicial(): Estado {
  return {
    leads: LEADS.map((l) => ({ ...l, tags: [...l.tags] })),
    conversas: CONVERSAS.map((c) => ({ ...c })),
    mensagens: MENSAGENS.map((m) => ({ ...m })),
    campanhas: CAMPANHAS.map((c) => ({ ...c })),
    agendamentos: AGENDAMENTOS.map((a) => ({ ...a })),
    extras: new Map(),
  }
}

let estado: Estado = estadoInicial()

/**
 * Sequência de instantes para o que é criado DURANTE a demo. Continua a partir
 * da âncora em passos fixos: sem `Date.now()`, e cada envio novo cai depois do
 * anterior na timeline.
 */
let sequencia = 0
function proximoInstante(): string {
  sequencia += 1
  return new Date(ANCORA.getTime() + sequencia * 37_000).toISOString()
}

/** Zera o store. Só para teste — a UI nunca chama. */
export function resetStore(): void {
  estado = estadoInicial()
  sequencia = 0
}

// ---------------------------------------------------------------------------
// Leitura — domínio
// ---------------------------------------------------------------------------

export function listarLeads(): Lead[] {
  return estado.leads
}

export function buscarLead(id: string): Lead | null {
  return estado.leads.find((l) => l.id === id) ?? null
}

export function buscarLeadPorTelefone(telefone: string | null): Lead | null {
  if (!telefone) return null
  return estado.leads.find((l) => l.telefone === telefone) ?? null
}

export function listarConversas(): Conversa[] {
  return estado.conversas
}

export function listarMensagens(): Message[] {
  return estado.mensagens
}

export function listarCampanhas(): Campanha[] {
  return estado.campanhas
}

export function listarAgendamentos(): Agendamento[] {
  return estado.agendamentos
}

export function listarTemplates(): Template[] {
  return TEMPLATES
}

export function listarQuickReplies(): QuickReply[] {
  return QUICK_REPLIES
}

// ---------------------------------------------------------------------------
// Tradução domínio → fio
// ---------------------------------------------------------------------------

/** Chave do card de conversa de um telefone, na instância única da Artha. */
export function chaveDaConversa(telefone: string): string {
  return conversationKey({ bsuid: null, phone: telefone, phone_id: WABA_PHONE_ID })!
}

const MIME_POR_TIPO: Record<string, string | null> = {
  image: 'image/jpeg',
  audio: 'audio/ogg',
  document: 'application/pdf',
}

function paraFio(msg: Message, lead: Lead): MensagemUI {
  const extra = estado.extras.get(msg.id)
  return {
    id: msg.id,
    message_id: msg.id,
    phone: lead.telefone,
    phone_id: WABA_PHONE_ID,
    bsuid: null,
    contact_name: lead.nome,
    message_type: msg.tipo,
    content: msg.conteudo,
    direction: msg.direcao,
    created_at: msg.criadoEm,
    raw_payload: null,
    media_id: null,
    media_mime_type: extra?.mime ?? MIME_POR_TIPO[msg.tipo] ?? null,
    media_storage_path: null,
    reply_to_message_id: extra?.respondeA ?? null,
    status: msg.status ?? null,
  }
}

function paraCard(conversa: Conversa, lead: Lead, ultima: Message | undefined): Conversation {
  return {
    key: chaveDaConversa(lead.telefone),
    phone: lead.telefone,
    phone_id: WABA_PHONE_ID,
    bsuid: null,
    contact_name: lead.nome,
    last_message: ultima?.conteudo ?? null,
    last_message_time: conversa.ultimaMensagemEm,
    last_direction: ultima?.direcao ?? 'outbound',
    last_message_type: ultima?.tipo ?? null,
  }
}

// ---------------------------------------------------------------------------
// Leitura — fio (o que a tela de Conversas recebe)
// ---------------------------------------------------------------------------

/** Espelha o retorno da RPC `listar_conversas`: cards ordenados por recência. */
export function listarCardsDeConversa(): { conversas: Conversation[]; naoLidas: Record<string, number> } {
  const cards: Conversation[] = []
  const naoLidas: Record<string, number> = {}

  for (const conversa of estado.conversas) {
    const lead = buscarLead(conversa.leadId)
    if (!lead) continue
    const doThread = estado.mensagens.filter((m) => m.conversaId === conversa.id)
    const ultima = doThread[doThread.length - 1]
    const card = paraCard(conversa, lead, ultima)
    cards.push(card)
    if (conversa.naoLidas > 0) naoLidas[card.key] = conversa.naoLidas
  }

  cards.sort(
    (a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()
  )
  return { conversas: cards, naoLidas }
}

function conversaPorChave(key: string): Conversa | null {
  for (const conversa of estado.conversas) {
    const lead = buscarLead(conversa.leadId)
    if (lead && chaveDaConversa(lead.telefone) === key) return conversa
  }
  return null
}

/** Thread completa de um card, em ordem cronológica. */
export function mensagensDoCard(key: string): MensagemUI[] {
  const conversa = conversaPorChave(key)
  if (!conversa) return []
  const lead = buscarLead(conversa.leadId)
  if (!lead) return []
  return estado.mensagens
    .filter((m) => m.conversaId === conversa.id)
    .map((m) => paraFio(m, lead))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
}

/** Lead dono de um card. A tela de Conversas mostra segmento, plano e cidade. */
export function leadDoCard(key: string): Lead | null {
  const conversa = conversaPorChave(key)
  return conversa ? buscarLead(conversa.leadId) : null
}

/**
 * Busca global sobre conversas: nome, telefone e conteúdo de mensagem. Espelha
 * a RPC `buscar_conversas`, inclusive o rótulo do porquê do resultado.
 */
export function buscarCardsDeConversa(
  termo: string,
  limite = 40
): { card: Conversation; match_tipo: 'nome' | 'telefone' | 'mensagem' | 'tag'; match_trecho: string | null }[] {
  const q = termo.trim().toLowerCase()
  if (!q) return []
  const digitos = q.replace(/\D/g, '')
  const achados: ReturnType<typeof buscarCardsDeConversa> = []

  for (const conversa of estado.conversas) {
    const lead = buscarLead(conversa.leadId)
    if (!lead) continue
    const doThread = estado.mensagens.filter((m) => m.conversaId === conversa.id)
    const card = paraCard(conversa, lead, doThread[doThread.length - 1])

    if (lead.nome.toLowerCase().includes(q)) {
      achados.push({ card, match_tipo: 'nome', match_trecho: lead.nome })
      continue
    }
    if (digitos.length >= 2 && lead.telefone.includes(digitos)) {
      achados.push({ card, match_tipo: 'telefone', match_trecho: lead.telefone })
      continue
    }
    const naMensagem = doThread.find((m) => m.conteudo.toLowerCase().includes(q))
    if (naMensagem) {
      achados.push({ card, match_tipo: 'mensagem', match_trecho: naMensagem.conteudo })
      continue
    }
    const tag = lead.tags.find((t) => t.toLowerCase().includes(q))
    if (tag) achados.push({ card, match_tipo: 'tag', match_trecho: tag })
  }

  return achados.slice(0, limite)
}

// ---------------------------------------------------------------------------
// Mutação
// ---------------------------------------------------------------------------

/**
 * Grava uma mensagem de saída no card e devolve a linha de fio, para o cache.
 * O status nasce em `enviado`; quem faz progredir para entregue e lido é
 * `useMessageSender` — a demo tem de parecer viva.
 */
export function enviarMensagem(args: {
  key: string
  tipo: Message['tipo']
  conteudo: string
  enviadoPor?: string
  /** Id da mensagem citada, quando a operadora responde a uma bolha específica. */
  respondeA?: string | null
  /** Mime da mídia — separa nota de voz (`audio/ogg; codecs=opus`) de áudio anexado. */
  mime?: string | null
}): MensagemUI | null {
  const conversa = conversaPorChave(args.key)
  if (!conversa) return null
  const lead = buscarLead(conversa.leadId)
  if (!lead) return null

  const criadoEm = proximoInstante()
  const msg: Message = {
    id: `msg_env_${String(sequencia).padStart(3, '0')}`,
    conversaId: conversa.id,
    direcao: 'outbound',
    tipo: args.tipo,
    conteudo: args.conteudo,
    criadoEm,
    status: 'enviado',
    ...(args.enviadoPor ? { enviadoPor: args.enviadoPor } : {}),
  }
  estado.mensagens.push(msg)
  if (args.respondeA || args.mime) {
    estado.extras.set(msg.id, { respondeA: args.respondeA ?? null, mime: args.mime ?? null })
  }
  conversa.ultimaMensagemEm = criadoEm
  lead.ultimaInteracaoEm = criadoEm
  return paraFio(msg, lead)
}

export function atualizarStatusMensagem(id: string, status: DeliveryStatus): void {
  const msg = estado.mensagens.find((m) => m.id === id)
  if (msg && msg.direcao === 'outbound') msg.status = status
}

/** Zera o badge de não lidas do card. Nunca regride: só zera. */
export function marcarCardLido(key: string): void {
  const conversa = conversaPorChave(key)
  if (conversa) conversa.naoLidas = 0
}

export function renomearContato(key: string, nome: string): void {
  const conversa = conversaPorChave(key)
  const lead = conversa ? buscarLead(conversa.leadId) : null
  if (lead) lead.nome = nome
}

export function mudarEtapaLead(leadId: string, stage: FunnelStage): Lead | null {
  const lead = buscarLead(leadId)
  if (!lead) return null
  lead.stage = stage
  return lead
}

/**
 * Enfileira uma campanha: cria a campanha zerada e um agendamento `pendente`
 * por lead, espaçados no tempo — é assim que o número real sai, respeitando o
 * limite de disparo da Meta. É o que a tela de Reativação dispara.
 */
export function enfileirarCampanha(args: {
  nome: string
  template: string
  segmentoAlvo: Segmento | 'todos'
  leadIds: string[]
}): { campanha: Campanha; agendamentos: Agendamento[] } {
  const criadaEm = proximoInstante()
  const seq = estado.campanhas.length + 1
  const campanha: Campanha = {
    id: `camp_${String(seq).padStart(3, '0')}`,
    nome: args.nome,
    template: args.template,
    criadaEm,
    segmentoAlvo: args.segmentoAlvo,
    enviados: 0,
    entregues: 0,
    respondidos: 0,
    qualificados: 0,
    convertidos: 0,
  }
  estado.campanhas.unshift(campanha)

  const base = new Date(criadaEm).getTime() + 5 * 60_000
  const novos: Agendamento[] = args.leadIds.map((leadId, i) => ({
    id: `agd_${campanha.id}_${String(i + 1).padStart(4, '0')}`,
    leadId,
    template: args.template,
    // 45s entre disparos: o mesmo espaçamento que o cron usaria em produção.
    agendadoPara: new Date(base + i * 45_000).toISOString(),
    status: 'pendente',
    tentativas: 0,
    erro: null,
  }))
  estado.agendamentos.unshift(...novos)

  return { campanha, agendamentos: novos }
}

export function cancelarAgendamento(id: string): Agendamento | null {
  const agendamento = estado.agendamentos.find((a) => a.id === id)
  // 'enviando' é ponto de não-retorno: o POST já saiu, cancelar seria mentira.
  if (!agendamento || agendamento.status !== 'pendente') return null
  agendamento.status = 'cancelado'
  return agendamento
}
