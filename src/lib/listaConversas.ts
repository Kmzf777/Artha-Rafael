import type { Conversation } from './conversationTypes'

export const PREFIXO_LAST_READ = 'lastRead_'

/** Linha crua da RPC `listar_conversas`. */
export type LinhaConversaRpc = {
  key: string
  phone: string | null
  bsuid: string | null
  phone_id: string | null
  contact_name: string | null
  last_message: string | null
  last_message_time: string
  last_direction: string
  last_message_type: string | null
  nao_lidas: number
}

export function mapearConversa(linha: LinhaConversaRpc): Conversation {
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
  }
}

/** Só as conversas com pendência entram no mapa — um zero não muda nada na UI. */
export function extrairNaoLidas(linhas: LinhaConversaRpc[]): Record<string, number> {
  const contagem: Record<string, number> = {}
  for (const l of linhas) if (l.nao_lidas > 0) contagem[l.key] = l.nao_lidas
  return contagem
}

export type ReciboLegado = { conversation_key: string; last_read_at: string }

/**
 * Lê os marcadores `lastRead_<key>` que ficaram no localStorage.
 *
 * O "lido até aqui" agora mora em `conversation_reads`. Esta função existe só
 * para a MIGRAÇÃO ÚNICA: sem ela, na primeira abertura após o deploy toda
 * conversa já lida voltaria a aparecer como não lida.
 *
 * Valores inválidos são descartados: um marcador corrompido faria o Postgres
 * abortar o upsert inteiro no cast.
 */
export function lerMarcadores(
  storage: Pick<Storage, 'length' | 'key' | 'getItem'>
): ReciboLegado[] {
  const recibos: ReciboLegado[] = []
  for (let i = 0; i < storage.length; i++) {
    const chaveStorage = storage.key(i)
    if (!chaveStorage?.startsWith(PREFIXO_LAST_READ)) continue
    const valor = storage.getItem(chaveStorage)
    if (!valor) continue
    const data = new Date(valor)
    if (Number.isNaN(data.getTime())) continue
    recibos.push({
      conversation_key: chaveStorage.slice(PREFIXO_LAST_READ.length),
      last_read_at: data.toISOString(),
    })
  }
  return recibos
}

/** Chaves de localStorage a remover depois que os recibos foram para o banco. */
export function chavesLegadas(storage: Pick<Storage, 'length' | 'key'>): string[] {
  const chaves: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i)
    if (k?.startsWith(PREFIXO_LAST_READ)) chaves.push(k)
  }
  return chaves
}
