// Troca a senha da equipe por um cookie de sessão assinado.
//
// O cookie é `httpOnly`: JavaScript da página não o lê, então XSS não rouba a
// sessão. `sameSite: lax` porque o painel não recebe POST de outra origem.
import { NextResponse } from 'next/server'
import { COOKIE_SESSAO, criarSessao, DURACAO_PADRAO_MS, senhaConfere } from '@/lib/sessao'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { usuario, senha } = (await req.json().catch(() => ({}))) as {
    usuario?: string
    senha?: string
  }

  const usuarioEsperado = process.env.PAINEL_USUARIO ?? ''
  const senhaEsperada = process.env.PAINEL_SENHA ?? ''

  if (!usuarioEsperado || !senhaEsperada) {
    return NextResponse.json(
      { erro: 'O painel está sem credencial configurada no servidor.' },
      { status: 503 }
    )
  }

  // Os dois em tempo constante, e a mensagem de erro é a MESMA para usuário
  // errado e senha errada — dizer qual falhou entrega metade da credencial.
  const [okUsuario, okSenha] = await Promise.all([
    senhaConfere(usuario ?? '', usuarioEsperado),
    senhaConfere(senha ?? '', senhaEsperada),
  ])

  if (!okUsuario || !okSenha) {
    return NextResponse.json({ erro: 'Usuário ou senha incorretos.' }, { status: 401 })
  }

  // A senha assina a sessão: trocá-la derruba todas as sessões abertas, que é
  // o comportamento que se espera de uma troca de senha.
  const token = await criarSessao(senhaEsperada, Date.now())

  const resposta = NextResponse.json({ ok: true })
  resposta.cookies.set(COOKIE_SESSAO, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(DURACAO_PADRAO_MS / 1000),
  })
  return resposta
}
