import { describe, expect, it } from 'vitest'
import { contarFunilEntrega } from './funilCampanha'

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
