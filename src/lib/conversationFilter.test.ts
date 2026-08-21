import { describe, expect, it } from 'vitest'
import { contarConversasNaoLidas, filtrarConversas, filtrarPorInstancias } from './conversationFilter'

const c = (key: string, contact_name: string, last_message = '') => ({
  key,
  phone: key,
  contact_name,
  last_message,
})

const conversas = [c('1', 'Vilssom'), c('2', 'Deilda'), c('3', 'Raimundo')]
const naoLidas = { '1': 2, '3': 1 } // Deilda já foi respondida

const chaves = (r: { key: string }[]) => r.map((x) => x.key)

describe('filtrarConversas', () => {
  it('sem filtro, devolve todas', () => {
    const r = filtrarConversas({ conversas, busca: '', apenasNaoLidas: false, naoLidas, selecionada: null })
    expect(chaves(r)).toEqual(['1', '2', '3'])
  })

  it('com "Não lidas", oculta as já respondidas', () => {
    const r = filtrarConversas({ conversas, busca: '', apenasNaoLidas: true, naoLidas, selecionada: null })
    expect(chaves(r)).toEqual(['1', '3'])
  })

  it('mantém visível a conversa ABERTA mesmo depois de lida', () => {
    // Cenário real: a operadora clica na conversa 2, o app zera o contador dela.
    const aposLer = { '1': 2, '3': 1 } // '2' não tem mais não-lidas
    const r = filtrarConversas({
      conversas,
      busca: '',
      apenasNaoLidas: true,
      naoLidas: aposLer,
      selecionada: '2',
    })
    expect(chaves(r)).toContain('2') // não some debaixo do cursor
  })

  it('combina busca e filtro', () => {
    const r = filtrarConversas({ conversas, busca: 'raimundo', apenasNaoLidas: true, naoLidas, selecionada: null })
    expect(chaves(r)).toEqual(['3'])
  })

  it('busca que não casa vence o filtro (nada é exibido)', () => {
    const r = filtrarConversas({ conversas, busca: 'zzz', apenasNaoLidas: true, naoLidas, selecionada: '1' })
    expect(r).toHaveLength(0)
  })

  it('tudo respondido com filtro ligado devolve lista vazia', () => {
    const r = filtrarConversas({ conversas, busca: '', apenasNaoLidas: true, naoLidas: {}, selecionada: null })
    expect(r).toHaveLength(0)
  })
})

describe('filtrarPorInstancias', () => {
  const ci = (key: string, phone_id: string | null) => ({ key, phone_id })
  const lista = [ci('1', 'inst-a'), ci('2', 'inst-b'), ci('3', 'inst-a'), ci('4', null)]

  it('instancias === null devolve todas', () => {
    const r = filtrarPorInstancias(lista, null)
    expect(chaves(r)).toEqual(['1', '2', '3', '4'])
  })

  it('conjunto com uma instância devolve só as dela, preservando ordem', () => {
    const r = filtrarPorInstancias(lista, new Set(['inst-a']))
    expect(chaves(r)).toEqual(['1', '3'])
  })

  it('conjunto com duas instâncias devolve a união, preservando ordem', () => {
    const r = filtrarPorInstancias(lista, new Set(['inst-a', 'inst-b']))
    expect(chaves(r)).toEqual(['1', '2', '3'])
  })

  it('conjunto vazio devolve todas', () => {
    const r = filtrarPorInstancias(lista, new Set())
    expect(chaves(r)).toEqual(['1', '2', '3', '4'])
  })

  it('conjunto sem correspondência devolve lista vazia', () => {
    const r = filtrarPorInstancias(lista, new Set(['inst-z']))
    expect(r).toEqual([])
  })

  it('phone_id null nunca casa com filtro ativo', () => {
    const r = filtrarPorInstancias(lista, new Set(['inst-a', 'inst-b']))
    expect(chaves(r)).not.toContain('4')
  })

  it('não muta a entrada', () => {
    const original = [...lista]
    filtrarPorInstancias(lista, new Set(['inst-a']))
    expect(lista).toEqual(original)
  })

  it('mantém visível a conversa ABERTA mesmo sendo de outra instância', () => {
    // Cenário real: o admin abre um chat da inst-b e depois filtra pela inst-a.
    // O chat aberto não pode sumir debaixo do cursor.
    const r = filtrarPorInstancias(lista, new Set(['inst-a']), '2')
    expect(chaves(r)).toEqual(['1', '2', '3'])
  })

  it('conversa aberta que já casa com o filtro não duplica', () => {
    const r = filtrarPorInstancias(lista, new Set(['inst-a']), '1')
    expect(chaves(r)).toEqual(['1', '3'])
  })

  it('sem filtro ativo, a selecionada não altera o resultado', () => {
    const r = filtrarPorInstancias(lista, null, '2')
    expect(chaves(r)).toEqual(['1', '2', '3', '4'])
  })
})

describe('contarConversasNaoLidas', () => {
  it('conta conversas, não mensagens', () => {
    expect(contarConversasNaoLidas(conversas, naoLidas)).toBe(2) // 2 + 1 mensagens, 2 conversas
  })

  it('zero quando tudo foi lido', () => {
    expect(contarConversasNaoLidas(conversas, {})).toBe(0)
  })
})
