// 'sending' = ponto de não-retorno: o POST à Meta foi (ou está sendo) feito.
// Nunca volta a 'pending' automaticamente — ver reap_scheduled_disparos.
export type ScheduledStatus = 'pending' | 'processing' | 'sending' | 'sent' | 'failed' | 'canceled'

// O <input type="datetime-local"> produz "YYYY-MM-DDTHH:mm" sem fuso. A operadora
// pensa em horário de Brasília (America/Sao_Paulo, UTC-3 fixo, sem horário de verão
// desde 2019). Anexamos o offset -03:00 e normalizamos para UTC ISO.
export function saoPauloLocalToUtcISO(local: string): string {
  return new Date(`${local}:00-03:00`).toISOString()
}

// ISO UTC → "dd/mm/aaaa hh:mm" no fuso de São Paulo, para exibição na aba.
export function formatScheduledAt(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

// Decide o próximo estado de um agendamento após uma tentativa de envio.
// Sucesso → 'sent'. Falha → 'pending' (retry) até atingir maxRetries, então 'failed'.
export function resolveDeliveryOutcome(
  attempts: number,
  ok: boolean,
  maxRetries = 3
): { status: ScheduledStatus; attempts: number } {
  const next = attempts + 1
  if (ok) return { status: 'sent', attempts: next }
  return { status: next >= maxRetries ? 'failed' : 'pending', attempts: next }
}
