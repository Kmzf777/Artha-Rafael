// PATCH /api/leads/[id] — move o lead de etapa no funil.
import { NextResponse } from 'next/server'
import type { FunnelStage } from '@/mock/types'
import { mudarEtapaLead } from '@/server/repo/leads'

export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // No Next.js 16 `params` é uma Promise. Sem o `await`, `id` seria o objeto
  // inteiro: compila, e em runtime a consulta não casa linha nenhuma.
  const { id } = await params
  const { stage } = (await req.json()) as { stage: FunnelStage }
  return NextResponse.json(await mudarEtapaLead(id, stage))
}
