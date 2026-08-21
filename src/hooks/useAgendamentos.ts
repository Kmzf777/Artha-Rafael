'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Agendamento, AgendamentoStatus, Lead } from '@/mock/types'
import { CHAVE_METRICS } from './useMetrics'

export const CHAVE_AGENDAMENTOS = ['agendamentos'] as const

/** A tabela precisa do nome e do telefone do destinatário, não só do id. */
export type AgendamentoComLead = Agendamento & { lead: Lead | null }

export type ResumoFila = Record<AgendamentoStatus, number> & { total: number }

const NA_FILA: AgendamentoStatus[] = ['pendente', 'enviando']

function organizar(todos: AgendamentoComLead[]): {
  agendamentos: AgendamentoComLead[]
  resumo: ResumoFila
} {
  // A fila de verdade primeiro (o próximo a sair no topo); depois o histórico,
  // do mais recente para o mais antigo. Enfileirar uma campanha tem de ser
  // visível na hora, e não enterrado no fim de 40 linhas.
  const na = (a: AgendamentoComLead) => NA_FILA.includes(a.status)
  const ts = (a: AgendamentoComLead) => new Date(a.agendadoPara).getTime()
  const agendamentos = todos.slice().sort((a, b) => {
    if (na(a) !== na(b)) return na(a) ? -1 : 1
    return na(a) ? ts(a) - ts(b) : ts(b) - ts(a)
  })

  const resumo: ResumoFila = {
    pendente: 0, enviando: 0, enviado: 0, falhou: 0, cancelado: 0, total: todos.length,
  }
  for (const a of todos) resumo[a.status] += 1

  return { agendamentos, resumo }
}

/**
 * Fila de disparos agendados, com resumo por status e ação de cancelar.
 * Só `pendente` é cancelável: em `enviando` o POST já saiu e cancelar seria
 * mentira na tela.
 *
 * LACUNA CONHECIDA: `GET /api/agendamentos` devolve `Agendamento[]` puro, sem o
 * lead. Não há rota que busque leads por id em lote, então `lead` fica `null` e
 * a coluna Destinatário cai no texto de contato ausente. O conserto é a rota
 * fazer o join — não cabe aqui.
 */
export function useAgendamentos() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: CHAVE_AGENDAMENTOS,
    queryFn: async () => {
      // A rota já devolve o lead resolvido — inventar `null` aqui faria a tela
      // mostrar "Contato removido" em toda linha.
      return organizar(await api<AgendamentoComLead[]>('/api/agendamentos'))
    },
  })

  const mutation = useMutation({
    mutationFn: (id: string) =>
      api<{ ok: true }>('/api/agendamentos', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CHAVE_AGENDAMENTOS })
      void queryClient.invalidateQueries({ queryKey: CHAVE_METRICS })
    },
  })

  return {
    agendamentos: query.data?.agendamentos ?? [],
    resumo: query.data?.resumo ?? {
      pendente: 0, enviando: 0, enviado: 0, falhou: 0, cancelado: 0, total: 0,
    },
    carregando: query.isLoading,
    cancelar: (id: string) => mutation.mutate(id),
    cancelando: mutation.isPending,
  }
}

/** Um agendamento só sai da fila enquanto ainda não foi entregue à Meta. */
export function podeCancelar(agendamento: Agendamento): boolean {
  return agendamento.status === 'pendente'
}
