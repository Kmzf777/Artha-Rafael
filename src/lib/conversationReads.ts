// conversationReads.ts — lógica pura do estado "lida/não lida" das conversas.
//
// Histórico do bug que motivou este módulo: a marca de leitura vivia só no
// localStorage, indexada por uma chave que mudou de formato duas vezes
// (identidade pura → identidade::phone_id; telefone → bsuid quando a Meta
// passa a enviá-lo). Cada mudança órfãva as marcas antigas e TODO o histórico
// voltava a contar como não lido. A resolução aqui aceita as chaves legadas
// como candidatas e escolhe a marca mais recente; a persistência durável fica
// na tabela conversation_reads (por usuária), mesclada com o localStorage.

export type ConversationIdentity = {
  bsuid: string | null
  phone: string | null
  phone_id: string | null
}

export type MessageRow = ConversationIdentity & {
  direction: 'inbound' | 'outbound'
  created_at: string
}

/** Mapa chave-do-card → ISO timestamp da última leitura. */
export type ReadMarks = Record<string, string>

/**
 * Chave canônica do card: identidade do contato (bsuid ?? telefone) + instância
 * (phone_id). Incluir o phone_id separa a MESMA pessoa em cards distintos quando
 * ela fala com instâncias diferentes. phone_id nulo (mensagens legadas) agrupa
 * sob o sufixo vazio.
 */
export function conversationKey(msg: ConversationIdentity): string | null {
  const identity = msg.bsuid ?? msg.phone
  if (!identity) return null
  return `${identity}::${msg.phone_id ?? ''}`
}

/** Epoch ms de um ISO, ou null se inválido. */
function ts(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? t : null
}

/**
 * Chaves sob as quais uma marca de leitura desta conversa pode ter sido gravada,
 * da mais atual para a mais antiga:
 *   1. chave canônica atual (identidade::phone_id);
 *   2. identidade pura (formato anterior à feature de um-card-por-instância);
 *   3./4. as mesmas duas formas usando o TELEFONE, para contatos que ganharam
 *      bsuid depois que a leitura foi feita (a identidade da chave mudou).
 */
export function readMarkCandidates(conv: ConversationIdentity): string[] {
  const out: string[] = []
  const push = (k: string | null) => {
    if (k && !out.includes(k)) out.push(k)
  }
  const identity = conv.bsuid ?? conv.phone
  const suffix = conv.phone_id ?? ''
  if (identity) {
    push(`${identity}::${suffix}`)
    push(identity)
  }
  if (conv.bsuid && conv.phone) {
    push(`${conv.phone}::${suffix}`)
    push(conv.phone)
  }
  return out
}

/**
 * Resolve a marca de leitura efetiva de uma conversa: a mais recente entre as
 * gravadas sob qualquer chave candidata (atual ou legada). null = nunca lida.
 */
export function resolveLastRead(conv: ConversationIdentity, marks: ReadMarks): string | null {
  let best: string | null = null
  let bestTs = -Infinity
  for (const key of readMarkCandidates(conv)) {
    const t = ts(marks[key])
    if (t !== null && t > bestTs) {
      bestTs = t
      best = marks[key]
    }
  }
  return best
}

/**
 * Mescla fontes de marcas (localStorage, servidor…) mantendo, por chave, a mais
 * recente. Timestamps inválidos são descartados.
 */
export function mergeReadMarks(...sources: ReadMarks[]): ReadMarks {
  const out: ReadMarks = {}
  for (const src of sources) {
    for (const [key, iso] of Object.entries(src)) {
      const t = ts(iso)
      if (t === null) continue
      const cur = ts(out[key])
      if (cur === null || t > cur) out[key] = iso
    }
  }
  return out
}

/**
 * Contadores de não lidas por chave de card: inbound estritamente mais novo que
 * a marca de leitura resolvida (com fallback às chaves legadas). Chaves sem
 * pendência ficam fora do mapa.
 */
export function computeUnreadCounts(rows: MessageRow[], marks: ReadMarks): Record<string, number> {
  // Identidade consolidada por card: dentro de um mesmo card o bsuid é fixo
  // (ou nulo), mas o telefone pode faltar em parte das linhas — guardamos o
  // primeiro não-nulo para que o fallback por telefone funcione.
  const identities = new Map<string, ConversationIdentity>()
  const inboundTimes = new Map<string, number[]>()

  for (const row of rows) {
    const key = conversationKey(row)
    if (!key) continue
    const id = identities.get(key)
    if (!id) {
      identities.set(key, { bsuid: row.bsuid, phone: row.phone, phone_id: row.phone_id })
    } else {
      if (!id.bsuid && row.bsuid) id.bsuid = row.bsuid
      if (!id.phone && row.phone) id.phone = row.phone
    }
    if (row.direction === 'inbound') {
      const t = ts(row.created_at)
      if (t === null) continue
      const list = inboundTimes.get(key)
      if (list) list.push(t)
      else inboundTimes.set(key, [t])
    }
  }

  const counts: Record<string, number> = {}
  for (const [key, times] of inboundTimes) {
    const lastRead = ts(resolveLastRead(identities.get(key)!, marks))
    const cnt = lastRead === null ? times.length : times.filter((t) => t > lastRead).length
    if (cnt > 0) counts[key] = cnt
  }
  return counts
}
