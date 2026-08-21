import { describe, it, expect } from 'vitest'
import { getWindowStatus } from './janela24h'
import { conversationKey } from './conversationKey'

const agora = new Date('2026-07-10T12:00:00Z')
const msg = (direction: 'inbound' | 'outbound', iso: string) =>
  ({ direction, created_at: iso }) as Parameters<typeof getWindowStatus>[0][number]

describe('getWindowStatus', () => {
  it('sem inbound: janela fechada', () => {
    const s = getWindowStatus([msg('outbound', '2026-07-10T11:00:00Z')], agora)
    expect(s.isOpen).toBe(false)
    expect(s.statusColor).toBe('red')
  })

  it('lista vazia: janela fechada', () => {
    expect(getWindowStatus([], agora).isOpen).toBe(false)
  })

  it('inbound ha 1h: aberta e verde (>2h restantes)', () => {
    const s = getWindowStatus([msg('inbound', '2026-07-10T11:00:00Z')], agora)
    expect(s.isOpen).toBe(true)
    expect(s.statusColor).toBe('green')
    expect(s.timeLeft).toBe('23h 0m')
  })

  it('inbound ha 23h: aberta e amarela (<2h restantes)', () => {
    const s = getWindowStatus([msg('inbound', '2026-07-09T13:00:00Z')], agora)
    expect(s.isOpen).toBe(true)
    expect(s.statusColor).toBe('yellow')
    expect(s.timeLeft).toBe('1h 0m')
  })

  it('inbound ha exatamente 24h: fechada', () => {
    const s = getWindowStatus([msg('inbound', '2026-07-09T12:00:00Z')], agora)
    expect(s.isOpen).toBe(false)
  })

  it('usa o inbound MAIS RECENTE, nao o primeiro da lista', () => {
    const s = getWindowStatus(
      [msg('inbound', '2026-07-08T12:00:00Z'), msg('inbound', '2026-07-10T11:30:00Z')],
      agora
    )
    expect(s.isOpen).toBe(true)
  })

  it('menos de 1h restante omite as horas', () => {
    const s = getWindowStatus([msg('inbound', '2026-07-09T12:30:00Z')], agora)
    expect(s.timeLeft).toBe('30m')
  })
})

describe('conversationKey', () => {
  it('bsuid vence telefone como identidade', () => {
    expect(conversationKey({ bsuid: 'BR.1', phone: '5534999', phone_id: '1188' })).toBe('BR.1::1188')
  })
  it('sem bsuid usa telefone', () => {
    expect(conversationKey({ bsuid: null, phone: '5534999', phone_id: '1188' })).toBe('5534999::1188')
  })
  it('phone_id nulo vira sufixo vazio (mensagens legadas)', () => {
    expect(conversationKey({ bsuid: 'BR.1', phone: null, phone_id: null })).toBe('BR.1::')
  })
  it('sem identidade alguma devolve null', () => {
    expect(conversationKey({ bsuid: null, phone: null, phone_id: '1188' })).toBeNull()
  })
  it('a mesma pessoa em instancias diferentes gera chaves diferentes', () => {
    const a = conversationKey({ bsuid: 'BR.1', phone: null, phone_id: '1188' })
    const b = conversationKey({ bsuid: 'BR.1', phone: null, phone_id: '2299' })
    expect(a).not.toBe(b)
  })
})
