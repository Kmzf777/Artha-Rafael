// A campanha a que um toque de botão responde, como função pura do histórico.
// Spec 2026-10-16 §3.2.
//
// Existe porque o link de cupom muda por template (volta_01 R$97, volta_02
// R$47) e o payload do botão é o mesmo nos dois: `rtv:voltar`.

/** O mínimo de mensagem que a escolha precisa. */
export type MensagemToque = {
  direction: 'inbound' | 'outbound'
  message_id: string | null
  reply_to_message_id: string | null
  campanha_id: string | null
}

/**
 * 1. O `context.id` do toque (gravado em `reply_to_message_id`) aponta para a
 *    saída de campanha respondida. Verificado em produção em 2026-10-16.
 * 2. Sem ele, ou apontando para mensagem que não é de campanha, a campanha mais
 *    recente ANTES do toque.
 * 3. Sem campanha nenhuma, `null`.
 */
export function campanhaDoToque(historico: MensagemToque[], messageIdDoToque: string): string | null {
  const indice = historico.findIndex((m) => m.message_id === messageIdDoToque)
  const anteriores = indice === -1 ? historico : historico.slice(0, indice)
  const respondida = indice === -1 ? null : historico[indice].reply_to_message_id

  if (respondida) {
    const alvo = anteriores.find((m) => m.direction === 'outbound' && m.message_id === respondida)
    if (alvo?.campanha_id) return alvo.campanha_id
  }

  for (let i = anteriores.length - 1; i >= 0; i--) {
    const m = anteriores[i]
    if (m.direction === 'outbound' && m.campanha_id) return m.campanha_id
  }
  return null
}
