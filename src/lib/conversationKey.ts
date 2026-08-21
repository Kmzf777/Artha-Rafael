// Chave canônica do card: identidade do contato (bsuid ?? telefone) + instância
// (phone_id). Incluir o phone_id separa a MESMA pessoa em cards distintos quando
// ela fala com instâncias diferentes. phone_id nulo (mensagens legadas) agrupa sob
// o sufixo vazio, preservando o comportamento anterior desses registros.
//
// ATENÇÃO: a RPC `listar_conversas` monta a mesma chave em SQL
// (`coalesce(bsuid, phone) || '::' || coalesce(phone_id, '')`). Mudar uma exige
// mudar a outra, ou os cards do realtime deixam de casar com os da lista.
export function conversationKey(msg: {
  bsuid: string | null
  phone: string | null
  phone_id: string | null
}): string | null {
  const identity = msg.bsuid ?? msg.phone
  if (!identity) return null
  return `${identity}::${msg.phone_id ?? ''}`
}
