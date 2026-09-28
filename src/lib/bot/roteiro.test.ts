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
  RTV_IDS,
  RTV_BOTOES,
  RTV2,
  perguntaRtv2,
  ehIdRtv,
  ehIdRtv1,
  ehIdRtv2,
  ehTerminalRtv,
  TEMPLATES_RTV,
} from './roteiro'
import { validarTemplate } from '../templates'

const TODAS = [P1, ...Object.values(P2_POR_RAMO)]

/**
 * Terminal é todo botão da p1 sem ramo em P2_POR_RAMO, mais todos os botões das
 * p2. DERIVADO da árvore, nunca escrito à mão: um ramo que vire terminal numa
 * revisão futura entra nesta lista sozinho, em vez de escapar em silêncio.
 *
 * O rtv entra pelos dois níveis filtrados por `ehTerminalRtv`, e não inteiro:
 * `rtv:voltar` deixou de ser terminal quando passou a abrir a triagem, e listar
 * os ids do ramo à mão faria o próximo botão que ganhar triagem continuar
 * contando como terminal.
 */
const TERMINAIS = [
  ...P1.botoes.map((b) => b.id).filter((id) => !(id in P2_POR_RAMO)),
  ...Object.values(P2_POR_RAMO).flatMap((p) => p.botoes.map((b) => b.id)),
  ...[...RTV_IDS, ...RTV2.botoes.map((b) => b.id)].filter(ehTerminalRtv),
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

describe('ramo rtv (campanha de retomada)', () => {
  it('os títulos cabem no limite da Cloud API', () => {
    expect(RTV_BOTOES).toHaveLength(MAX_BOTOES)
    for (const b of RTV_BOTOES) {
      expect(b.titulo.length, `"${b.titulo}" passa de ${MAX_TITULO}`).toBeLessThanOrEqual(MAX_TITULO)
    }
  })

  it('a ordem dos botões é a ordem dos índices do template', () => {
    expect(RTV_BOTOES.map((b) => b.id)).toEqual(['rtv:voltar', 'rtv:problema', 'rtv:sair'])
  })

  it('ehIdRtv reconhece só os ids do ramo', () => {
    expect(ehIdRtv('rtv:voltar')).toBe(true)
    expect(ehIdRtv('p1:artha')).toBe(false)
    expect(ehIdRtv(null)).toBe(false)
  })

  it('ehIdConhecido passa a incluir o ramo rtv', () => {
    expect(ehIdConhecido('rtv:sair')).toBe(true)
  })

  it('mensagemTerminal resolve um id rtv pelo idP1', () => {
    expect(mensagemTerminal('rtv:problema', null)).toBe(RESPOSTA_POR_ID['rtv:problema'])
  })
})

describe('triagem do ramo rtv', () => {
  const IDS_RTV2 = RTV2.botoes.map((b) => b.id)

  it('rtv:voltar ABRE a triagem e não é terminal', () => {
    expect(perguntaRtv2('rtv:voltar')).toBe(RTV2)
    expect(ehTerminalRtv('rtv:voltar')).toBe(false)
  })

  it('os outros dois do nível 1 são terminais', () => {
    expect(ehTerminalRtv('rtv:problema')).toBe(true)
    expect(ehTerminalRtv('rtv:sair')).toBe(true)
  })

  it('todo id da triagem é terminal', () => {
    for (const id of IDS_RTV2) expect(ehTerminalRtv(id), id).toBe(true)
  })

  it('perguntaRtv2 devolve null para qualquer id que não abre', () => {
    for (const id of ['rtv:problema', 'rtv:sair', 'p1:artha', ...IDS_RTV2]) {
      expect(perguntaRtv2(id), id).toBeNull()
    }
  })

  it('a triagem tem três botões dentro do limite de título', () => {
    expect(RTV2.botoes).toHaveLength(MAX_BOTOES)
    for (const b of RTV2.botoes) {
      expect(b.titulo.length, `"${b.titulo}"`).toBeLessThanOrEqual(MAX_TITULO)
    }
  })

  it('todo terminal do ramo tem resposta, e rtv:voltar NÃO tem', () => {
    // Os dois lados importam. Sem o segundo, deixar a resposta velha de
    // `rtv:voltar` para trás passaria despercebido e o bot mandaria texto E
    // pergunta no mesmo turno.
    for (const id of [...RTV_IDS, ...IDS_RTV2]) {
      if (ehTerminalRtv(id)) expect(RESPOSTA_POR_ID[id], `sem resposta: ${id}`).toBeTruthy()
    }
    expect(RESPOSTA_POR_ID['rtv:voltar']).toBeUndefined()
  })

  it('todo terminal tem tag, e rtv:voltar não', () => {
    for (const id of [...RTV_IDS, ...IDS_RTV2]) {
      if (ehTerminalRtv(id)) expect(TAG_POR_RESPOSTA[id], `sem tag: ${id}`).toBeTruthy()
    }
    expect(TAG_POR_RESPOSTA['rtv:voltar']).toBeUndefined()
  })

  it('ehIdRtv1 e ehIdRtv2 não se sobrepõem', () => {
    for (const id of RTV_IDS) {
      expect(ehIdRtv1(id), id).toBe(true)
      expect(ehIdRtv2(id), id).toBe(false)
    }
    for (const id of IDS_RTV2) {
      expect(ehIdRtv2(id), id).toBe(true)
      expect(ehIdRtv1(id), id).toBe(false)
    }
    expect(ehIdRtv1(null)).toBe(false)
    expect(ehIdRtv2(null)).toBe(false)
  })

  it('ehIdConhecido cobre os dois níveis', () => {
    expect(ehIdConhecido('rtv:voltar')).toBe(true)
    expect(ehIdConhecido('rtv2:preco')).toBe(true)
  })
})

describe('variantes de disparo', () => {
  const VARIANTES = Object.entries(TEMPLATES_RTV)

  it('são três', () => {
    expect(VARIANTES).toHaveLength(3)
  })

  it('a chave do registro é o nome do template', () => {
    // Fonte única: o script de criação e o montador de payload leem daqui, e
    // divergir entre chave e `nome` faria um submeter A e o outro procurar B.
    for (const [chave, t] of VARIANTES) expect(t.nome).toBe(chave)
  })

  it('cada variante passa na validação local da Meta', () => {
    for (const [nome, t] of VARIANTES) expect(validarTemplate(t), nome).toEqual([])
  })

  it('nenhum corpo abre ou fecha em variável', () => {
    for (const [nome, t] of VARIANTES) {
      const c = t.corpo.trim()
      expect(c.startsWith('{{'), nome).toBe(false)
      expect(c.endsWith('}}'), nome).toBe(false)
    }
  })

  it('cada corpo tem uma variável e um exemplo', () => {
    for (const [nome, t] of VARIANTES) {
      expect(t.corpo.match(/\{\{\d+\}\}/g), nome).toHaveLength(1)
      expect(t.exemplos, nome).toHaveLength(1)
    }
  })

  it('todas usam os mesmos três botões do nível 1', () => {
    for (const [nome, t] of VARIANTES) {
      expect(t.botoes.map((b) => b.texto), nome).toEqual(RTV_BOTOES.map((b) => b.titulo))
    }
  })

  it('nenhuma promete teste grátis ou devolução', () => {
    // Trava a §6.1: "testa por um mês" saiu do corpo porque o site não vende
    // trial, e sem isto a frase volta na próxima revisão de copy sem ninguém ver.
    for (const [nome, t] of VARIANTES) {
      expect(t.corpo, nome).not.toMatch(/gr[áa]tis|gratuit|devolu[çc][ãa]o|reembolso/i)
    }
  })

  it('nenhuma copy do ramo cita nome de persona', () => {
    const textos = [
      ...VARIANTES.map(([, t]) => t.corpo),
      ...RTV2.botoes.map((b) => RESPOSTA_POR_ID[b.id]),
      RTV2.corpo,
    ]
    for (const t of textos) expect(t).not.toMatch(/L[úu]cia|Clara|LucIA/i)
  })

  it('a copy do ramo segue as regras de escrita do gestor', () => {
    const textos = [
      ...VARIANTES.map(([, t]) => t.corpo),
      RTV2.corpo,
      RTV2.corpoRepetido,
      ...RTV2.botoes.map((b) => RESPOSTA_POR_ID[b.id]),
    ]
    for (const t of textos) {
      expect(t, 'sem travessão').not.toMatch(/—/)
      expect(t, 'sem markdown').not.toMatch(/\*|_{2}|#/)
      for (const linha of t.split('\n')) {
        if (linha.includes('http')) expect(linha.trim()).toMatch(/^https?:\/\/\S+$/)
      }
    }
  })
})
