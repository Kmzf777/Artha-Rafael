// POST /api/templates/sync — puxa da Meta e reescreve o cache local.
import { NextResponse } from 'next/server'
import { sincronizarTemplates } from '@/server/repo/templates'

export const dynamic = 'force-dynamic'

export async function POST() {
  return NextResponse.json({ sincronizados: await sincronizarTemplates() })
}
