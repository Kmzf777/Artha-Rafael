import { format, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// Formatações de apresentação compartilhadas. Antes viviam duplicadas em
// Conversations, Leads, Dashboard e SendContactDialog.

/** Iniciais para o avatar. Sem nome, os dois últimos dígitos do telefone. */
export function getInitials(name: string | null, phone: string): string {
  if (name) return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  return phone.slice(-2)
}

/** Horário na lista de conversas: hoje mostra a hora, senão a data. */
export function formatMsgTime(iso: string): string {
  const d = new Date(iso)
  if (isToday(d)) return format(d, 'HH:mm')
  if (isYesterday(d)) return 'Ontem'
  return format(d, 'dd/MM/yy', { locale: ptBR })
}

/** Divisor de data entre grupos de mensagens. */
export function formatSectionDate(iso: string): string {
  const d = new Date(iso)
  if (isToday(d)) return 'Hoje'
  if (isYesterday(d)) return 'Ontem'
  return format(d, "d 'de' MMMM", { locale: ptBR })
}

/** Cronômetro da gravação de áudio: mm:ss. */
export function formatRecordingTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}
