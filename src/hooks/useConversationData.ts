'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Conversation } from '@/lib/conversationTypes'
import { BUSCA_DEBOUNCE_MS, deveBuscarNoServidor, type MatchTipo } from '@/lib/buscaConversas'
import { telNorm11 } from '@/lib/phoneUtils'
import type { Lead, QuickReply } from '@/mock/types'
import { useConversations } from './useConversations'

/**
 * O lead da conversa aberta. Era `{ contact_name, cpf }` quando o painel era de
 * crédito consignado; hoje é o Lead inteiro, porque o painel de detalhes mostra
 * segmento, plano, cidade e tags — e CPF não existe neste negócio.
 */
export type LeadSelecionado = Lead

/** Resultado da busca global. Espelha `ResultadoBusca` de `src/lib/buscaConversas` sem o CPF. */
export type ResultadoBuscaConversa = Conversation & {
  match_tipo: MatchTipo
  match_trecho: string | null
}

/** Teto de resultados da busca, o mesmo que a RPC `buscar_conversas` usava. */
const LIMITE_BUSCA = 40

/** Respostas rápidas do atendimento, da tabela `quick_replies`. */
export function useQuickReplies() {
  const { data } = useQuery({
    queryKey: ['quick-replies'],
    queryFn: () => api<QuickReply[]>('/api/quick-replies'),
    staleTime: 5 * 60_000,
  })
  return data ?? []
}

/**
 * O lead por trás do card aberto. Não há rota de lead por telefone, mas a busca
 * de `/api/leads` casa pela forma canônica (`tel_norm`) — e é ela que reconcilia
 * o wa_id de 12 dígitos da Meta com o telefone de 13 da base.
 */
export function useContactLead(conv: Conversation | null) {
  const telefone = conv?.phone ?? null

  const { data } = useQuery({
    queryKey: ['lead-da-conversa', conv?.key ?? null],
    enabled: conv !== null,
    queryFn: async () => {
      const canonico = telNorm11(telefone)
      // Card só com bsuid, ou número que não é celular brasileiro: não há por
      // onde procurar o lead.
      if (!canonico) return null
      const pagina = await api<{ leads: Lead[] }>(
        `/api/leads?${new URLSearchParams({ busca: canonico, pagina: '1' })}`
      )
      // A busca é `ilike`, então pode trazer vizinhos: quem vale é o que casa a
      // forma canônica exata.
      return pagina.leads.find((l) => telNorm11(l.telefone) === canonico) ?? null
    },
  })
  return data ?? null
}

/** Atrasa o valor para não refiltrar a cada tecla digitada. */
function useValorDebounced<T>(valor: T, ms: number): T {
  const [atrasado, setAtrasado] = useState(valor)
  useEffect(() => {
    const t = setTimeout(() => setAtrasado(valor), ms)
    return () => clearTimeout(t)
  }, [valor, ms])
  return atrasado
}

/**
 * Busca global sobre as conversas.
 *
 * Roda sobre os cards que `/api/conversas` já trouxe — nome, telefone e ÚLTIMA
 * mensagem. A busca no histórico inteiro e por tag do lead saía de uma varredura
 * de todas as mensagens, que nenhuma rota expõe; enquanto não houver
 * `/api/conversas/busca`, esses dois recortes não aparecem. O debounce fica: o
 * comportamento de digitação que a operadora conhece não muda.
 */
export function useBuscaConversas(termo: string) {
  const digitado = termo.trim()
  const busca = useValorDebounced(digitado, BUSCA_DEBOUNCE_MS)
  const ativa = deveBuscarNoServidor(busca)
  const aguardandoDebounce = deveBuscarNoServidor(digitado) && digitado !== busca
  const { conversas } = useConversations()

  const achados = useMemo(() => {
    if (!ativa) return []
    const q = busca.toLowerCase()
    const digitos = q.replace(/\D/g, '')
    const resultado: ResultadoBuscaConversa[] = []

    for (const card of conversas) {
      if (resultado.length >= LIMITE_BUSCA) break
      const nome = card.contact_name ?? ''
      if (nome.toLowerCase().includes(q)) {
        resultado.push({ ...card, match_tipo: 'nome', match_trecho: nome })
        continue
      }
      if (digitos.length >= 2 && (card.phone ?? '').includes(digitos)) {
        resultado.push({ ...card, match_tipo: 'telefone', match_trecho: card.phone })
        continue
      }
      const mensagem = card.last_message ?? ''
      if (mensagem.toLowerCase().includes(q)) {
        resultado.push({ ...card, match_tipo: 'mensagem', match_trecho: mensagem })
      }
    }
    return resultado
  }, [ativa, busca, conversas])

  return {
    // `null` = sem busca ativa; `[]` = buscou e não achou nada. A UI distingue.
    resultados: deveBuscarNoServidor(digitado) ? achados : null,
    buscando: aguardandoDebounce,
  }
}
