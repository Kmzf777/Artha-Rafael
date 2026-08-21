// Formas de dado sobre as quais os módulos puros de conversa operam
// (`timeline`, `listaConversas`, `buscaConversas`).
//
// Estes tipos moravam em `src/lib/supabase.ts`, junto do cliente do banco. O
// cliente saiu com o backend; os tipos ficaram, porque os módulos puros que os
// consomem são preservados e testados. Módulo sem dependência: só `type`.
export type Message = {
  id: string
  message_id: string | null
  phone: string | null
  phone_id: string | null
  bsuid: string | null
  contact_name: string | null
  message_type: string
  content: string | null
  direction: 'inbound' | 'outbound'
  created_at: string
  raw_payload: Record<string, unknown> | null
  media_id: string | null
  media_mime_type: string | null
  media_storage_path: string | null
  reply_to_message_id: string | null
}

export type Conversation = {
  /** Chave do card: (bsuid ?? phone) + '::' + (phone_id ?? ''). */
  key: string
  phone: string | null
  /** Instância (número) do card — cada phone_id é um card separado. */
  phone_id: string | null
  bsuid: string | null
  contact_name: string | null
  last_message: string | null
  last_message_time: string
  last_direction: 'inbound' | 'outbound'
  last_message_type: string | null
}

/**
 * Mensagem como a tela consome: forma de fio + status de entrega.
 *
 * Mora aqui, e não no repositório do servidor, porque hooks e componentes —
 * que rodam no cliente — precisam do tipo, e o repositório é `server-only`.
 * A união é escrita literal em vez de importada de `@/mock/types` para
 * preservar a propriedade declarada no topo: módulo sem dependência.
 */
export type MensagemUI = Message & {
  status: 'enviado' | 'entregue' | 'lido' | 'falhou' | null
}
