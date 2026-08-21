'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { camposParaVariaveis, motivoNaoPreenchivel } from '@/lib/disparos'
import type { FiltroRecorte } from '@/lib/regras'
import { contarVariaveis } from '@/lib/templates'
import type { Agendamento, Campanha, Segmento, Template } from '@/mock/types'
import { CHAVE_AGENDAMENTOS } from './useAgendamentos'
import { CHAVE_METRICS } from './useMetrics'
import { CHAVE_TEMPLATES } from './useTemplates'

export const CHAVE_CAMPANHAS = ['campanhas'] as const

export type EnfileirarCampanhaArgs = {
  nome: string
  /** Nome do template aprovado (ver `useTemplates`). */
  template: string
  segmentoAlvo: Segmento | 'todos'
  /** Ids dos leads do recorte — vêm de `useReativacaoRecorte().leadIds`. */
  leadIds: string[]
  /**
   * O recorte como a tela o montou. Quem resolve os leads agora é o servidor
   * (`POST /api/campanhas` roda `recorteReativacao` sobre a base inteira), então
   * é o FILTRO que precisa viajar, não a lista de ids. Ausente, só o segmento
   * chega, e a fila sai maior que o total que a tela anunciou.
   */
  filtro?: FiltroRecorte
}

/** Campanhas, da mais recente para a mais antiga. */
export function useCampanhas(): { campanhas: Campanha[]; carregando: boolean } {
  const query = useQuery({
    queryKey: CHAVE_CAMPANHAS,
    queryFn: () => api<Campanha[]>('/api/campanhas'),
  })
  return { campanhas: query.data ?? [], carregando: query.isLoading }
}

/**
 * Enfileira uma campanha de verdade: cria a campanha e um agendamento
 * `pendente` por lead do recorte. Nada sai daqui — quem fala com a Meta é o
 * worker de `/api/fila/processar`.
 */
export function useEnfileirarCampanha() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (args: EnfileirarCampanhaArgs) => {
      // Um parâmetro POR VARIÁVEL do corpo, na ordem de `CAMPOS_DE_VARIAVEL`.
      // Mandar sempre um só, como antes, matava todo template de duas
      // variáveis: a Meta recusa por parâmetros insuficientes (132000), gasta
      // três tentativas e leva a campanha inteira a `falhou`.
      const templates = queryClient.getQueryData<Template[]>(CHAVE_TEMPLATES) ?? []
      const corpo = templates.find((t) => t.nome === args.template)?.corpo ?? ''
      const quantidade = contarVariaveis(corpo)

      // As duas telas já desabilitam o template que pede mais variáveis do que
      // existe campo. Esta é a última trava antes de enfileirar centenas de
      // agendamentos que nasceriam condenados.
      const impedimento = motivoNaoPreenchivel(quantidade)
      if (impedimento) throw new Error(impedimento)
      const variaveisPorLead = camposParaVariaveis(quantidade)

      const resposta = await api<{
        campanhaId: string
        enfileirados: number
        recorte: number
        primeiroEm: string
        espacamentoSegundos: number
      }>('/api/campanhas', {
        method: 'POST',
        body: JSON.stringify({
          nome: args.nome,
          template: args.template,
          filtro: args.filtro ?? { segmento: args.segmentoAlvo },
          variaveisPorLead,
        }),
      })

      // A rota devolve o id da campanha e QUANTOS entraram na fila, não as
      // linhas. A campanha recém-criada tem contador zerado — isso é fato, não
      // suposição; os agendamentos são reconstruídos a partir do que se sabe
      // deles no instante da criação (template, situação e horário são os
      // mesmos para todos; id e lead só existem no banco).
      const criadaEm = new Date().toISOString()
      const campanha: Campanha = {
        id: resposta.campanhaId,
        nome: args.nome,
        template: args.template,
        criadaEm,
        segmentoAlvo: args.segmentoAlvo,
        enviados: 0,
        entregues: 0,
        respondidos: 0,
        qualificados: 0,
        convertidos: 0,
      }
      // O horário de cada linha é o que o SERVIDOR gravou: primeiro envio em
      // `primeiroEm`, os seguintes espaçados. A tela de confirmação lê daqui em
      // vez de estimar por conta própria.
      const inicio = new Date(resposta.primeiroEm).getTime()
      const passoMs = resposta.espacamentoSegundos * 1_000
      const agendamentos: Agendamento[] = Array.from(
        { length: resposta.enfileirados },
        (_, i) => ({
          id: '',
          leadId: '',
          template: args.template,
          agendadoPara: new Date(inicio + i * passoMs).toISOString(),
          status: 'pendente',
          tentativas: 0,
          erro: null,
        })
      )

      return { campanha, agendamentos }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CHAVE_CAMPANHAS })
      void queryClient.invalidateQueries({ queryKey: CHAVE_AGENDAMENTOS })
      void queryClient.invalidateQueries({ queryKey: CHAVE_METRICS })
    },
  })
}
