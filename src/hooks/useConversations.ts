'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Conversation } from '@/lib/conversationTypes'

export const CHAVE_CONVERSAS = ['conversas'] as const

export type ListaConversas = {
  conversas: Conversation[]
  naoLidas: Record<string, number>
}

// Vazios ESTÁVEIS, não literais novos a cada render. A tela repassa `naoLidas`
// ao badge da Sidebar por efeito: um `{}` novo a cada render dispararia o efeito
// de novo, que troca o estado do pai, que renderiza de novo — laço infinito
// enquanto a primeira resposta não chega (ou para sempre, se ela falhar).
const SEM_CONVERSAS: Conversation[] = []
const SEM_NAO_LIDAS: Record<string, number> = {}

/**
 * Lista de conversas. A assinatura é a mesma de quando a origem era o store em
 * memória — o que mudou foi só o `queryFn`.
 *
 * A mensagem que chega pelo webhook aparece aqui por POLLING de 5s (spec §3.3);
 * não usamos Realtime. `refetchIntervalInBackground: false` para a aba escondida
 * não queimar requisição.
 */
export function useConversations() {
  const query = useQuery({
    queryKey: CHAVE_CONVERSAS,
    queryFn: () => api<ListaConversas>('/api/conversas'),
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  })

  return {
    conversas: query.data?.conversas ?? SEM_CONVERSAS,
    naoLidas: query.data?.naoLidas ?? SEM_NAO_LIDAS,
    carregando: query.isLoading,
  }
}

/** Marca a conversa como lida e zera o badge no cache. */
export function useMarcarLida() {
  const queryClient = useQueryClient()

  return useMutation({
    // `lidoEm` continua na assinatura porque a tela o passa, mas quem carimba a
    // marca é o servidor: relógio de cliente adiantado esconderia mensagem nova.
    mutationFn: ({ key }: { key: string; lidoEm: string }) =>
      api<{ ok: true }>(`/api/conversas/${encodeURIComponent(key)}/lida`, { method: 'POST' }),
    // Otimista: o badge some no clique, como já era com o servidor.
    onMutate: ({ key }) => {
      queryClient.setQueryData<ListaConversas>(CHAVE_CONVERSAS, (atual) => {
        if (!atual) return atual
        const naoLidas = { ...atual.naoLidas }
        delete naoLidas[key]
        return { ...atual, naoLidas }
      })
    },
  })
}

/**
 * Renomear um contato reescreve o nome no card da lista.
 *
 * Só no cache: não existe rota de renomear contato, e o nome que o banco guarda
 * é o que a Meta manda no `profile.name`. O próximo polling traz o nome do
 * WhatsApp de volta.
 */
export function useAtualizarNomeNoCache() {
  const queryClient = useQueryClient()
  return (identidade: { bsuid: string | null; phone: string | null }, nome: string) => {
    queryClient.setQueryData<ListaConversas>(CHAVE_CONVERSAS, (atual) => {
      if (!atual) return atual
      const mesmo = (c: Conversation) =>
        identidade.bsuid ? c.bsuid === identidade.bsuid : c.phone === identidade.phone
      return {
        ...atual,
        conversas: atual.conversas.map((c) => (mesmo(c) ? { ...c, contact_name: nome } : c)),
      }
    })
  }
}
