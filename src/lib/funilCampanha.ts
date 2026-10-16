/** "12 · 80%": o número e o percentual sobre enviados. Enviados 0, só o número. */
export function numeroComPercentual(n: number, enviados: number): string {
  if (enviados === 0) return String(n)
  return `${n} · ${Math.round((n / enviados) * 100)}%`
}

/**
 * Contagem de entrega de uma campanha a partir do status das mensagens dela.
 * Entregue inclui lido (toda mensagem lida foi entregue); lido é só 'lido'.
 */
export function contarFunilEntrega(msgs: { status: string | null }[]) {
  return {
    enviados: msgs.length,
    entregues: msgs.filter((m) => m.status === 'entregue' || m.status === 'lido').length,
    lidos: msgs.filter((m) => m.status === 'lido').length,
  }
}
