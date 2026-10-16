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
