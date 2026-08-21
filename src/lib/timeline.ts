import { format } from 'date-fns'
import type { Message } from './conversationTypes'

export type GrupoDeMensagens = { date: string; msgs: Message[] }

/** Quebra a timeline em blocos por dia, para o divisor de data. */
export function agruparPorData(mensagens: Message[]): GrupoDeMensagens[] {
  const grupos: GrupoDeMensagens[] = []
  for (const msg of mensagens) {
    const dateKey = format(new Date(msg.created_at), 'yyyy-MM-dd')
    const ultimo = grupos[grupos.length - 1]
    if (ultimo?.date === dateKey) ultimo.msgs.push(msg)
    else grupos.push({ date: dateKey, msgs: [msg] })
  }
  return grupos
}

/**
 * Primeira mensagem não lida (para o divisor "N mensagens não lidas") e quantas
 * são. Só inbound conta: a operadora nunca "deixa de ler" o que ela mesma enviou.
 */
export function localizarNaoLidas(
  mensagens: Message[],
  lidoAte: string | null
): { primeiraNaoLidaId: string | null; quantidade: number } {
  const limite = lidoAte ? new Date(lidoAte).getTime() : 0
  let primeiraNaoLidaId: string | null = null
  let quantidade = 0
  for (const m of mensagens) {
    if (m.direction === 'inbound' && new Date(m.created_at).getTime() > limite) {
      if (!primeiraNaoLidaId) primeiraNaoLidaId = m.id
      quantidade++
    }
  }
  return { primeiraNaoLidaId, quantidade }
}

/**
 * Trava de negócio: se a mensagem MAIS RECENTE for a notificação de troca de
 * número, o wa_id antigo está morto na Meta. O input é bloqueado para a
 * vendedora não enviar mensagens que falhariam silenciosamente.
 */
export function trocouDeNumero(mensagens: Message[]): boolean {
  const ultima = mensagens.reduce<Message | null>(
    (mais, m) => (!mais || new Date(m.created_at) > new Date(mais.created_at) ? m : mais),
    null
  )
  if (ultima?.message_type !== 'system') return false
  const sistema = ultima.raw_payload?.system as { type?: string } | undefined
  return sistema?.type === 'user_changed_number'
}
