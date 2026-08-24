import { describe, it, expect } from 'vitest'
import { proximoPasso, type MensagemBot } from './estado'
import { AUTOR_BOT, P1, P2_POR_RAMO } from './roteiro'

// Relógio fixo: as mensagens só precisam de ordem, não de tempo real.
let t = 0
function ts(): string {
  t += 60_000
  return new Date(1_755_000_000_000 + t).toISOString()
}

function entrada(extra: Partial<MensagemBot> = {}): MensagemBot {
  return {
    direction: 'inbound',
    created_at: ts(),
    message_type: 'text',
    content: 'oi',
    button_id: null,
    enviado_por: null,
    campanha_id: null,
    ...extra,
  }
}

function botao(id: string): MensagemBot {
  return entrada({ message_type: 'interactive', content: 'x', button_id: id })
}

function doBot(): MensagemBot {
  return {
    direction: 'outbound',
    created_at: ts(),
    message_type: 'interactive',
    content: 'x',
    button_id: null,
    enviado_por: AUTOR_BOT,
    campanha_id: null,
  }
}

function doHumano(): MensagemBot {
  return { ...doBot(), enviado_por: 'operacao@artha.ia.br' }
}

/** Disparo de campanha: outbound sem autoria, como `src/server/fila.ts` grava. */
function disparo(): MensagemBot {
  return {
    ...doBot(),
    message_type: 'template',
    enviado_por: null,
    campanha_id: 'camp-1',
  }
}

