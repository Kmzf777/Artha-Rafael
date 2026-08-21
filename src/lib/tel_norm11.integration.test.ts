// Paridade entre `telNorm11()` (TypeScript) e `tel_norm11(text)` (Postgres).
//
// A spec §2.1 chama isto de requisito duro: as duas precisam concordar, senão a
// fila, o disparo e o webhook deixam de casar e a conversa racha em dois cards.
// Este teste é a prova automática dessa concordância.
//
// PULA quando não há banco configurado. Não é teste opcional — é teste que
// espera infraestrutura. Assim que `NEXT_PUBLIC_SUPABASE_URL` e
// `SUPABASE_SERVICE_ROLE_KEY` existirem no `.env.local`, ele roda em `npm test`
// e passa a travar a paridade a cada mudança.
import '../../scripts/env'
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { telNorm11 } from './phoneUtils'
import { CASOS_TELEFONE } from './telefoneCasos'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const semBanco = !url || !key

// Preguiçoso: `describe.skipIf` ainda executa o corpo na COLETA, e
// `createClient` estoura sem URL. Construir dentro do teste é o que faz o skip
// realmente pular.
let cliente: ReturnType<typeof createClient> | null = null
function db() {
  cliente ??= createClient(url!, key!, { auth: { persistSession: false } })
  return cliente
}

describe.skipIf(semBanco)('tel_norm11(text) do Postgres espelha telNorm11()', () => {
  for (const caso of CASOS_TELEFONE) {
    it(`${JSON.stringify(caso.entrada)} → ${JSON.stringify(caso.esperado)} (${caso.porque})`, async () => {
      const { data, error } = await db().rpc('tel_norm11', { t: caso.entrada } as never)
      expect(error).toBeNull()
      // As duas pontas contra o MESMO caso: se divergirem, uma das duas mudou
      // sem a outra, e é exatamente esse o defeito que o teste existe para pegar.
      expect(data).toBe(caso.esperado)
      expect(data).toBe(telNorm11(caso.entrada))
    })
  }
})

describe.skipIf(!semBanco)('paridade tel_norm11 — sem banco', () => {
  it('registra que a paridade contra o Postgres NÃO foi verificada', () => {
    // Existe para o `npm test` não dar a impressão de que a paridade está
    // provada quando ela só não foi testada. Ver spec §9, bloqueio 1.
    expect(semBanco).toBe(true)
  })
})
