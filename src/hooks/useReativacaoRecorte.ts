'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  DIAS_SEM_ACESSO_INATIVO,
  FAIXAS_SEM_ACESSO,
  diasSemAcesso,
  type FaixaSemAcesso,
  type FiltroRecorte,
} from '@/lib/regras'
import type { Lead } from '@/mock/types'

export const CHAVE_RECORTE = ['reativacao-recorte'] as const
export { DIAS_SEM_ACESSO_INATIVO, FAIXAS_SEM_ACESSO }
export type { FaixaSemAcesso, FiltroRecorte }

/** Quantos leads a prévia mostra antes de enfileirar (spec §5, Reativação). */
export const TAMANHO_PREVIA = 10

export type Recorte = {
  /** O número-herói da tela. Sem filtro, é exatamente o total de inativos. */
  total: number
  /**
   * Quantos do recorte o motor de disparo aceita — o que a campanha vai mesmo
   * enfileirar. Menor que `total` quando há lead de semente no recorte, porque
   * telefone fictício não recebe disparo. Ver `podeDisparar` em `lib/regras`.
   */
  disparaveis: number
  /** Os leads da prévia, do mais parado para o menos. */
  previa: Lead[]
  /**
   * Ids dos leads da PRÉVIA — não do recorte inteiro: `/api/reativacao` devolve
   * o total e os 10 primeiros, não os 612 ids. Quem enfileira não precisa mais
   * deles: `POST /api/campanhas` resolve o recorte no servidor, pela mesma
   * `recorteReativacao`.
   */
  leadIds: string[]
  /** Dias sem acesso de cada lead da prévia, na mesma ordem. */
  diasDaPrevia: number[]
  carregando: boolean
}

/**
 * A régua da tela de Reativação, agora servida por `/api/reativacao`. A rota
 * usa exatamente a mesma `recorteReativacao` que `/api/metrics` usa por baixo de
 * `ehInativo`: sem filtro nenhum, `total` é o mesmo número que a banda preta do
 * Dashboard estampa. Divergir aqui é o defeito mais grave possível.
 */
export function useReativacaoRecorte(filtro: FiltroRecorte = {}): Recorte {
  const dias = filtro.diasSemAcesso ?? DIAS_SEM_ACESSO_INATIVO
  const plano = filtro.planoStatus ?? 'todos'
  const segmento = filtro.segmento ?? 'todos'

  const query = useQuery({
    queryKey: [...CHAVE_RECORTE, dias, plano, segmento],
    queryFn: async () => {
      const resposta = await api<{ leads: Lead[]; total: number; disparaveis: number }>(
        `/api/reativacao?${new URLSearchParams({
          diasSemAcesso: String(dias),
          planoStatus: plano,
          segmento,
        })}`
      )
      // Mais parado primeiro: é o lead que a campanha mais precisa alcançar.
      const agora = new Date()
      const previa = resposta.leads
        .slice()
        .sort((a, b) => diasSemAcesso(b, agora) - diasSemAcesso(a, agora))
      return {
        total: resposta.total,
        disparaveis: resposta.disparaveis,
        previa,
        leadIds: previa.map((l) => l.id),
        diasDaPrevia: previa.map((l) => diasSemAcesso(l, agora)),
      }
    },
    // Recorte novo a cada chip: sem isto o número-herói pisca em branco.
    placeholderData: (anterior) => anterior,
  })

  return {
    total: query.data?.total ?? 0,
    disparaveis: query.data?.disparaveis ?? 0,
    previa: query.data?.previa ?? [],
    leadIds: query.data?.leadIds ?? [],
    diasDaPrevia: query.data?.diasDaPrevia ?? [],
    carregando: query.isLoading,
  }
}
