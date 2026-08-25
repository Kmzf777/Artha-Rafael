import { describe, it, expect } from 'vitest'
import {
  MAX_BOTOES,
  MAX_CORPO_INTERATIVO,
  MAX_CORPO_TEXTO,
  MAX_TITULO,
  P1,
  P2_POR_RAMO,
  perguntaP2,
  SEGMENTO_POR_P1,
  TAG_POR_RESPOSTA,
  RESPOSTA_POR_ID,
  IDS_QUE_ENCAMINHAM,
  FECHO,
  REPETICAO,
  mensagemTerminal,
  ehIdConhecido,
} from './roteiro'

const TODAS = [P1, ...Object.values(P2_POR_RAMO)]

/**
 * Terminal é todo botão da p1 sem ramo em P2_POR_RAMO, mais todos os botões das
 * p2. DERIVADO da árvore, nunca escrito à mão: um ramo que vire terminal numa
 * revisão futura entra nesta lista sozinho, em vez de escapar em silêncio.
 */
const TERMINAIS = [
  ...P1.botoes.map((b) => b.id).filter((id) => !(id in P2_POR_RAMO)),
  ...Object.values(P2_POR_RAMO).flatMap((p) => p.botoes.map((b) => b.id)),
]

/** Travessão (U+2014) e meia-risca (U+2013). Hífen comum não conta. */
const TRAVESSAO = /[\u2013\u2014]/

describe('limites da Cloud API', () => {
  it('nenhuma pergunta passa de 3 botões', () => {
    for (const p of TODAS) expect(p.botoes.length).toBeLessThanOrEqual(MAX_BOTOES)
  })

  it('nenhum título de botão passa de 20 caracteres', () => {
    for (const p of TODAS) {
      for (const b of p.botoes) expect(b.titulo.length).toBeLessThanOrEqual(MAX_TITULO)
    }
  })

  it('nenhum corpo de pergunta passa do teto interativo', () => {
    for (const p of TODAS) {
      expect(p.corpo.length).toBeLessThanOrEqual(MAX_CORPO_INTERATIVO)
      expect(p.corpoRepetido.length).toBeLessThanOrEqual(MAX_CORPO_INTERATIVO)
    }
  })
})

