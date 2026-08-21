import { describe, it, expect } from 'vitest'
import {
  conversationKey,
  readMarkCandidates,
  resolveLastRead,
  mergeReadMarks,
  computeUnreadCounts,
} from './conversationReads'

const T = (h: number, m = 0) => new Date(Date.UTC(2026, 6, 10, h, m)).toISOString()

describe('conversationKey', () => {
  it('usa bsuid quando presente, com sufixo da instância', () => {
    expect(conversationKey({ bsuid: 'BR.123', phone: '5531999', phone_id: '111' })).toBe('BR.123::111')
  })
  it('cai para o telefone quando não há bsuid', () => {
    expect(conversationKey({ bsuid: null, phone: '5531999', phone_id: '111' })).toBe('5531999::111')
  })
  it('phone_id nulo (legado) agrupa sob sufixo vazio', () => {
    expect(conversationKey({ bsuid: null, phone: '5531999', phone_id: null })).toBe('5531999::')
  })
  it('retorna null sem nenhuma identidade', () => {
    expect(conversationKey({ bsuid: null, phone: null, phone_id: '111' })).toBeNull()
  })
})

describe('readMarkCandidates', () => {
  it('inclui a chave atual e a chave legada sem sufixo de instância', () => {
    expect(readMarkCandidates({ bsuid: null, phone: '5531999', phone_id: '111' })).toEqual([
      '5531999::111',
      '5531999',
    ])
  })
  it('para contato com bsuid, inclui as chaves por telefone (identidade antiga)', () => {
    expect(readMarkCandidates({ bsuid: 'BR.123', phone: '5531999', phone_id: '111' })).toEqual([
      'BR.123::111',
      'BR.123',
      '5531999::111',
      '5531999',
    ])
  })
  it('não duplica candidatos nem inclui nulos', () => {
    expect(readMarkCandidates({ bsuid: null, phone: '5531999', phone_id: null })).toEqual([
      '5531999::',
      '5531999',
    ])
  })
})

describe('resolveLastRead', () => {
  it('encontra a marca gravada sob a chave legada (pré-instâncias)', () => {
    const marks = { '5531999': T(10) }
    expect(resolveLastRead({ bsuid: null, phone: '5531999', phone_id: '111' }, marks)).toBe(T(10))
  })
  it('encontra a marca por telefone quando o contato ganhou bsuid depois', () => {
    const marks = { '5531999::111': T(10) }
    expect(resolveLastRead({ bsuid: 'BR.123', phone: '5531999', phone_id: '111' }, marks)).toBe(T(10))
  })
  it('usa a marca mais recente entre os candidatos', () => {
    const marks = { '5531999': T(8), '5531999::111': T(11) }
    expect(resolveLastRead({ bsuid: null, phone: '5531999', phone_id: '111' }, marks)).toBe(T(11))
  })
  it('retorna null sem nenhuma marca', () => {
    expect(resolveLastRead({ bsuid: null, phone: '5531999', phone_id: '111' }, {})).toBeNull()
  })
})

describe('mergeReadMarks', () => {
  it('mantém a marca mais recente por chave entre as fontes', () => {
    const local = { a: T(10), b: T(8) }
    const server = { a: T(9), b: T(12), c: T(7) }
    expect(mergeReadMarks(local, server)).toEqual({ a: T(10), b: T(12), c: T(7) })
  })
  it('ignora timestamps inválidos sem derrubar a mesclagem', () => {
    expect(mergeReadMarks({ a: 'lixo' }, { a: T(9) })).toEqual({ a: T(9) })
  })
})

describe('computeUnreadCounts', () => {
  const row = (over: Partial<{
    bsuid: string | null
    phone: string | null
    phone_id: string | null
    direction: 'inbound' | 'outbound'
    created_at: string
  }>) => ({
    bsuid: null,
    phone: '5531999',
    phone_id: '111',
    direction: 'inbound' as const,
    created_at: T(12),
    ...over,
  })

  it('conta apenas inbound mais novo que a marca de leitura', () => {
    const rows = [
      row({ created_at: T(9) }),
      row({ created_at: T(11) }),
      row({ created_at: T(13) }),
      row({ created_at: T(14), direction: 'outbound' }),
    ]
    const counts = computeUnreadCounts(rows, { '5531999::111': T(10) })
    expect(counts).toEqual({ '5531999::111': 2 })
  })

  it('mensagem lida sob a chave legada não volta como não lida (regressão do bug)', () => {
    const rows = [row({ created_at: T(9) })]
    // Marca gravada ANTES da feature de instâncias, sem o sufixo ::phone_id.
    const counts = computeUnreadCounts(rows, { '5531999': T(10) })
    expect(counts).toEqual({})
  })

  it('contato que ganhou bsuid preserva a leitura feita sob a chave por telefone', () => {
    const rows = [
      row({ bsuid: 'BR.123', created_at: T(9) }),
      row({ bsuid: 'BR.123', phone: null, created_at: T(9, 30) }),
    ]
    const counts = computeUnreadCounts(rows, { '5531999::111': T(10) })
    expect(counts).toEqual({})
  })

  it('sem marca de leitura, todo inbound conta', () => {
    const rows = [row({ created_at: T(9) }), row({ created_at: T(11) })]
    expect(computeUnreadCounts(rows, {})).toEqual({ '5531999::111': 2 })
  })

  it('separa contadores por instância (mesma pessoa, phone_id distintos)', () => {
    const rows = [
      row({ phone_id: '111', created_at: T(11) }),
      row({ phone_id: '222', created_at: T(11) }),
    ]
    const counts = computeUnreadCounts(rows, { '5531999::111': T(12) })
    expect(counts).toEqual({ '5531999::222': 1 })
  })

  it('ignora linhas sem identidade', () => {
    const rows = [row({ phone: null, bsuid: null })]
    expect(computeUnreadCounts(rows, {})).toEqual({})
  })
})
