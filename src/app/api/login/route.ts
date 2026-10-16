// Troca a senha da equipe por um cookie de sessão assinado.
//
// O cookie é `httpOnly`: JavaScript da página não o lê, então XSS não rouba a
// sessão. `sameSite: lax` porque o painel não recebe POST de outra origem.
import { NextResponse } from 'next/server'
import { COOKIE_SESSAO, credencialConfere, criarSessao, DURACAO_PADRAO_MS, lerContas } from '@/lib/sessao'
import { contaSupabaseConfere } from '@/server/contaPainel'

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

  // A principal ou qualquer conta de `PAINEL_CONTAS`, todas em tempo constante,
  // e a mensagem de erro é a MESMA para usuário errado e senha errada — dizer
  // qual falhou entrega metade da credencial.
  const contas = [
    { usuario: usuarioEsperado, senha: senhaEsperada },
    ...lerContas(process.env.PAINEL_CONTAS),
  ]

  // Só se o ambiente recusar, as contas do Supabase Auth. A ordem importa: a
  // principal não depende do Supabase estar no ar.
  const confere =
    (await credencialConfere(usuario ?? '', senha ?? '', contas)) ||
    (await contaSupabaseConfere(usuario ?? '', senha ?? ''))

  if (!confere) {
    return NextResponse.json({ erro: 'Usuário ou senha incorretos.' }, { status: 401 })
  }

  // A senha assina a sessão: trocá-la derruba todas as sessões abertas, que é
  // o comportamento que se espera de uma troca de senha. Vale também para quem
  // entrou por `PAINEL_CONTAS` ou pelo Supabase Auth: o token não diz qual
  // conta foi usada.
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
