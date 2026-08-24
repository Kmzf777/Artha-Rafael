import { describe, expect, it } from 'vitest'
import {
  chavesLegadas,
  extrairNaoLidas,
  lerMarcadores,
  mapearConversa,
  type LinhaConversaRpc,
} from './listaConversas'

const linha = (over: Partial<LinhaConversaRpc> = {}): LinhaConversaRpc => ({
  key: 'BR.1::1188',
  phone: '553791235196',
  bsuid: 'BR.1',
  phone_id: '1188',
  contact_name: 'Vilssom',
  last_message: 'Sim',
  last_message_time: '2026-07-09T16:32:33Z',
  last_direction: 'inbound',
  last_message_type: 'button',
  last_enviado_por: null,
  nao_lidas: 0,
  ...over,
})

/** localStorage falso, suficiente para o contrato que lerMarcadores usa. */
function storageFake(dados: Record<string, string>) {
  const chaves = Object.keys(dados)
  return {
    length: chaves.length,
    key: (i: number) => chaves[i] ?? null,
    getItem: (k: string) => dados[k] ?? null,
  }
}

describe('lerMarcadores (migração única do localStorage)', () => {
  it('extrai só as chaves com o prefixo, removendo-o', () => {
    const r = lerMarcadores(
      storageFake({
        'lastRead_BR.1::1188': '2026-07-09T16:00:00.000Z',
        'outra-coisa': 'ignorar',
      })
    )
    expect(r).toEqual([{ conversation_key: 'BR.1::1188', last_read_at: '2026-07-09T16:00:00.000Z' }])
  })

  it('descarta marcador corrompido — um cast inválido abortaria o upsert', () => {
    const r = lerMarcadores(storageFake({ 'lastRead_A::1': 'nao-e-data', 'lastRead_B::1': '2026-01-01T00:00:00Z' }))
    expect(r.map((x) => x.conversation_key)).toEqual(['B::1'])
  })

  it('descarta valor vazio', () => {
    expect(lerMarcadores(storageFake({ 'lastRead_A::1': '' }))).toEqual([])
  })

  it('storage vazio devolve lista vazia', () => {
    expect(lerMarcadores(storageFake({}))).toEqual([])
  })
})

describe('chavesLegadas', () => {
  it('lista só as chaves com o prefixo', () => {
    const c = chavesLegadas(storageFake({ 'lastRead_A::1': 'x', outra: 'y', 'lastRead_B::1': 'z' }))
    expect(c).toEqual(['lastRead_A::1', 'lastRead_B::1'])
  })
})

describe('extrairNaoLidas', () => {
  it('inclui só conversas com pendência', () => {
    const r = extrairNaoLidas([
      linha({ key: 'a', nao_lidas: 3 }),
      linha({ key: 'b', nao_lidas: 0 }),
      linha({ key: 'c', nao_lidas: 1 }),
    ])
    expect(r).toEqual({ a: 3, c: 1 })
  })
})

describe('mapearConversa', () => {
  it('preserva a chave do card', () => {
    expect(mapearConversa(linha()).key).toBe('BR.1::1188')
  })

  it('normaliza direction desconhecida para outbound', () => {
    expect(mapearConversa(linha({ last_direction: 'inbound' })).last_direction).toBe('inbound')
    expect(mapearConversa(linha({ last_direction: 'xxx' })).last_direction).toBe('outbound')
  })
})
