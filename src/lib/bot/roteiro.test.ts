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
  mensagensTerminais,
  LINK_CUPOM,
  ehIdConhecido,
  RTV_IDS,
  RTV_BOTOES,
  ehIdRtv,
  TEMPLATES_RTV,
} from './roteiro'
import { componentesDeBotao, validarTemplate } from '../templates'

const TODAS = [P1, ...Object.values(P2_POR_RAMO)]

/**
 * Terminal é todo botão da p1 sem ramo em P2_POR_RAMO, mais todos os botões das
 * p2. DERIVADO da árvore, nunca escrito à mão: um ramo que vire terminal numa
 * revisão futura entra nesta lista sozinho, em vez de escapar em silêncio.
 *
 * O rtv entra inteiro: os três botões do template são terminais desde
 * 2026-10-15, quando a triagem saiu do ramo.
 */
const TERMINAIS = [
  ...P1.botoes.map((b) => b.id).filter((id) => !(id in P2_POR_RAMO)),
  ...Object.values(P2_POR_RAMO).flatMap((p) => p.botoes.map((b) => b.id)),
  ...RTV_IDS,
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

  // A chave existir não basta. `mensagensTerminais` só cai no FECHO quando o valor
  // é `undefined`, então uma string vazia atravessa a checagem de cobertura, sai
  // pela Cloud API e chega no WhatsApp como mensagem em branco. É a mesma falha
  // que `mensagensTerminais` existe para impedir, alcançada por outro lado.
  it('nenhuma resposta é vazia', () => {
    for (const [id, texto] of Object.entries(RESPOSTA_POR_ID)) {
      expect(texto.trim().length, `${id} tem resposta vazia`).toBeGreaterThan(0)
    }
    expect(FECHO.trim().length).toBeGreaterThan(0)
  })
})

