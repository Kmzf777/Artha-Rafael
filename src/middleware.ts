// Basic auth no painel inteiro. Medida MÍNIMA até o B5 trazer autenticação de
// verdade, e não substituto dela.
//
// Por que existe: o webhook da Meta exige que a aplicação esteja numa URL
// pública HTTPS. No instante em que ela está, `/api/campanhas` e
// `/api/mensagens` ficam abertos na mesma origem — e essas rotas gastam
// dinheiro e mandam WhatsApp real para a base do cliente. Publicar sem isto é
// deixar o disparo em massa aberto na internet.
//
// Duas exceções, ambas com autenticação própria:
//   · /api/webhook        — a Meta não manda basic auth; ela assina o corpo com
//                           HMAC-SHA256, verificado em `meta/assinatura.ts`.
//   · /api/fila/processar — protegido por CRON_SECRET no header, porque quem
//                           chama é um cron, não um navegador.
import { NextResponse, type NextRequest } from 'next/server'

const LIVRES = ['/api/webhook', '/api/fila/processar']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (LIVRES.some((rota) => pathname.startsWith(rota))) return NextResponse.next()

  const usuario = process.env.PAINEL_USUARIO
  const senha = process.env.PAINEL_SENHA

  // Sem credencial configurada o painel fica aberto — é o modo de
  // desenvolvimento em localhost. Em produção, configurar é obrigatório.
  if (!usuario || !senha) return NextResponse.next()

  const header = req.headers.get('authorization') ?? ''
  if (header.startsWith('Basic ')) {
    const [u, s] = atob(header.slice(6)).split(':')
    if (u === usuario && s === senha) return NextResponse.next()
  }

  return new NextResponse('Autenticação necessária.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Artha", charset="UTF-8"' },
  })
}

export const config = {
  // Tudo menos os estáticos do Next e o favicon.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
}
