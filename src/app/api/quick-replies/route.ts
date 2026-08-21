// src/app/api/quick-replies/route.ts
// Respostas rápidas do atendimento. Spec §5.1.
import { NextResponse } from 'next/server'
import { db } from '@/server/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await db().from('quick_replies').select('*').order('shortcut')
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const { shortcut, message } = (await req.json()) as { shortcut: string; message: string }
  // Upsert por `shortcut` (o unique da tabela): reeditar um atalho existente é
  // o caso comum, e um insert cru devolveria conflito.
  const { data, error } = await db()
    .from('quick_replies').upsert({ shortcut, message }, { onConflict: 'shortcut' }).select('*').single()
  if (error) return NextResponse.json({ erro: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const { id } = (await req.json()) as { id: string }
  await db().from('quick_replies').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
