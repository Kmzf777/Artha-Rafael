'use client'

import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Conversation, MensagemUI } from '@/lib/conversationTypes'
import type { DeliveryStatus } from '@/mock/types'

export const chaveMensagens = (key: string | null) => ['mensagens', key] as const

const porData = (a: MensagemUI, b: MensagemUI) =>
  new Date(a.created_at).getTime() - new Date(b.created_at).getTime()

/**
 * Timeline do card aberto. Polling de 3s (spec §3.3): é por ele que a resposta
 * que chegou pelo webhook — e o avanço de status vindo dos callbacks da Meta —
 * aparecem na bolha. Parado em segundo plano para não gastar requisição.
 */
export function useConversationMessages(conv: Conversation | null) {
  const queryClient = useQueryClient()
  const key = conv?.key ?? null

  const query = useQuery({
    queryKey: chaveMensagens(key),
    queryFn: () => api<MensagemUI[]>(`/api/conversas/${encodeURIComponent(key!)}/mensagens`),
    enabled: conv !== null,
    refetchInterval: 3_000,
    refetchIntervalInBackground: false,
  })

  const mensagens = useMemo(() => query.data ?? [], [query.data])

  /** Acrescenta a mensagem recém-enviada, antes de o polling trazê-la do banco. */
  const acrescentar = useCallback(
    (msg: MensagemUI) => {
      queryClient.setQueryData<MensagemUI[]>(chaveMensagens(key), (atual) =>
        atual && !atual.some((m) => m.id === msg.id) ? [...atual, msg].sort(porData) : atual
      )
    },
    [key, queryClient]
  )

  /** Renomear o contato reescreve o nome nas mensagens já em cache. */
  const renomearContato = useCallback(
    (nome: string) => {
      queryClient.setQueryData<MensagemUI[]>(chaveMensagens(key), (atual) =>
        atual?.map((m) => ({ ...m, contact_name: nome }))
      )
    },
    [key, queryClient]
  )

  /**
   * Status de entrega por id. Existe porque `agruparPorData` (src/lib/timeline)
   * devolve `Message`, a forma de fio, que não carrega status — a bolha precisa
   * dele para desenhar a linha 3.5 da spec (ícone + rótulo, sem cor).
   */
  const statusDe = useMemo(() => {
    const mapa = new Map<string, DeliveryStatus | null>(mensagens.map((m) => [m.id, m.status]))
    return (id: string): DeliveryStatus | null => mapa.get(id) ?? null
  }, [mensagens])

  return {
    mensagens,
    carregando: query.isLoading && conv !== null,
    erro: query.isError ? 'Falha ao carregar' : null,
    recarregar: () => { void query.refetch() },
    acrescentar,
    renomearContato,
    statusDe,
  }
}
