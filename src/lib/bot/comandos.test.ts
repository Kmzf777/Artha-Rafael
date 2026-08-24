import { describe, it, expect } from 'vitest'
import { ehComandoReset, podeResetar } from './comandos'

describe('ehComandoReset', () => {
  it('casa o comando exato, em qualquer caixa, com espaço em volta', () => {
    expect(ehComandoReset('!reset')).toBe(true)
    expect(ehComandoReset('!RESET')).toBe(true)
    expect(ehComandoReset('  !Reset  ')).toBe(true)
  })

  it('não casa nada além disso', () => {
    expect(ehComandoReset('reset')).toBe(false)
    expect(ehComandoReset('!reset agora')).toBe(false)
    expect(ehComandoReset('quero !reset')).toBe(false)
    expect(ehComandoReset('!resetar')).toBe(false)
    expect(ehComandoReset('')).toBe(false)
    expect(ehComandoReset(null)).toBe(false)
  })
})

describe('podeResetar', () => {
  it('lista vazia desliga o comando — é o padrão', () => {
    expect(podeResetar('34988861441', '')).toBe(false)
    expect(podeResetar('34988861441', '   ')).toBe(false)
  })

  it('reconhece o mesmo telefone em formas diferentes', () => {
    // 5534988861441 (wa_id da Meta) e 34988861441 (canônico) são a mesma pessoa.
    expect(podeResetar('34988861441', '5534988861441')).toBe(true)
    expect(podeResetar('5534988861441', '34988861441')).toBe(true)
    expect(podeResetar('34988861441', '+55 (34) 98886-1441')).toBe(true)
  })

  it('aceita lista com vários, tolerando espaço', () => {
    const lista = ' 5534988861441 , 5511999998888 '
    expect(podeResetar('34988861441', lista)).toBe(true)
    expect(podeResetar('11999998888', lista)).toBe(true)
  })

  it('recusa quem não está na lista', () => {
    expect(podeResetar('11999998888', '5534988861441')).toBe(false)
    expect(podeResetar(null, '5534988861441')).toBe(false)
    expect(podeResetar('', '5534988861441')).toBe(false)
  })

  it('recusa lixo que não vira telefone', () => {
    expect(podeResetar('34988861441', 'sim')).toBe(false)
    expect(podeResetar('nao-e-telefone', '5534988861441')).toBe(false)
  })
})
