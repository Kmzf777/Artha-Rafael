import { describe, expect, it } from 'vitest'
import { telNorm11 } from './phoneUtils'
import { CASOS_TELEFONE } from './telefoneCasos'

describe('telNorm11 — deve espelhar tel_norm11(text) do Postgres', () => {
  for (const caso of CASOS_TELEFONE) {
    it(`${JSON.stringify(caso.entrada)} → ${JSON.stringify(caso.esperado)} (${caso.porque})`, () => {
      expect(telNorm11(caso.entrada)).toBe(caso.esperado)
    })
  }
})
