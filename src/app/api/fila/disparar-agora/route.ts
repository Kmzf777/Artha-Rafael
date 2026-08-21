// src/app/api/fila/disparar-agora/route.ts
// O mesmo worker de `/api/fila/processar`, chamado pelo botão de Agendamentos.
//
// Existe porque em desenvolvimento não há cron: sem um gatilho manual, a fila só
// drenaria em produção. E não pede `CRON_SECRET` porque o segredo é de servidor
// — mandá-lo ao browser para o browser devolvê-lo seria publicá-lo.
//
// A proteção aqui é o basic auth do `src/middleware.ts`, que cobre esta rota
// justamente por ela NÃO estar na lista de exceções de lá. Acrescentá-la àquela
// lista abriria o disparo em massa na internet.
import { NextResponse } from 'next/server'
import { processarFila } from '@/server/fila'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST() {
  return NextResponse.json(await processarFila())
}
