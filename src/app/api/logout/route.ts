// Encerra a sessão apagando o cookie. Não há estado no servidor para limpar:
// a validade mora no próprio token assinado.
import { NextResponse } from 'next/server'
import { COOKIE_SESSAO } from '@/lib/sessao'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  const resposta = NextResponse.json({ ok: true })
  resposta.cookies.set(COOKIE_SESSAO, '', { path: '/', maxAge: 0 })
  return resposta
}
