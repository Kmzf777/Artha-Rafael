import { describe, expect, it } from 'vitest'
import { TEMPLATES_RTV } from '@/lib/bot/roteiro'
import {
  componentesDeBotao,
  contarVariaveis,
  parametrosDoTemplate,
  validarTemplate,
  type RascunhoTemplate,
} from './templates'

const BASE: RascunhoTemplate = {
  nome: 'reativacao_agosto',
  categoria: 'MARKETING',
  idioma: 'pt_BR',
  cabecalho: null,
  corpo: 'Oi, {{1}}. Faz {{2}} dias que você não entra na Artha.',
  exemplos: ['Rafael', '90'],
  rodape: null,
  botoes: [],
}

describe('contarVariaveis', () => {
  it('conta variáveis distintas', () => {
    expect(contarVariaveis('Oi, {{1}}. Faz {{2}} dias.')).toBe(2)
    expect(contarVariaveis('Oi, {{1}}. Tudo bem, {{1}}?')).toBe(1)
    expect(contarVariaveis('Sem variável')).toBe(0)
  })
})

describe('validarTemplate — nome', () => {
  it('aceita minúsculas com underscore', () => {
    expect(validarTemplate(BASE)).toEqual([])
  })

  it('recusa maiúsculas, espaço e hífen', () => {
    expect(validarTemplate({ ...BASE, nome: 'Reativacao Agosto' })).toContain(
      'O nome só aceita letras minúsculas, números e underscore.'
    )
    expect(validarTemplate({ ...BASE, nome: 'reativacao-agosto' })).toContain(
      'O nome só aceita letras minúsculas, números e underscore.'
    )
  })
})

describe('validarTemplate — variáveis e exemplos', () => {
  it('exige um exemplo por variável', () => {
    expect(validarTemplate({ ...BASE, exemplos: ['Rafael'] })).toContain(
      'O corpo tem 2 variáveis e 1 exemplo. Preencha um exemplo para cada.'
    )
  })

  it('recusa variáveis fora de sequência', () => {
    expect(validarTemplate({ ...BASE, corpo: 'Oi, {{1}} e {{3}}.', exemplos: ['a', 'b'] })).toContain(
      'As variáveis precisam ser sequenciais a partir de {{1}}.'
    )
  })

  it('recusa corpo vazio', () => {
    expect(validarTemplate({ ...BASE, corpo: '   ', exemplos: [] })).toContain(
      'O corpo não pode ficar vazio.'
    )
  })
})

describe('validarTemplate — botões', () => {
  it('recusa variável em botão URL estático', () => {
    const erros = validarTemplate({
      ...BASE,
      botoes: [{ tipo: 'URL', texto: 'Abrir', url: 'https://arthafp.com.br/painel' }],
    })
    expect(erros).toEqual([])
  })

  it('aceita URL com sufixo variável e exige exemplo', () => {
    const erros = validarTemplate({
      ...BASE,
      botoes: [{ tipo: 'URL', texto: 'Abrir', url: 'https://arthafp.com.br/{{1}}' }],
    })
    expect(erros).toContain('O botão "Abrir" usa {{1}} na URL e precisa de um exemplo.')
  })

  it('recusa mais de três botões de resposta rápida', () => {
    const botoes = ['a', 'b', 'c', 'd'].map((t) => ({ tipo: 'QUICK_REPLY' as const, texto: t }))
    expect(validarTemplate({ ...BASE, botoes })).toContain(
      'No máximo 3 botões de resposta rápida.'
    )
  })
})

describe('parametrosDoTemplate — monta o componente de envio', () => {
  it('monta só o body quando o botão URL é estático', () => {
    // Reproduz o erro 132018 encontrado no teste real: botão URL estático NÃO
    // aceita parâmetro. Mandar `button` aqui é o que a Meta recusou.
    const componentes = parametrosDoTemplate(
      { ...BASE, botoes: [{ tipo: 'URL', texto: 'Abrir', url: 'https://arthafp.com.br/painel' }] },
      ['Rafael', '90']
    )
    expect(componentes).toEqual([
      { type: 'body', parameters: [{ type: 'text', text: 'Rafael' }, { type: 'text', text: '90' }] },
    ])
  })

  it('inclui o parâmetro do botão quando a URL tem variável', () => {
    const componentes = parametrosDoTemplate(
      { ...BASE, botoes: [{ tipo: 'URL', texto: 'Abrir', url: 'https://arthafp.com.br/{{1}}' }] },
      ['Rafael', '90'],
      ['painel']
    )
    expect(componentes).toContainEqual({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: 'painel' }],
    })
  })

  it('omite o body quando o template não tem variáveis', () => {
    expect(parametrosDoTemplate({ ...BASE, corpo: 'Aviso fixo.', exemplos: [] }, [])).toEqual([])
  })
})

describe('componentesDeBotao', () => {
  it('monta um quick_reply por botão para cada variante registrada', () => {
    for (const nome of Object.keys(TEMPLATES_RTV)) {
      expect(componentesDeBotao(nome), nome).toEqual([
        { type: 'button', sub_type: 'quick_reply', index: '0', parameters: [{ type: 'payload', payload: 'rtv:voltar' }] },
        { type: 'button', sub_type: 'quick_reply', index: '1', parameters: [{ type: 'payload', payload: 'rtv:problema' }] },
        { type: 'button', sub_type: 'quick_reply', index: '2', parameters: [{ type: 'payload', payload: 'rtv:sair' }] },
      ])
    }
  })

  it('devolve lista vazia para template que não é de campanha', () => {
    // Lista vazia importa: é ela que mantém a defesa do erro 132018, porque
    // `enviarTemplate` só omite `components` quando a lista chega vazia.
    expect(componentesDeBotao('modelo_teste')).toEqual([])
    expect(componentesDeBotao('')).toEqual([])
  })

  it('LANÇA para nome de campanha fora do registro', () => {
    // Era o ponto único de falha do funil: sair sem payload faz a Meta usar o
    // título do botão como id, e os leads voltam todos para a p1 sem erro, sem
    // log e sem teste vermelho. `mkt_rtv_voce_sabe_01` está APPROVED na conta e
    // assina "Lúcia" — disparar ele à mão tem de falhar alto.
    expect(() => componentesDeBotao('mkt_rtv_voce_sabe_01')).toThrow(/TEMPLATES_RTV/)
    expect(() => componentesDeBotao('mkt_rtv_qualquer_coisa')).toThrow(/TEMPLATES_RTV/)
  })
})
