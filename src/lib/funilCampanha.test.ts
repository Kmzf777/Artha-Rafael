import { describe, expect, it } from 'vitest'
import { contarFunilEntrega, numeroComPercentual } from './funilCampanha'

describe('contarFunilEntrega', () => {
  it('conta lidos só como status lido e entregues como entregue ou lido', () => {
    const msgs = [
      { status: 'enviado' },
      { status: 'entregue' },
      { status: 'lido' },
      { status: 'lido' },
      { status: 'falhou' },
    ]
    expect(contarFunilEntrega(msgs)).toEqual({ enviados: 5, entregues: 3, lidos: 2 })
  })

  it('lista vazia zera tudo', () => {
    expect(contarFunilEntrega([])).toEqual({ enviados: 0, entregues: 0, lidos: 0 })
  })
})

describe('numeroComPercentual', () => {
  it('mostra o número e o percentual sobre enviados', () => {
    expect(numeroComPercentual(12, 15)).toBe('12 · 80%')
  })

  it('arredonda ao inteiro mais próximo', () => {
    expect(numeroComPercentual(1, 3)).toBe('1 · 33%')
    expect(numeroComPercentual(2, 3)).toBe('2 · 67%')
  })

  it('enviados 0 mostra só o número, sem percentual', () => {
    expect(numeroComPercentual(0, 0)).toBe('0')
  })
})
