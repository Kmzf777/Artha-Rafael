// GET /api/leads — a página da tabela de Leads, com os filtros da tela.
// Toda a régua de filtro, busca e paginação vive em `listarLeads`; aqui só se
// traduz query string em `FiltroLeads`.
import { NextResponse } from 'next/server'
import type { FiltroLeads } from '@/hooks/useLeads'
import { listarLeads } from '@/server/repo/leads'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams
  const filtro: FiltroLeads = {
    segmento: (p.get('segmento') ?? 'todos') as FiltroLeads['segmento'],
    stage: (p.get('stage') ?? 'todos') as FiltroLeads['stage'],
    planoStatus: (p.get('planoStatus') ?? 'todos') as FiltroLeads['planoStatus'],
    busca: p.get('busca') ?? '',
    // `|| 1` cobre ausente, vazio e lixo: `Number('abc')` é NaN, e NaN chega
    // como `range(NaN, NaN)` no PostgREST — página vazia sem erro nenhum.
    pagina: Number(p.get('pagina')) || 1,
  }
  return NextResponse.json(await listarLeads(filtro))
}
