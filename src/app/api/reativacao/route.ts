// GET /api/reativacao — o recorte da campanha.
//
// `recorteReativacao` começa por `ehInativo`, a mesma função que alimenta o
// número de inativos do Dashboard. Sem filtro nenhum, o `total` daqui é
// exatamente o inativos de `/api/metrics`. Critério de aceitação 7.
import { NextResponse } from 'next/server'
import {
  FAIXAS_SEM_ACESSO,
  recorteReativacao,
  type FaixaSemAcesso,
  type FiltroRecorte, podeDisparar,
} from '@/lib/regras'
import { todosOsLeads } from '@/server/repo/leads'

export const dynamic = 'force-dynamic'

/** `diasSemAcesso` é a união fechada dos chips da tela, não um número livre. */
function faixa(valor: string | null): FaixaSemAcesso | undefined {
  const n = Number(valor)
  return FAIXAS_SEM_ACESSO.find((f) => f === n)
}

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams
  const filtro: FiltroRecorte = {
    diasSemAcesso: faixa(p.get('diasSemAcesso')),
    segmento: (p.get('segmento') ?? undefined) as FiltroRecorte['segmento'],
    planoStatus: (p.get('planoStatus') ?? undefined) as FiltroRecorte['planoStatus'],
  }

  // DOIS números, e a distinção importa:
  //
  //  · `total`       — o recorte inteiro. É o número-herói da tela, e sem
  //                    filtro tem de bater exatamente com `inativos` do
  //                    Dashboard. Filtrar aqui faria as duas telas discordarem.
  //  · `disparaveis` — quantos desses o motor de disparo aceita, depois de
  //                    `podeDisparar`. É o que `POST /api/campanhas` vai de
  //                    fato enfileirar.
  //
  // Numa base semeada os dois divergem (todo lead da semente é fictício), e
  // esconder isso seria pior dos dois jeitos: filtrar zera a tela que vende o
  // projeto; não filtrar faz o botão prometer 612 e o servidor entregar 0. A
  // tela mostra os dois e explica a diferença.
  const todos = await todosOsLeads()
  const agora = new Date()
  const leads = recorteReativacao(todos, filtro, agora)
  const disparaveis = recorteReativacao(todos.filter(podeDisparar), filtro, agora)

  return NextResponse.json({
    leads: leads.slice(0, 10),
    total: leads.length,
    disparaveis: disparaveis.length,
  })
}
