// src/app/api/agendamentos/route.ts
// A fila como a tela de Disparos a lê, e o cancelamento de um item pendente.
import { NextResponse } from 'next/server'
import { cancelarAgendamento, listarAgendamentos } from '@/server/repo/campanhas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(await listarAgendamentos())
}

export async function DELETE(req: Request) {
  const { id } = (await req.json()) as { id?: string }
  if (!id) return NextResponse.json({ erro: 'id ausente' }, { status: 400 })

  // `cancelarAgendamento` só atinge linha `pendente`: um item já reservado pelo
  // worker (status `enviando`) não pode ser cancelado, a mensagem está saindo.
  await cancelarAgendamento(id)
  return NextResponse.json({ ok: true })
}
