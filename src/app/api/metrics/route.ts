// GET /api/metrics — os números do Dashboard.
//
// `getMetrics` recebe um PACOTE, não só leads: o tipo `Metrics` tem seções de
// conversas, mensagens, campanhas e agendamentos. Os campos são obrigatórios de
// propósito — default `[]` produziria um dashboard com zeros silenciosos.
//
// O total de inativos daqui sai de `ehInativo`, a MESMA função que
// `/api/reativacao` usa por baixo de `recorteReativacao`. É por isso que os dois
// números batem. Critério de aceitação 7.
import { NextResponse } from 'next/server'
import { getMetrics } from '@/lib/regras'
import { listarAgendamentos, listarCampanhas } from '@/server/repo/campanhas'
import { todosOsLeads } from '@/server/repo/leads'
import { conversasEMensagens } from '@/server/repo/mensagens'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [leads, campanhas, agendamentos, conversa] = await Promise.all([
    todosOsLeads(),
    listarCampanhas(),
    listarAgendamentos(),
    // Forma de DOMÍNIO. `listarCardsDeConversa()` devolve a forma de fio, que
    // não é a que `DadosMetrics` espera.
    conversasEMensagens(),
  ])

  return NextResponse.json(
    getMetrics(
      {
        leads,
        conversas: conversa.conversas,
        mensagens: conversa.mensagens,
        campanhas,
        agendamentos,
      },
      new Date()
    )
  )
}