describe('ids', () => {
  it('são únicos em todo o roteiro', () => {
    const ids = TODAS.flatMap((p) => p.botoes.map((b) => b.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ehIdConhecido separa o que é do roteiro do que não é', () => {
    expect(ehIdConhecido('p1:artha')).toBe(true)
    expect(ehIdConhecido('p2:artha_preco')).toBe(true)
    expect(ehIdConhecido('quero_voltar')).toBe(false)
    expect(ehIdConhecido(null)).toBe(false)
  })
})

describe('ramificação', () => {
  it('artha e dhana têm p2; outro não tem', () => {
    expect(perguntaP2('p1:artha')?.botoes).toHaveLength(3)
    expect(perguntaP2('p1:dhana')?.botoes).toHaveLength(3)
    expect(perguntaP2('p1:outro')).toBeNull()
  })

  it('só artha e dhana decidem segmento', () => {
    expect(SEGMENTO_POR_P1['p1:artha']).toBe('artha')
    expect(SEGMENTO_POR_P1['p1:dhana']).toBe('dhana')
    expect(SEGMENTO_POR_P1['p1:outro']).toBeUndefined()
  })
})

describe('saída terminal', () => {
  it('existe pelo menos um terminal de nível 1', () => {
    const terminaisP1 = P1.botoes.map((b) => b.id).filter((id) => !(id in P2_POR_RAMO))
    expect(terminaisP1).toContain('p1:outro')
  })

  it('todo id terminal ou responde, ou encaminha', () => {
    expect(TERMINAIS.length).toBeGreaterThan(0)
    for (const id of TERMINAIS) {
      const responde = id in RESPOSTA_POR_ID
      const encaminha = IDS_QUE_ENCAMINHAM.has(id)
      expect(responde || encaminha, `${id} não responde nem encaminha`).toBe(true)
    }
  })

  it('nenhum id responde e encaminha ao mesmo tempo', () => {
    for (const id of Object.keys(RESPOSTA_POR_ID)) {
      expect(IDS_QUE_ENCAMINHAM.has(id), `${id} está em RESPOSTA_POR_ID e em IDS_QUE_ENCAMINHAM`).toBe(false)
    }
  })

  it('RESPOSTA_POR_ID e IDS_QUE_ENCAMINHAM só falam de ids terminais', () => {
    const terminais = new Set(TERMINAIS)
    for (const id of [...Object.keys(RESPOSTA_POR_ID), ...IDS_QUE_ENCAMINHAM]) {
      expect(terminais.has(id), `${id} não é um terminal da árvore`).toBe(true)
    }
  })

  it('toda resposta terminal tem tag', () => {
    for (const id of TERMINAIS) expect(TAG_POR_RESPOSTA[id]).toBeTruthy()
  })

  it('nenhuma resposta passa do teto de texto da Cloud API', () => {
    for (const texto of Object.values(RESPOSTA_POR_ID)) {
      expect(texto.length).toBeLessThanOrEqual(MAX_CORPO_TEXTO)
    }
    expect(FECHO.length).toBeLessThanOrEqual(MAX_CORPO_TEXTO)
  })

  // A chave existir não basta. `mensagemTerminal` só cai no FECHO quando o valor
  // é `undefined`, então uma string vazia atravessa a checagem de cobertura, sai
  // pela Cloud API e chega no WhatsApp como mensagem em branco. É a mesma falha
  // que `mensagemTerminal` existe para impedir, alcançada por outro lado.
  it('nenhuma resposta é vazia', () => {
    for (const [id, texto] of Object.entries(RESPOSTA_POR_ID)) {
      expect(texto.trim().length, `${id} tem resposta vazia`).toBeGreaterThan(0)
    }
    expect(FECHO.trim().length).toBeGreaterThan(0)
  })
})

describe('mensagemTerminal', () => {
  it('devolve a resposta do id de nível 2', () => {
    expect(mensagemTerminal('p1:artha', 'p2:artha_preco')).toBe(RESPOSTA_POR_ID['p2:artha_preco'])
  })

  it('cai no id de nível 1 quando não há nível 2', () => {
    expect(mensagemTerminal('p1:outro', null)).toBe(FECHO)
  })

  it('devolve o fecho para quem encaminha', () => {
    expect(mensagemTerminal('p1:dhana', 'p2:dhana_demo')).toBe(FECHO)
    expect(mensagemTerminal('p1:dhana', 'p2:humano')).toBe(FECHO)
  })

  it('id desconhecido cai no fecho, nunca em silêncio', () => {
    expect(mensagemTerminal(null, null)).toBe(FECHO)
    expect(mensagemTerminal('p1:artha', 'p2:inexistente')).toBe(FECHO)
  })
})

describe('regras de escrita', () => {
  it('nenhuma copy usa travessão ou meia-risca', () => {
    const copy = [
      ...TODAS.flatMap((p) => [p.corpo, p.corpoRepetido]),
      ...TODAS.flatMap((p) => p.botoes.map((b) => b.titulo)),
      ...Object.values(RESPOSTA_POR_ID),
      FECHO,
      REPETICAO,
    ]
    for (const texto of copy) {
      expect(TRAVESSAO.test(texto), `travessão em: ${texto}`).toBe(false)
    }
  })

  it('o link de começar fica sozinho na linha, sem pontuação encostada', () => {
    const linhas = RESPOSTA_POR_ID['p2:artha_comecar'].split('\n')
    const linhaDoLink = linhas.find((l) => l.includes('https://'))
    expect(linhaDoLink).toBe('https://artha.ia.br')
  })
})
