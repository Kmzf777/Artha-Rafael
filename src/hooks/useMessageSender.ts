'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Conversation, MensagemUI } from '@/lib/conversationTypes'
import type { Message } from '@/mock/types'
import { CHAVE_CONVERSAS, type ListaConversas } from './useConversations'

type Args = {
  conv: Conversation | null
  /** Insere a mensagem no cache sem esperar o eco do servidor. */
  acrescentar: (msg: MensagemUI) => void
}

/**
 * Caminho único de envio: `POST /api/mensagens`, que checa a janela de 24h NO
 * SERVIDOR e só então fala com a Meta.
 *
 * Não há mais progressão simulada de status. `enviado → entregue → lido` vem dos
 * callbacks da Meta, gravados pelo webhook, e chega à bolha pelo polling de 3s
 * de `useConversationMessages`. Simular aqui faria a bolha mentir.
 */
export function useMessageSender({ conv, acrescentar }: Args) {
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  /**
   * Envolve um envio: trava o botão, traduz o erro, destrava. O 409 de janela
   * fechada chega aqui como Error com a mensagem que a rota mandou — `api()`
   * extrai o campo `mensagem`, e a tela já sabe exibir `sendError`.
   */
  async function executar(
    tipo: Message['tipo'],
    conteudo: string,
    extra: { respondeA?: string | null; mime?: string | null } = {}
  ): Promise<void> {
    if (!conv) return

    // A rota de envio só manda texto. Enviar o nome do arquivo como se fosse a
    // mídia seria mentira na conversa do cliente — melhor recusar e dizer.
    if (tipo !== 'text') {
      setSendError('Envio de mídia ainda não disponível')
      return
    }
    if (!conv.phone) {
      setSendError('Conversa sem telefone')
      return
    }

    setSending(true)
    setSendError(null)
    try {
      const { message_id } = await api<{ ok: true; message_id: string | null }>('/api/mensagens', {
        method: 'POST',
        body: JSON.stringify({ key: conv.key, telefone: conv.phone, texto: conteudo }),
      })

      const criadoEm = new Date().toISOString()
      // Bolha otimista: o wamid é o identificador honesto que temos antes de a
      // linha voltar do banco. O próximo polling substitui a lista inteira pela
      // do servidor, então esta cópia vive segundos.
      const enviada: MensagemUI = {
        id: message_id ?? `local:${criadoEm}`,
        message_id,
        phone: conv.phone,
        phone_id: conv.phone_id,
        bsuid: conv.bsuid,
        contact_name: conv.contact_name,
        message_type: tipo,
        content: conteudo,
        direction: 'outbound',
        created_at: criadoEm,
        raw_payload: null,
        media_id: null,
        media_mime_type: extra.mime ?? null,
        media_storage_path: null,
        reply_to_message_id: extra.respondeA ?? null,
        status: 'enviado',
      }
      acrescentar(enviada)

      // O card da lista sobe para o topo com a nova última mensagem.
      queryClient.setQueryData<ListaConversas>(CHAVE_CONVERSAS, (atual) => {
        if (!atual) return atual
        const existente = atual.conversas.find((c) => c.key === conv.key)
        if (!existente) return atual
        const atualizada: Conversation = {
          ...existente,
          last_message: conteudo,
          last_message_time: criadoEm,
          last_direction: 'outbound',
          last_message_type: tipo,
        }
        return {
          conversas: [atualizada, ...atual.conversas.filter((c) => c.key !== conv.key)],
          naoLidas: atual.naoLidas,
        }
      })
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Falha ao enviar')
    } finally {
      setSending(false)
    }
  }

  const enviarTexto = (texto: string, respondendoA: MensagemUI | null = null) =>
    executar('text', texto, { respondeA: respondendoA?.id ?? null })

  const enviarMidia = (file: File, isVoiceNote = false, caption?: string) => {
    const tipo: Message['tipo'] = file.type.startsWith('image/')
      ? 'image'
      : file.type.startsWith('audio/')
      ? 'audio'
      : 'document'
    // Nota de voz e áudio anexado são bolhas diferentes: o mime é o que separa.
    const mime = isVoiceNote ? 'audio/ogg; codecs=opus' : file.type || null
    return executar(tipo, caption?.trim() || file.name, { mime })
  }

  const enviarContato = (contato: { contact_name: string | null; phone: string }) =>
    executar('text', `${contato.contact_name?.trim() || 'Contato'} — ${contato.phone}`)

  return { sending, sendError, setSendError, enviarTexto, enviarMidia, enviarContato }
}
