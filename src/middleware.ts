// Proteção de rota do painel.
//
// Antes daqui isto era basic auth, que funcionava mas abria o diálogo nativo do
// navegador: sem marca, sem logout, e reaparecendo a cada janela anônima. Agora
// é sessão por cookie assinado, com página própria em `/login`.
//
// O modelo de segurança é o mesmo: UMA credencial compartilhada pela equipe.
// Contas por pessoa são o recorte B5. O que mudou é a experiência, não o rigor.
//
// Por que existe: o webhook exige que a aplicação esteja numa URL pública. No
// instante em que está, `/api/mensagens` e `/api/campanhas` ficam alcançáveis —
// e essas rotas gastam dinheiro e mandam WhatsApp real para a base do cliente.
import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE_SESSAO, sessaoValida } from '@/lib/sessao'

/** Rotas que NÃO passam pela sessão, cada uma com autenticação própria. */
const LIVRES = [
  '/api/webhook', // a Meta assina o corpo com HMAC (`meta/assinatura.ts`)
  '/api/fila/processar', // CRON_SECRET no header, chamada por cron
  '/api/login', // é aqui que a sessão nasce
  '/api/logout',
  '/login', // a própria tela de entrada
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (LIVRES.some((rota) => pathname.startsWith(rota))) return NextResponse.next()

  const senha = process.env.PAINEL_SENHA
  // Sem credencial configurada o painel fica aberto — modo de desenvolvimento
  // em localhost. Em produção, configurar é obrigatório (ver DEPLOY.md §5).
  if (!senha) return NextResponse.next()

  if (await sessaoValida(req.cookies.get(COOKIE_SESSAO)?.value, senha, Date.now())) {
    return NextResponse.next()
  }

  // API responde JSON; página redireciona. Mandar HTML de login para um `fetch`
  // faria o cliente engasgar tentando parsear, em vez de tratar o 401.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ erro: 'nao_autenticado' }, { status: 401 })
  }

  const destino = req.nextUrl.clone()
  destino.pathname = '/login'
  destino.search = ''
  // Para onde voltar depois de entrar. Só o caminho — URL absoluta aqui viraria
  // redirecionamento aberto para outro domínio.
  if (pathname !== '/') destino.searchParams.set('de', pathname + req.nextUrl.search)
  return NextResponse.redirect(destino)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
}
