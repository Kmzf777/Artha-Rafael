// As regras mudaram para `src/lib/regras.ts` (spec §5.2) — elas são regra de
// negócio e o servidor precisa delas sem arrastar o dataset fictício junto.
//
// Este módulo permanece como adaptador: aplica o store em memória e a âncora
// temporal da demo, preservando a assinatura que os testes e as telas já usam.
// Ler do store (e não de `LEADS`) é o que faz a métrica acompanhar a mutação —
// mudar a etapa de um lead move o funil na tela.

import * as regras from '@/lib/regras'
import { agoraDemo } from './db'
import {
  listarAgendamentos,
  listarCampanhas,
  listarConversas,
  listarLeads,
  listarMensagens,
} from './store'
import type { Lead } from './types'

export { DIAS_SEM_ACESSO_INATIVO, FAIXAS_SEM_ACESSO, ehAtivo, ehInativo } from '@/lib/regras'
export type { FaixaSemAcesso, FiltroRecorte, Metrics } from '@/lib/regras'

export function diasSemAcesso(lead: Lead, agora: Date = agoraDemo()): number {
  return regras.diasSemAcesso(lead, agora)
}

export function recorteReativacao(
  filtro: regras.FiltroRecorte = {},
  agora: Date = agoraDemo()
): Lead[] {
  return regras.recorteReativacao(listarLeads(), filtro, agora)
}

export function getMetrics(agora: Date = agoraDemo()): regras.Metrics {
  return regras.getMetrics(
    {
      leads: listarLeads(),
      conversas: listarConversas(),
      mensagens: listarMensagens(),
      campanhas: listarCampanhas(),
      agendamentos: listarAgendamentos(),
    },
    agora
  )
}
