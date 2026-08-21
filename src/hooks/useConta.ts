'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

/**
 * Dados do número que realmente envia, vindos da Graph API por `/api/conta`.
 *
 * O tipo mora aqui, e não em `src/mock/`, porque não há nada de fictício nele:
 * é a resposta da Meta traduzida. A rota importa este mesmo tipo, para não
 * existirem duas definições do que a tela recebe.
 */
export type Conta = {
  /** ID do número na Meta (`WHATSAPP_PHONE_NUMBER_ID`). */
  id: string
  /** Já formatado pela Meta: "+55 34 9211-4080". */
  telefone: string
  /** Nome de exibição registrado. Só chega a quem recebe se estiver aprovado. */
  nomeExibicao: string
  /** `GREEN` | `YELLOW` | `RED` | `UNKNOWN`. */
  qualidade: string
  /** `VERIFIED` | `NOT_VERIFIED` | `EXPIRED`. */
  verificacao: string
  /** `APPROVED` | `DECLINED` | `PENDING_REVIEW` | `AVAILABLE_WITHOUT_REVIEW`. */
  statusDoNome: string
}

export const CHAVE_CONTA = ['conta'] as const

/**
 * Número conectado. `conta` é `null` enquanto a Graph não responde e continua
 * `null` se ela falhar — a tela de Configurações é onde o operador CONFERE qual
 * número está no ar, e um número inventado ali é pior que um campo vazio.
 */
export function useConta(): { conta: Conta | null; carregando: boolean } {
  const query = useQuery({
    queryKey: CHAVE_CONTA,
    queryFn: () => api<Conta>('/api/conta'),
    staleTime: 5 * 60_000,
  })

  return { conta: query.data ?? null, carregando: query.isPending }
}
