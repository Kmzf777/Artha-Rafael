// src/app/api/conversas/[key]/lida/route.ts
// Marca o card como lido até agora — é o que zera o contador de não-lidas.
import { NextResponse } from 'next/server'
import { marcarCardLido } from '@/server/repo/mensagens'

export const dynamic = 'force-dynamic'

// `params` é uma Promise no Next.js 16 — sem o `await` isto compila e quebra em
// runtime. A chave (`identidade::phone_id`) viaja com os dois-pontos
// percent-encoded, daí o `decodeURIComponent`.
export async function POST(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  await marcarCardLido(decodeURIComponent(key))
  return NextResponse.json({ ok: true })
}
