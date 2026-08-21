import { describe, it, expect } from 'vitest'
import { saoPauloLocalToUtcISO, formatScheduledAt, resolveDeliveryOutcome } from './scheduling'

describe('saoPauloLocalToUtcISO', () => {
  it('converte horário de Brasília (UTC-3) para UTC ISO', () => {
    expect(saoPauloLocalToUtcISO('2026-07-02T14:30')).toBe('2026-07-02T17:30:00.000Z')
  })
  it('vira o dia quando passa da meia-noite em UTC', () => {
    expect(saoPauloLocalToUtcISO('2026-07-02T22:30')).toBe('2026-07-03T01:30:00.000Z')
  })
})

describe('formatScheduledAt', () => {
  it('exibe em dd/mm/aaaa hh:mm no fuso de São Paulo', () => {
    // 17:30 UTC = 14:30 em São Paulo
    expect(formatScheduledAt('2026-07-02T17:30:00.000Z')).toMatch(/02\/07\/2026.*14:30/)
  })
})

describe('resolveDeliveryOutcome', () => {
  it('sucesso: marca sent e incrementa attempts', () => {
    expect(resolveDeliveryOutcome(0, true)).toEqual({ status: 'sent', attempts: 1 })
  })
  it('falha antes do teto: volta para pending', () => {
    expect(resolveDeliveryOutcome(0, false)).toEqual({ status: 'pending', attempts: 1 })
    expect(resolveDeliveryOutcome(1, false)).toEqual({ status: 'pending', attempts: 2 })
  })
  it('falha na 3ª tentativa: marca failed', () => {
    expect(resolveDeliveryOutcome(2, false)).toEqual({ status: 'failed', attempts: 3 })
  })
  // 'sending' é marcado exclusivamente pelo cron, via compare-and-swap, antes do
  // POST à Meta. Se esta função passasse a devolvê-lo, uma linha ja enviada
  // poderia ser reprocessada como se ainda estivesse a caminho.
  it('nunca devolve sending (estado exclusivo do CAS no cron)', () => {
    for (const attempts of [0, 1, 2, 3, 10]) {
      expect(resolveDeliveryOutcome(attempts, true).status).not.toBe('sending')
      expect(resolveDeliveryOutcome(attempts, false).status).not.toBe('sending')
    }
  })
})
