// src/app/api/fila/processar/route.ts
// Porta do cron para o worker. A lógica está em `src/server/fila.ts`, que
// `/api/fila/disparar-agora` também chama — aqui só mora a autorização.
//
// Sem esta rota ser CHAMADA por alguém, uma campanha de 612 leads fica 612
// agendamentos `pendente` para sempre. Quem chama é o cron declarado em
// `vercel.json`; em desenvolvimento, o botão de Agendamentos.
import { NextResponse } from 'next/server'
import { env } from '@/server/env'
import { processarFila } from '@/server/fila'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Duas formas do mesmo segredo, porque são dois chamadores:
 *   · `x-cron-secret`          — o disparo manual por curl, e o que o
 *                                `src/middleware.ts` documenta.
 *   · `Authorization: Bearer`  — a única forma que o cron da Vercel manda.
 * Aceitar as duas é o que evita ter de escolher entre o cron e a mão.
 */
function autorizado(req: Request): boolean {
  const segredo = env.cronSecret
  return (
    req.headers.get('x-cron-secret') === segredo ||
    req.headers.get('authorization') === `Bearer ${segredo}`
  )
}

export async function POST(req: Request) {
  // Primeira linha, antes de qualquer acesso a banco: quem não tem o segredo
  // não move a fila nem descobre se ela existe.
  if (!autorizado(req)) {
    return NextResponse.json({ erro: 'não autorizado' }, { status: 401 })
  }
  return NextResponse.json(await processarFila())
}

/**
 * O cron da Vercel dispara GET, não POST. Delegar mantém uma implementação só,
 * e a exigência do segredo continua valendo — é o mesmo `autorizado`.
 */
export async function GET(req: Request) {
  return POST(req)
}
