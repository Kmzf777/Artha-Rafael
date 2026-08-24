import { describe, it, expect } from 'vitest'
import {
  MAX_BOTOES,
  MAX_TITULO,
  P1,
  P2_POR_RAMO,
  perguntaP2,
  SEGMENTO_POR_P1,
  TAG_POR_RESPOSTA,
  ehIdConhecido,
} from './roteiro'

const TODAS = [P1, ...Object.values(P2_POR_RAMO)]

describe('limites da Cloud API', () => {
  it('nenhuma pergunta passa de 3 botões', () => {
    for (const p of TODAS) expect(p.botoes.length).toBeLessThanOrEqual(MAX_BOTOES)
  })

  it('nenhum título de botão passa de 20 caracteres', () => {
    for (const p of TODAS) {
      for (const b of p.botoes) expect(b.titulo.length).toBeLessThanOrEqual(MAX_TITULO)
    }
  })

  it('nenhum corpo passa de 1024 caracteres', () => {
    for (const p of TODAS) expect(p.corpo.length).toBeLessThanOrEqual(1024)
  })
})

describe('ids', () => {
  it('são únicos em todo o roteiro', () => {
    const ids = TODAS.flatMap((p) => p.botoes.map((b) => b.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('toda resposta terminal tem tag', () => {
    // Terminal é todo botão da p1 sem ramo em P2_POR_RAMO — derivado, não
    // listado na mão, para não passar em silêncio se um ramo virar terminal.
    const terminaisP1 = P1.botoes.map((b) => b.id).filter((id) => !(id in P2_POR_RAMO))
    expect(terminaisP1.length).toBeGreaterThan(0)
    expect(terminaisP1).toContain('p1:outro')

    const terminais = [
      ...terminaisP1,
      ...Object.values(P2_POR_RAMO).flatMap((p) => p.botoes.map((b) => b.id)),
    ]
    for (const id of terminais) expect(TAG_POR_RESPOSTA[id]).toBeTruthy()
  })

  it('ehIdConhecido separa o que é do roteiro do que não é', () => {
    expect(ehIdConhecido('p1:artha')).toBe(true)
    expect(ehIdConhecido('p2:testou')).toBe(true)
    expect(ehIdConhecido('quero_voltar')).toBe(false)
    expect(ehIdConhecido(null)).toBe(false)
  })
})

describe('ramificação', () => {
  it('artha e dhana têm p2; outro não tem', () => {
    expect(perguntaP2('p1:artha')?.botoes).toHaveLength(3)
    expect(perguntaP2('p1:dhana')?.botoes).toHaveLength(3)
    expect(perguntaP2('p1:outro')).toBeNull()
  })

  it('só artha e dhana decidem segmento', () => {
    expect(SEGMENTO_POR_P1['p1:artha']).toBe('artha')
    expect(SEGMENTO_POR_P1['p1:dhana']).toBe('dhana')
    expect(SEGMENTO_POR_P1['p1:outro']).toBeUndefined()
  })
})
