// src/app/api/conversas/[key]/mensagens/route.ts
// A timeline de um card, em ordem cronológica.
import { NextResponse } from 'next/server'
import { mensagensDoCard } from '@/server/repo/mensagens'

export const dynamic = 'force-dynamic'

// `params` é uma Promise no Next.js 16 — sem o `await` isto compila e quebra em
// runtime. A chave (`identidade::phone_id`) viaja com os dois-pontos
// percent-encoded, daí o `decodeURIComponent`.
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  return NextResponse.json(await mensagensDoCard(decodeURIComponent(key)))
}