describe('proximoPasso', () => {
  it('1. conversa vazia devolve calar', () => {
    expect(proximoPasso([]).acao).toBe('calar')
  })

  it('2. primeiro inbound de todos pergunta a p1', () => {
    const passo = proximoPasso([entrada()])
    expect(passo).toEqual({ acao: 'perguntar', pergunta: P1 })
  })

  it('3. quem já tinha escrito antes não vê o bot', () => {
    const passo = proximoPasso([entrada(), entrada()])
    expect(passo.acao).toBe('calar')
  })

  it('4. resposta p1:artha leva à p2 do ramo Artha', () => {
    const passo = proximoPasso([entrada(), doBot(), botao('p1:artha')])
    expect(passo).toEqual({ acao: 'perguntar', pergunta: P2_POR_RAMO['p1:artha'] })
  })

  it('5. resposta p1:dhana leva à p2 do ramo Dhana', () => {
    const passo = proximoPasso([entrada(), doBot(), botao('p1:dhana')])
    expect(passo).toEqual({ acao: 'perguntar', pergunta: P2_POR_RAMO['p1:dhana'] })
  })

  it('6. p1:outro encerra com fecho, sem p2', () => {
    const passo = proximoPasso([entrada(), doBot(), botao('p1:outro')])
    expect(passo).toEqual({
      acao: 'encerrar',
      idP1: 'p1:outro',
      idP2: null,
      comFecho: true,
    })
  })

  it('7. resposta da p2 encerra com fecho e carrega os dois ids', () => {
    const passo = proximoPasso([
      entrada(),
      doBot(),
      botao('p1:artha'),
      doBot(),
      botao('p2:testou'),
    ])
    expect(passo).toEqual({
      acao: 'encerrar',
      idP1: 'p1:artha',
      idP2: 'p2:testou',
      comFecho: true,
    })
  })

  it('8. texto livre na primeira vez repete a pergunta pendente', () => {
    const passo = proximoPasso([entrada(), doBot(), entrada({ content: 'quanto custa?' })])
    expect(passo).toEqual({ acao: 'repetir', pergunta: P1 })
  })

  it('9. texto livre na segunda vez entrega ao humano, em silêncio', () => {
    const passo = proximoPasso([
      entrada(),
      doBot(),
      entrada({ content: 'quanto custa?' }),
      doBot(),
      entrada({ content: 'me responde' }),
    ])
    expect(passo).toEqual({ acao: 'encerrar', idP1: null, idP2: null, comFecho: false })
  })

  it('10. texto livre depois da p1 repete a p2, não a p1', () => {
    const passo = proximoPasso([
      entrada(),
      doBot(),
      botao('p1:artha'),
      doBot(),
      entrada({ content: 'depende' }),
    ])
    expect(passo).toEqual({ acao: 'repetir', pergunta: P2_POR_RAMO['p1:artha'] })
  })

  it('11. botão válido depois de uma repetição segue o roteiro', () => {
    const passo = proximoPasso([
      entrada(),
      doBot(),
      entrada({ content: 'quanto custa?' }),
      doBot(),
      botao('p1:artha'),
    ])
    expect(passo).toEqual({ acao: 'perguntar', pergunta: P2_POR_RAMO['p1:artha'] })
  })

  it('12. operador que fala uma vez desliga o bot para sempre', () => {
    const passo = proximoPasso([entrada(), doBot(), doHumano(), botao('p1:artha')])
    expect(passo.acao).toBe('calar')
  })

  it('13. id de botão fora do roteiro entrega ao humano, em silêncio', () => {
    const passo = proximoPasso([entrada(), doBot(), botao('quero_voltar')])
    expect(passo).toEqual({ acao: 'encerrar', idP1: null, idP2: null, comFecho: false })
  })

  it('14. roteiro completo não fala de novo', () => {
    const passo = proximoPasso([
      entrada(),
      doBot(),
      botao('p1:artha'),
      doBot(),
      botao('p2:testou'),
      doBot(),
    ])
    expect(passo.acao).toBe('calar')
  })

  it('15. última mensagem sendo do bot é reentrega da Meta: cala', () => {
    expect(proximoPasso([entrada(), doBot()]).acao).toBe('calar')
  })

  it('16. ordem do histórico não importa: ordena por created_at', () => {
    const a = entrada()
    const b = doBot()
    const c = botao('p1:artha')
    expect(proximoPasso([c, a, b])).toEqual({
      acao: 'perguntar',
      pergunta: P2_POR_RAMO['p1:artha'],
    })
  })

  it('17. lead que escreve depois do fecho não ouve a pergunta de novo', () => {
    const passo = proximoPasso([
      entrada(),
      doBot(),
      botao('p1:artha'),
      doBot(),
      botao('p2:testou'),
      doBot(),
      entrada({ content: 'obrigado!' }),
    ])
    expect(passo.acao).toBe('calar')
  })

  it('18. botão tocado depois do fecho não reinicia o roteiro', () => {
    const passo = proximoPasso([
      entrada(),
      doBot(),
      botao('p1:artha'),
      doBot(),
      botao('p2:testou'),
      doBot(),
      botao('p1:dhana'),
    ])
    expect(passo.acao).toBe('calar')
  })

  it('19. texto depois de p1:outro não repete a p1', () => {
    const passo = proximoPasso([
      entrada(),
      doBot(),
      botao('p1:outro'),
      doBot(),
      entrada({ content: 'era sobre a nota' }),
    ])
    expect(passo.acao).toBe('calar')
  })

  it('20. lead que insiste depois de id desconhecido não ouve o bot', () => {
    const passo = proximoPasso([
      entrada(),
      doBot(),
      botao('quero_voltar'),
      entrada({ content: 'olá?' }),
    ])
    expect(passo.acao).toBe('calar')
  })

  it('21. botão fora do roteiro depois da p1 entrega ao humano com o segmento', () => {
    const passo = proximoPasso([entrada(), doBot(), botao('p1:artha'), doBot(), botao('quero_voltar')])
    expect(passo).toEqual({
      acao: 'encerrar',
      idP1: 'p1:artha',
      idP2: null,
      comFecho: false,
    })
  })

  it('22. quem responde a um disparo continua sendo primeiro contato', () => {
    const passo = proximoPasso([disparo(), entrada()])
    expect(passo).toEqual({ acao: 'perguntar', pergunta: P1 })
  })

  it('23. resposta manual sem autoria também desliga o bot', () => {
    const manual: MensagemBot = { ...doBot(), message_type: 'text', enviado_por: null }
    const passo = proximoPasso([entrada(), doBot(), manual, botao('p1:artha')])
    expect(passo.acao).toBe('calar')
  })
})
