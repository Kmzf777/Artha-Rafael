'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getMetrics, type Metrics } from '@/lib/regras'

export const CHAVE_METRICS = ['metrics'] as const
export type { Metrics }

// As telas leem `metrics.x.y` sem checar nulo. Enquanto a primeira resposta não
// chega, este é o objeto no formato certo com tudo zerado — montado pela MESMA
// `getMetrics` da rota, sobre um pacote vazio, para não haver duas definições do
// que é um `Metrics` zerado.
const METRICS_VAZIO: Metrics = getMetrics(
  { leads: [], conversas: [], mensagens: [], campanhas: [], agendamentos: [] },
  new Date()
)

/**
 * Números do Dashboard, dos Relatórios e do Painel Executivo — todos derivados
 * da base pela rota `/api/metrics`. Nenhuma tela calcula total por conta
 * própria: o número de inativos daqui e o total do recorte da Reativação saem
 * da mesma `ehInativo`.
 */
export function useMetrics() {
  const query = useQuery({
    queryKey: CHAVE_METRICS,
    queryFn: () => api<Metrics>('/api/metrics'),
  })

  return { metrics: query.data ?? METRICS_VAZIO, carregando: query.isLoading }
}
