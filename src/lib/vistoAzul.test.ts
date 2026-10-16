import { describe, it, expect } from 'vitest'
import { ultimaInboundComWamid } from './vistoAzul'

const T = (h: number, m = 0) => new Date(Date.UTC(2026, 9, 16, h, m)).toISOString()

type Linha = { direction: 'inbound' | 'outbound'; message_id: string | null; created_at: string }
const inb = (message_id: string | null, created_at: string): Linha => ({
  direction: 'inbound',
  message_id,
  created_at,
})
const out = (message_id: string | null, created_at: string): Linha => ({
  direction: 'outbound',
  message_id,
  created_at,
})

describe('ultimaInboundComWamid', () => {
  it('devolve o wamid da inbound mais recente', () => {
    expect(ultimaInboundComWamid([inb('wamid.A', T(9)), inb('wamid.B', T(10))])).toBe('wamid.B')
  })

  it('ignora outbound, mesmo mais nova que a última inbound', () => {
    expect(ultimaInboundComWamid([inb('wamid.A', T(9)), out('wamid.X', T(11))])).toBe('wamid.A')
  })

  it('pula inbound sem wamid e cai na anterior que tem', () => {
    expect(ultimaInboundComWamid([inb('wamid.A', T(9)), inb(null, T(10))])).toBe('wamid.A')
  })

  it('não depende da ordem da lista', () => {
    expect(ultimaInboundComWamid([inb('wamid.B', T(10)), inb('wamid.A', T(9))])).toBe('wamid.B')
  })

  it('sem inbound com wamid, devolve null', () => {
    expect(ultimaInboundComWamid([])).toBeNull()
    expect(ultimaInboundComWamid([out('wamid.X', T(9)), inb(null, T(10))])).toBeNull()
  })
})
