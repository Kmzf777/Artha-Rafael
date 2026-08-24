import type { Conversation } from './conversationTypes'

export const BUSCA_DEBOUNCE_MS = 350
/** Abaixo disso a busca no servidor traz ruído (um dígito casa com meio banco). */
export const BUSCA_MIN_CARACTERES = 2

export type MatchTipo = 'nome' | 'telefone' | 'mensagem' | 'tag' | 'status'

export type ResultadoBusca = Conversation & {
  match_tipo: MatchTipo
  match_trecho: string | null
}

/** Linha crua da RPC `buscar_conversas`. */
type LinhaRpc = {
  key: string
  phone: string | null
  bsuid: string | null
  phone_id: string | null
  contact_name: string | null
  last_message: string | null
  last_message_time: string
  last_direction: string
  last_message_type: string | null
  last_enviado_por: string | null
  match_tipo: string
  match_trecho: string | null
}

export function mapearResultado(linha: LinhaRpc): ResultadoBusca {
  return {
    key: linha.key,
    phone: linha.phone,
    phone_id: linha.phone_id,
    bsuid: linha.bsuid,
    contact_name: linha.contact_name,
    last_message: linha.last_message,
    last_message_time: linha.last_message_time,
    last_direction: linha.last_direction === 'inbound' ? 'inbound' : 'outbound',
    last_message_type: linha.last_message_type,
    last_enviado_por: linha.last_enviado_por,
    match_tipo: linha.match_tipo as MatchTipo,
    match_trecho: linha.match_trecho,
  }
}

/** Rótulo do porquê da conversa ter aparecido. Sem isso o resultado parece mágico. */
export const ROTULO_MATCH: Record<MatchTipo, string> = {
  nome: 'nome',
  telefone: 'telefone',
  mensagem: 'mensagem',
  tag: 'tag',
  status: 'status',
}

/** A busca só vai ao servidor com termo útil. Espaços não contam. */
export function deveBuscarNoServidor(termo: string): boolean {
  return termo.trim().length >= BUSCA_MIN_CARACTERES
}

/** Encurta o trecho ao redor do termo, para o card não estourar. */
export function recortarTrecho(trecho: string | null, termo: string, max = 60): string {
  if (!trecho) return ''
  if (trecho.length <= max) return trecho
  const alvo = trecho.toLowerCase().indexOf(termo.trim().toLowerCase())
  if (alvo < 0) return trecho.slice(0, max) + '…'
  const inicio = Math.max(0, alvo - Math.floor((max - termo.length) / 2))
  const prefixo = inicio > 0 ? '…' : ''
  const sufixo = inicio + max < trecho.length ? '…' : ''
  return prefixo + trecho.slice(inicio, inicio + max) + sufixo
}
