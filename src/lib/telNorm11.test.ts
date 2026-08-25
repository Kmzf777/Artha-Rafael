import { describe, expect, it } from 'vitest'
import { telNorm11, toBrazilPhone } from './phoneUtils'
import { CASOS_TELEFONE } from './telefoneCasos'

describe('telNorm11 — deve espelhar tel_norm11(text) do Postgres', () => {
  for (const caso of CASOS_TELEFONE) {
    it(`${JSON.stringify(caso.entrada)} → ${JSON.stringify(caso.esperado)} (${caso.porque})`, () => {
      expect(telNorm11(caso.entrada)).toBe(caso.esperado)
    })
  }
})

// ── toBrazilPhone ───────────────────────────────────────────────────────────
// A outra metade da moeda de `telNorm11`. Uma produz a forma de COMPARAÇÃO (11
// dígitos, sem DDI, que casa webhook, base e fila); a outra produz a forma de
// DESTINO, que é a única que a Meta consegue entregar.
//
// Estes testes existem por um incidente: o bot de qualificação mandava para a
// forma canônica. A Meta aceitava, devolvia wamid, e só o callback de status
// depois trazia 131026 "Message undeliverable" — falha silenciosa que custou uma
// sessão inteira de depuração para achar.
describe('toBrazilPhone', () => {
  it('repõe o DDI na forma canônica de 11 dígitos', () => {
    expect(toBrazilPhone('34988861441')).toBe('5534988861441')
  })

  it('repõe o DDI em número de 10 dígitos, sem inventar o nono', () => {
    expect(toBrazilPhone('3433221100')).toBe('553433221100')
  })

  it('deixa intacto quem já vem com DDI', () => {
    expect(toBrazilPhone('5534988861441')).toBe('5534988861441')
  })

  it('limpa formatação humana', () => {
    expect(toBrazilPhone('+55 (34) 98886-1441')).toBe('5534988861441')
    expect(toBrazilPhone('(34) 98886-1441')).toBe('5534988861441')
  })

  it('é idempotente — aplicar duas vezes não muda nada', () => {
    for (const t of ['34988861441', '5534988861441', '+55 (34) 98886-1441', '3433221100']) {
      expect(toBrazilPhone(toBrazilPhone(t))).toBe(toBrazilPhone(t))
    }
  })
})
