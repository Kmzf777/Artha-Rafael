import { describe, it, expect } from 'vitest'
import { agruparPorData, localizarNaoLidas, trocouDeNumero } from './timeline'
import type { Message } from './conversationTypes'

const msg = (over: Partial<Message>): Message =>
  ({
    id: 'x',
    message_id: 'wamid.x',
    phone: '5534999',
    bsuid: null,
    phone_id: '1',
    contact_name: null,
    message_type: 'text',
    content: 'oi',
    direction: 'inbound',
    created_at: '2026-07-10T12:00:00Z',
    raw_payload: null,
    enviado_por: null,
    button_id: null,
    ...over,
  }) as Message

describe('agruparPorData', () => {
  it('agrupa mensagens do mesmo dia', () => {
    const g = agruparPorData([
      msg({ id: 'a', created_at: '2026-07-10T09:00:00Z' }),
      msg({ id: 'b', created_at: '2026-07-10T18:00:00Z' }),
    ])
    expect(g).toHaveLength(1)
    expect(g[0].msgs.map((m) => m.id)).toEqual(['a', 'b'])
  })

  it('quebra grupo ao mudar de dia', () => {
    const g = agruparPorData([
      msg({ id: 'a', created_at: '2026-07-08T12:00:00Z' }),
      msg({ id: 'b', created_at: '2026-07-10T12:00:00Z' }),
    ])
    expect(g).toHaveLength(2)
  })

  // O agrupamento usa o dia LOCAL, não o UTC — é o calendário que a operadora vê.
  // Em Brasília (UTC-3), 23:00Z de 09/07 e 01:00Z de 10/07 são o mesmo dia 09/07.
  it('agrupa pelo dia local, nao pelo dia UTC', () => {
    const g = agruparPorData([
      msg({ id: 'a', created_at: '2026-07-09T23:00:00Z' }),
      msg({ id: 'b', created_at: '2026-07-10T01:00:00Z' }),
    ])
    const mesmoDiaLocal =
      new Date('2026-07-09T23:00:00Z').getDate() === new Date('2026-07-10T01:00:00Z').getDate()
    expect(g).toHaveLength(mesmoDiaLocal ? 1 : 2)
  })

  it('lista vazia devolve zero grupos', () => {
    expect(agruparPorData([])).toEqual([])
  })
})

describe('localizarNaoLidas', () => {
  const msgs = [
    msg({ id: 'a', direction: 'inbound', created_at: '2026-07-10T10:00:00Z' }),
    msg({ id: 'b', direction: 'outbound', created_at: '2026-07-10T11:00:00Z' }),
    msg({ id: 'c', direction: 'inbound', created_at: '2026-07-10T12:00:00Z' }),
    msg({ id: 'd', direction: 'inbound', created_at: '2026-07-10T13:00:00Z' }),
  ]

  it('marca as inbound posteriores ao ultimo lido', () => {
    const r = localizarNaoLidas(msgs, '2026-07-10T11:30:00Z')
    expect(r.primeiraNaoLidaId).toBe('c')
    expect(r.quantidade).toBe(2)
  })

  it('sem marcador, tudo que e inbound conta como nao lido', () => {
    const r = localizarNaoLidas(msgs, null)
    expect(r.primeiraNaoLidaId).toBe('a')
    expect(r.quantidade).toBe(3)
  })

  it('outbound nunca conta como nao lida', () => {
    const r = localizarNaoLidas([msg({ id: 'z', direction: 'outbound' })], null)
    expect(r.primeiraNaoLidaId).toBeNull()
    expect(r.quantidade).toBe(0)
  })

  it('marcador posterior a tudo: nada nao lido', () => {
    const r = localizarNaoLidas(msgs, '2026-07-11T00:00:00Z')
    expect(r.primeiraNaoLidaId).toBeNull()
    expect(r.quantidade).toBe(0)
  })
})

describe('trocouDeNumero', () => {
  it('detecta a notificacao de troca de numero na ultima mensagem', () => {
    const msgs = [
      msg({ id: 'a', created_at: '2026-07-10T10:00:00Z' }),
      msg({
        id: 'b',
        created_at: '2026-07-10T11:00:00Z',
        message_type: 'system',
        raw_payload: { system: { type: 'user_changed_number' } },
      }),
    ]
    expect(trocouDeNumero(msgs)).toBe(true)
  })

  it('troca antiga seguida de mensagem nova NAO bloqueia', () => {
    const msgs = [
      msg({
        id: 'b',
        created_at: '2026-07-10T11:00:00Z',
        message_type: 'system',
        raw_payload: { system: { type: 'user_changed_number' } },
      }),
      msg({ id: 'c', created_at: '2026-07-10T12:00:00Z' }),
    ]
    expect(trocouDeNumero(msgs)).toBe(false)
  })

  it('lista vazia nao bloqueia', () => {
    expect(trocouDeNumero([])).toBe(false)
  })
})