describe('mensagensTerminais', () => {
  it('devolve a resposta do id de nível 2', () => {
    expect(mensagensTerminais('p1:artha', 'p2:artha_preco', null)).toEqual([RESPOSTA_POR_ID['p2:artha_preco']])
  })

  it('cai no id de nível 1 quando não há nível 2', () => {
    expect(mensagensTerminais('p1:outro', null, null)).toEqual([FECHO])
  })

  it('devolve o fecho para quem encaminha', () => {
    expect(mensagensTerminais('p1:dhana', 'p2:dhana_demo', null)).toEqual([FECHO])
    expect(mensagensTerminais('p1:dhana', 'p2:humano', null)).toEqual([FECHO])
    expect(mensagensTerminais('rtv:problema', null, 'Rafael')).toEqual([FECHO])
  })

  it('nome com `$&` sai literal (sem interpretação de padrão do replace)', () => {
    expect(mensagensTerminais('rtv:sair', null, 'A$&B')).toEqual([
      'Obrigado pelo retorno, A$&B. Se precisar de ajuda com as finanças, fale comigo.',
    ])
  })

  it('id desconhecido cai no fecho, nunca em silêncio', () => {
    expect(mensagensTerminais(null, null, null)).toEqual([FECHO])
    expect(mensagensTerminais('p1:artha', 'p2:inexistente', null)).toEqual([FECHO])
  })

  it('Quero voltar manda o link sozinho e depois a frase, com o nome', () => {
    expect(mensagensTerminais('rtv:voltar', null, 'Rafael')).toEqual([
      LINK_CUPOM,
      'Ótimo, Rafael. É só você clicar no link acima e fazer a sua inscrição. Já estará com o cupom aplicado. Mas o cupom é válido somente hoje, ok?',
    ])
  })

  it('Não quero receber agradece pelo nome', () => {
    expect(mensagensTerminais('rtv:sair', null, 'Rafael')).toEqual([
      'Obrigado pelo retorno, Rafael. Se precisar de ajuda com as finanças, fale comigo.',
    ])
  })

  it('sem nome, a frase perde o vocativo e não sobra vírgula', () => {
    for (const nome of [null, '', '   ', '+5534999990000']) {
      const [, frase] = mensagensTerminais('rtv:voltar', null, nome)
      expect(frase, String(nome)).toMatch(/^Ótimo\. É só você/)
      expect(mensagensTerminais('rtv:sair', null, nome)[0], String(nome)).toMatch(/^Obrigado pelo retorno\. Se/)
    }
  })

  it('o placeholder {vocativo} nunca vaza', () => {
    for (const id of Object.keys(RESPOSTA_POR_ID)) {
      for (const m of mensagensTerminais(id, null, 'Ana')) expect(m).not.toContain('{vocativo}')
    }
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

  it('mensagensTerminais resolve um id rtv pelo idP1', () => {
    expect(mensagensTerminais('rtv:sair', null, null)).toEqual([
      'Obrigado pelo retorno. Se precisar de ajuda com as finanças, fale comigo.',
    ])
  })
})

describe('terminais do ramo rtv', () => {
  it('os três botões do template são terminais e conhecidos', () => {
    for (const id of RTV_IDS) {
      expect(ehIdRtv(id), id).toBe(true)
      expect(ehIdConhecido(id), id).toBe(true)
    }
    expect(ehIdRtv(null)).toBe(false)
    expect(ehIdRtv('p1:artha')).toBe(false)
  })

  it('ids da triagem antiga deixaram de existir', () => {
    for (const id of ['rtv2:preco', 'rtv2:tecnico', 'rtv2:duvida']) {
      expect(ehIdConhecido(id), id).toBe(false)
      expect(RESPOSTA_POR_ID[id], id).toBeUndefined()
      expect(TAG_POR_RESPOSTA[id], id).toBeUndefined()
    }
  })

  it('cada botão tem a tag combinada', () => {
    expect(TAG_POR_RESPOSTA['rtv:voltar']).toBe('rtv-quer-voltar')
    expect(TAG_POR_RESPOSTA['rtv:problema']).toBe('rtv-precisa-ajuda')
    expect(TAG_POR_RESPOSTA['rtv:sair']).toBe('rtv-optout')
  })

  it('Preciso de ajuda encaminha, não responde', () => {
    expect(IDS_QUE_ENCAMINHAM.has('rtv:problema')).toBe(true)
    expect(RESPOSTA_POR_ID['rtv:problema']).toBeUndefined()
  })

  it('LINK_CUPOM é uma URL https, sozinha', () => {
    // Spec 2026-10-15 §3.3. Este teste falhando é a trava que impede o merge:
    // sem o link, "já estará com o cupom aplicado" é falso.
    expect(LINK_CUPOM).toMatch(/^https:\/\/\S+$/)
    // A spec §3.3 proíbe a home como placeholder: não leva ao cupom.
    expect(LINK_CUPOM).not.toMatch(/^https:\/\/(www\.)?artha\.ia\.br\/?$/)
  })
})

describe('variantes de disparo', () => {
  const VARIANTES = Object.entries(TEMPLATES_RTV)

  it('são cinco', () => {
    expect(VARIANTES).toHaveLength(5)
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
      ...RTV_IDS.flatMap((id) => mensagensTerminais(id, null, 'Ana')),
    ]
    for (const t of textos) expect(t).not.toMatch(/L[úu]cia|Clara|LucIA/i)
  })

  it('a copy do ramo segue as regras de escrita do gestor', () => {
    const textos = [
      ...VARIANTES.map(([, t]) => t.corpo),
      ...RTV_IDS.flatMap((id) => mensagensTerminais(id, null, 'Ana')),
    ]
    for (const t of textos) {
      expect(t, 'sem travessão').not.toMatch(TRAVESSAO)
      expect(t, 'sem dois-pontos introduzindo frase').not.toMatch(/:(\s|$)/m)
      expect(t, 'sem markdown').not.toMatch(/\*|_{2}|#/)
      for (const linha of t.split('\n')) {
        if (linha.includes('http')) expect(linha.trim()).toMatch(/^https?:\/\/\S+$/)
      }
    }
  })
})

describe('mkt_rtv_volta_02 (sem Open Finance)', () => {
  // Spec 2026-10-16. Corpo exato aprovado pelo dono; trocar uma vírgula aqui é
  // trocar o texto que vai para a Meta.
  const CORPO = [
    'Oi, {{1}}. Você sabe pra onde foi o seu dinheiro este mês?',
    '',
    'O Artha junta todos os seus bancos num lugar só e mostra cada gasto, sem planilha. Seu teste acabou, mas a gente guardou uma condição pra você voltar.',
    '',
    'A taxa de adesão de R$100 sai de graça e o primeiro mês fica R$97 em vez de R$197. E a gente te ajuda a conectar seus bancos, o que leva 2 minutos.',
    '',
    'Essa condição vale só hoje. Toque em Quero voltar e o link já chega com o desconto.',
  ].join('\n')

  it('tem o corpo aprovado', () => {
    expect(TEMPLATES_RTV.mkt_rtv_volta_02?.corpo).toBe(CORPO)
  })

  it('não afirma que o lead conectou banco', () => {
    // O público não tem Open Finance confirmado. "Você conectou" é o volta_01.
    expect(TEMPLATES_RTV.mkt_rtv_volta_02?.corpo).not.toMatch(/conectou|reconectar/i)
  })

  it('o toque cai nos mesmos terminais do volta_01', () => {
    // O bot roteia pelo payload do botão. Mesmo payload, mesmo terminal.
    const payloads = componentesDeBotao('mkt_rtv_volta_02').map((c) => c.parameters[0])
    expect(payloads).toEqual(RTV_IDS.map((id) => ({ type: 'payload', payload: id })))
    expect(componentesDeBotao('mkt_rtv_volta_02')).toEqual(componentesDeBotao('mkt_rtv_volta_01'))
    expect(mensagensTerminais('rtv:voltar', null, 'Ana')[0]).toBe(LINK_CUPOM)
  })
})
