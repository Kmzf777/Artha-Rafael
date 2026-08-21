import { describe, expect, it } from 'vitest'
import { deveBuscarNoServidor, mapearResultado, recortarTrecho } from './buscaConversas'

describe('deveBuscarNoServidor', () => {
  it('exige ao menos 2 caracteres úteis', () => {
    expect(deveBuscarNoServidor('')).toBe(false)
    expect(deveBuscarNoServidor(' ')).toBe(false)
    expect(deveBuscarNoServidor('a')).toBe(false)
    expect(deveBuscarNoServidor('  a  ')).toBe(false)
    expect(deveBuscarNoServidor('vi')).toBe(true)
  })
})

describe('recortarTrecho', () => {
  it('devolve trecho curto inalterado', () => {
    expect(recortarTrecho('Boa tarde', 'tarde')).toBe('Boa tarde')
  })

  it('centraliza o recorte no termo encontrado', () => {
    const longo = 'a'.repeat(80) + 'AGULHA' + 'b'.repeat(80)
    const r = recortarTrecho(longo, 'agulha', 30)
    expect(r).toContain('AGULHA')
    expect(r.startsWith('…')).toBe(true)
    expect(r.endsWith('…')).toBe(true)
  })

  it('trunca quando o termo não está no trecho', () => {
    const longo = 'x'.repeat(200)
    expect(recortarTrecho(longo, 'zzz', 20)).toBe('x'.repeat(20) + '…')
  })

  it('tolera trecho nulo', () => {
    expect(recortarTrecho(null, 'x')).toBe('')
  })
})

describe('mapearResultado', () => {
  const linha = {
    key: 'BR.1::1188',
    phone: '553791235196',
    bsuid: 'BR.1',
    phone_id: '1188',
    contact_name: 'Vilssom',
    last_message: 'Sim',
    last_message_time: '2026-07-09T16:32:33Z',
    last_direction: 'inbound',
    last_message_type: 'button',
    match_tipo: 'telefone',
    match_trecho: '553791235196',
  }

  it('preserva a chave do card (precisa casar com conversationKey)', () => {
    expect(mapearResultado(linha).key).toBe('BR.1::1188')
  })

  it('normaliza direction para o union type', () => {
    expect(mapearResultado(linha).last_direction).toBe('inbound')
    expect(mapearResultado({ ...linha, last_direction: 'qualquer' }).last_direction).toBe('outbound')
  })
})
