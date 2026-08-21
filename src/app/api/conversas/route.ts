// src/app/api/conversas/route.ts
// Os cards da lista + o contador de não-lidas por card.
import { NextResponse } from 'next/server'
import { listarCardsDeConversa } from '@/server/repo/mensagens'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(await listarCardsDeConversa())
}
