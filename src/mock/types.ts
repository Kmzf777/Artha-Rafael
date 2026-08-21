// Contrato de dados da demo (spec §4.1). Módulo sem dependência: só `type`.
//
// Estes tipos descrevem o DOMÍNIO Artha. As conversas do WhatsApp têm, além
// disto, uma forma "de fio" (snake_case) em `src/lib/conversationTypes.ts`, que
// é a que os módulos puros preservados (`timeline`, `listaConversas`,
// `janela24h`, `conversationKey`) consomem. A tradução entre as duas vive em
// `src/mock/store.ts`.

export type Segmento = 'artha' | 'dhana' | 'lucia'
export type FunnelStage = 'novo' | 'contatado' | 'qualificado' | 'convertido' | 'perdido'
export type PlanoStatus = 'ativo' | 'cancelado' | 'trial_expirado' | 'inadimplente'
export type DeliveryStatus = 'enviado' | 'entregue' | 'lido' | 'falhou'
export type AgendamentoStatus = 'pendente' | 'enviando' | 'enviado' | 'falhou' | 'cancelado'

export type Lead = {
  id: string
  nome: string
  telefone: string
  email: string
  segmento: Segmento
  stage: FunnelStage
  planoStatus: PlanoStatus
  /** 97 (mensal) | 997 (anual) | null (nunca assinou / trial). */
  planoValor: number | null
  /** ISO. `null` = nunca acessou a plataforma. */
  ultimoAcessoEm: string | null
  primeiroContatoEm: string
  ultimaInteracaoEm: string
  cidade: string
  tags: string[]
  notas: string | null
  /**
   * Lead de semente, com telefone fictício. O motor de disparo RECUSA enviar
   * para estes: os números do mock são celulares brasileiros válidos com DDD
   * real, e um disparo acidental viraria spam a desconhecidos.
   */
  ficticio?: boolean
}

export type Message = {
  id: string
  conversaId: string
  direcao: 'inbound' | 'outbound'
  tipo: 'text' | 'template' | 'button' | 'image' | 'audio' | 'document'
  conteudo: string
  criadoEm: string
  /** Só outbound. */
  status?: DeliveryStatus
  /** Nome do humano que enviou; ausente = enviado pela automação. */
  enviadoPor?: string
  campanhaId?: string
}

export type Conversa = {
  id: string
  leadId: string
  ultimaMensagemEm: string
  naoLidas: number
  /** ISO do fim da janela de 24h; `null` quando nunca houve inbound. */
  janela24hExpiraEm: string | null
  atribuidoA: string | null
}

export type Campanha = {
  id: string
  nome: string
  template: string
  criadaEm: string
  segmentoAlvo: Segmento | 'todos'
  enviados: number
  entregues: number
  respondidos: number
  /** Leads que a campanha levou até a etapa `qualificado`. */
  qualificados: number
  /** Assinaturas fechadas atribuídas à campanha. */
  convertidos: number
}

export type Agendamento = {
  id: string
  leadId: string
  template: string
  agendadoPara: string
  status: AgendamentoStatus
  tentativas: number
  erro: string | null
}

export type Template = {
  nome: string
  categoria: 'MARKETING' | 'UTILITY'
  idioma: 'pt_BR'
  corpo: string
  botoes: string[]
  /** Revisão da Meta. `rejeitado` e `pausado` só aparecem vindos do sync. */
  status: 'aprovado' | 'pendente' | 'rejeitado' | 'pausado'
  /**
   * O que a Meta respondeu ao recusar. Só vem preenchido quando o status é
   * `rejeitado` — sem ele, "Rejeitado" na tela é um beco sem saída.
   */
  motivoRejeicao?: string | null
}

/**
 * Resposta rápida do composer. Substitui o tipo homônimo que vinha de
 * `src/lib/supabase.ts` (removido com o backend); a forma é exatamente a que
 * `src/lib/quickReplies.ts` consome em `QuickReplyItem`.
 */
export type QuickReply = { id: string; shortcut: string; message: string }
