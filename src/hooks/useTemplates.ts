'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Template } from '@/mock/types'

export const CHAVE_TEMPLATES = ['templates'] as const

/**
 * Templates cadastrados na Meta, pelo cache local que `/api/templates` serve.
 * Só os `aprovado` podem ser disparados — o `pendente` aparece na lista, mas
 * em revisão.
 */
export function useTemplates(): { templates: Template[]; aprovados: Template[]; carregando: boolean } {
  const query = useQuery({
    queryKey: CHAVE_TEMPLATES,
    queryFn: () => api<Template[]>('/api/templates'),
    staleTime: 5 * 60_000,
  })

  const templates = query.data ?? []
  return {
    templates,
    aprovados: templates.filter((t) => t.status === 'aprovado'),
    carregando: query.isLoading,
  }
}

/**
 * Puxa da Meta o estado de revisão e reescreve o cache local.
 *
 * Só sob clique, de propósito: sincronizar dentro do `queryFn` daria uma
 * chamada à Graph API a cada foco de aba. Sem ele, porém, o template criado
 * fica `pendente` para sempre — e campanha só aceita template `aprovado`.
 */
export function useSincronizarTemplates() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api<{ sincronizados: number }>('/api/templates/sync', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHAVE_TEMPLATES }),
  })
}
