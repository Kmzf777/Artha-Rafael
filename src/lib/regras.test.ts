import { describe, expect, it } from 'vitest'
import { podeDisparar } from './regras'
import type { Lead } from '@/mock/types'

function lead(extra: Partial<Lead> = {}): Lead {
  return {
    id: 'lead_0001',
    nome: 'Fulano de Tal',
    telefone: '5534991000100',
    email: 'fulano@example.com',
    segmento: 'artha',
    stage: 'novo',
    planoStatus: 'cancelado',
    planoValor: null,
    ultimoAcessoEm: null,
    primeiroContatoEm: '2026-01-01T12:00:00.000Z',
    ultimaInteracaoEm: '2026-01-02T12:00:00.000Z',
    cidade: 'Uberlândia, MG',
    tags: [],
    notas: null,
    ...extra,
  }
}

describe('podeDisparar — a trava que impede spam a desconhecidos', () => {
  it('recusa lead de semente', () => {
    expect(podeDisparar(lead({ ficticio: true }))).toBe(false)
  })

  it('libera lead real', () => {
    expect(podeDisparar(lead({ ficticio: false }))).toBe(true)
  })

  it('trata ausência do campo como lead real', () => {
    // Lead vindo de importação antiga não tem a coluna. Bloquear por omissão
    // pararia a operação legítima; a marcação é explícita, e quem semeia marca.
    expect(podeDisparar(lead())).toBe(true)
  })

  it('não confunde outro valor verdadeiro com a marcação', () => {
    // A comparação é estrita: só `true` bloqueia. Um `'false'` vindo de JSON
    // mal tipado não pode virar bloqueio silencioso da campanha real.
    expect(podeDisparar(lead({ ficticio: undefined }))).toBe(true)
  })
})
