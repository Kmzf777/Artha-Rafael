// vistoAzul.ts — qual mensagem do lead a equipe marca como lida na Meta.
//
// A Cloud API marca como lidas, junto, todas as anteriores à mensagem indicada,
// então basta a última inbound. Ela precisa de wamid: é o único identificador
// que a Meta reconhece, e inbound sem ele (linha legada) não serve de alvo.

type Linha = {
  direction: 'inbound' | 'outbound'
  message_id: string | null
  created_at: string
}

/** wamid da inbound mais recente que tenha um, ou null se não houver nenhuma. */
export function ultimaInboundComWamid(mensagens: Linha[]): string | null {
  let alvo: Linha | null = null
  for (const m of mensagens) {
    if (m.direction !== 'inbound' || !m.message_id) continue
    if (!alvo || new Date(m.created_at) > new Date(alvo.created_at)) alvo = m
  }
  return alvo?.message_id ?? null
}
