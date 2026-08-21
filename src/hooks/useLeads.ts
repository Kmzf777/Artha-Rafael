'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { FunnelStage, Lead, PlanoStatus, Segmento } from '@/mock/types'
import { CHAVE_METRICS } from './useMetrics'

export const CHAVE_LEADS = ['leads'] as const

/** Linhas por página da tabela de Leads (spec §5). */
export const TAMANHO_PAGINA = 25

export type FiltroLeads = {
  segmento?: Segmento | 'todos'
  stage?: FunnelStage | 'todos'
  planoStatus?: PlanoStatus | 'todos'
  /** Nome (sem acento, sem caixa) ou telefone (só dígitos). */
  busca?: string
  /** 1-based. Fora do intervalo é grampeada para a primeira/última. */
  pagina?: number
}

export type PaginaDeLeads = {
  /** Só a página pedida. */
  leads: Lead[]
  /** Total que passou pelo filtro — o que a paginação conta. */
  total: number
  /** Total da base, independente de filtro. */
  totalGeral: number
  pagina: number
  paginas: number
  carregando: boolean
}

/**
 * Tabela de Leads: filtro por segmento, etapa e status de plano, busca por nome
 * e telefone, paginação de 25 — agora contra o Postgres, por `/api/leads`.
 * Filtro, busca e paginação são resolvidos no servidor (`src/server/repo/leads`).
 */
export function useLeads(filtro: FiltroLeads = {}): PaginaDeLeads {
  const chave = [
    ...CHAVE_LEADS,
    filtro.segmento ?? 'todos',
    filtro.stage ?? 'todos',
    filtro.planoStatus ?? 'todos',
    filtro.busca?.trim() ?? '',
    filtro.pagina ?? 1,
  ]

  const query = useQuery({
    queryKey: chave,
    queryFn: () =>
      api<Omit<PaginaDeLeads, 'carregando'>>(
        `/api/leads?${new URLSearchParams({
          segmento: filtro.segmento ?? 'todos',
          stage: filtro.stage ?? 'todos',
          planoStatus: filtro.planoStatus ?? 'todos',
          busca: filtro.busca?.trim() ?? '',
          pagina: String(filtro.pagina ?? 1),
        })}`
      ),
    // Recorte novo a cada chip clicado: `placeholderData` mantém a página
    // anterior na tela enquanto a nova chega, que é o efeito que o
    // `initialData` do store produzia.
    placeholderData: (anterior) => anterior,
  })

  const vazia = {
    leads: [],
    total: 0,
    totalGeral: 0,
    pagina: filtro.pagina ?? 1,
    paginas: 1,
  } satisfies Omit<PaginaDeLeads, 'carregando'>

  return { ...(query.data ?? vazia), carregando: query.isLoading }
}

/** Muda a etapa de funil de um lead. A linha se move e o Dashboard acompanha. */
export function useMudarEtapaLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ leadId, stage }: { leadId: string; stage: FunnelStage }) =>
      api<Lead | null>(`/api/leads/${encodeURIComponent(leadId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ stage }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CHAVE_LEADS })
      void queryClient.invalidateQueries({ queryKey: CHAVE_METRICS })
    },
  })
}
