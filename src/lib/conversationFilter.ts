export type ConversaFiltravel = {
  key: string
  phone: string | null
  contact_name: string | null
  last_message: string | null
}

/**
 * Filtro da lista de conversas: busca textual + "Não lidas".
 *
 * Regra que não é óbvia: com o filtro ligado, abrir uma conversa a marca como
 * lida — e ela sumiria da lista no exato instante em que a operadora vai
 * responder. Por isso a conversa selecionada permanece visível mesmo já lida.
 */
export function filtrarConversas<T extends ConversaFiltravel>(args: {
  conversas: T[]
  busca: string
  apenasNaoLidas: boolean
  naoLidas: Record<string, number>
  selecionada: string | null
}): T[] {
  const { conversas, busca, apenasNaoLidas, naoLidas, selecionada } = args
  const q = busca.toLowerCase()
  return conversas.filter((c) => {
    const casaBusca =
      (c.phone?.includes(q) ?? false) ||
      (c.contact_name?.toLowerCase().includes(q) ?? false) ||
      (c.last_message?.toLowerCase().includes(q) ?? false)
    if (!casaBusca) return false
    if (!apenasNaoLidas) return true
    return (naoLidas[c.key] ?? 0) > 0 || c.key === selecionada
  })
}

/**
 * Filtro por instâncias (admin-only). Conjunto vazio equivale a "sem
 * filtro" por defesa — a UI normaliza para `null`, mas a função não pode
 * devolver lista vazia nesse caso.
 *
 * `selecionada` fixa a conversa aberta na lista mesmo quando ela é de outra
 * instância — pela mesma razão do filtro "Não lidas": ela não pode sumir
 * debaixo do cursor de quem está atendendo.
 */
export function filtrarPorInstancias<T extends { key: string; phone_id: string | null }>(
  conversas: T[],
  instancias: ReadonlySet<string> | null,
  selecionada: string | null = null
): T[] {
  if (instancias === null || instancias.size === 0) return conversas
  return conversas.filter(
    (c) => (c.phone_id !== null && instancias.has(c.phone_id)) || c.key === selecionada
  )
}

/** Quantas CONVERSAS esperam resposta (não quantas mensagens). */
export function contarConversasNaoLidas(
  conversas: { key: string }[],
  naoLidas: Record<string, number>
): number {
  return conversas.reduce((n, c) => n + ((naoLidas[c.key] ?? 0) > 0 ? 1 : 0), 0)
}
