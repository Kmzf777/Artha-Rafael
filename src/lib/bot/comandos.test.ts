import { describe, it, expect } from 'vitest'
import { ehComandoReset } from './comandos'

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
