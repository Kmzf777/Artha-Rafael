// src/app/api/midia/[id]/route.ts
// Redireciona para a URL assinada. A tela põe /api/midia/<media_id> no src e
// não precisa saber nada de Storage.
import { NextResponse } from 'next/server'
import { urlAssinada } from '@/server/repo/midia'
import { db } from '@/server/supabase'

export const dynamic = 'force-dynamic'

// `params` é uma Promise no Next.js 16 — sem o `await` isto compila e quebra em
// runtime.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data } = await db()
    .from('messages').select('media_storage_path').eq('media_id', id).maybeSingle()
  const caminho = (data?.media_storage_path ?? null) as string | null
  if (!caminho) return NextResponse.json({ erro: 'mídia não arquivada' }, { status: 404 })

  const url = await urlAssinada(caminho)
  if (!url) return NextResponse.json({ erro: 'falha ao assinar' }, { status: 502 })
  return NextResponse.redirect(url)
}
