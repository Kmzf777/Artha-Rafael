// Janela de atendimento de 24h da API oficial do WhatsApp: conta a partir do
// created_at da última mensagem recebida do lead (inbound). Sem inbound nas
// últimas 24h, a janela está fechada e só template (disparo) pode sair.
export const WINDOW_MS = 24 * 60 * 60 * 1000
const TWO_HOURS_MS = 2 * 60 * 60 * 1000

export type WindowStatus = {
  isOpen: boolean
  timeLeft: string
  statusColor: 'green' | 'yellow' | 'red'
}

type MensagemJanela = { direction: string; created_at: string }

export function getWindowStatus(messages: MensagemJanela[], now: Date): WindowStatus {
  let lastInboundTime = 0
  for (const m of messages) {
    if (m.direction === 'inbound') {
      const t = new Date(m.created_at).getTime()
      if (t > lastInboundTime) lastInboundTime = t
    }
  }
  if (lastInboundTime === 0) return { isOpen: false, timeLeft: '', statusColor: 'red' }

  const remaining = WINDOW_MS - (now.getTime() - lastInboundTime)
  if (remaining <= 0) return { isOpen: false, timeLeft: '', statusColor: 'red' }

  const hours = Math.floor(remaining / 3_600_000)
  const minutes = Math.floor((remaining % 3_600_000) / 60_000)
  const timeLeft = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  const statusColor: WindowStatus['statusColor'] = remaining > TWO_HOURS_MS ? 'green' : 'yellow'
  return { isOpen: true, timeLeft, statusColor }
}

export const WINDOW_COLORS: Record<WindowStatus['statusColor'], string> = {
  green: 'oklch(0.60 0.15 160)',
  yellow: 'oklch(0.75 0.16 75)',
  red: 'oklch(0.577 0.245 27.325)',
}

export const WINDOW_DOTS: Record<WindowStatus['statusColor'], string> = {
  green: '🟢',
  yellow: '🟡',
  red: '🔴',
}
