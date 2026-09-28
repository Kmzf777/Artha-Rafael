import { describe, it, expect } from 'vitest'
import { proximoPasso, type MensagemBot } from './estado'
import { AUTOR_BOT, P1, P2_POR_RAMO, RTV2 } from './roteiro'

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

/**
 * Quick reply de template: chega como `type: 'button'` com `button.payload` no
 * `button_id` (ver `idDoBotao` em webhookParse). O id é do template, não do
 * roteiro.
 */
function doTemplate(): MensagemBot {
  return entrada({ message_type: 'button', content: 'Quero voltar', button_id: 'quero_voltar' })
}

/** Quick reply de template COM payload nosso, como a fila passa a mandar. */
function doTemplateRtv(id: string): MensagemBot {
  return entrada({ message_type: 'button', content: 'x', button_id: id })
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
      botao('p2:artha_preco'),
    ])
    expect(passo).toEqual({
      acao: 'encerrar',
      idP1: 'p1:artha',
      idP2: 'p2:artha_preco',
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
      botao('p2:artha_preco'),
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
      botao('p2:artha_preco'),
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
      botao('p2:artha_preco'),
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

  // O id do template vir ANTES da p1 não pode contar como roteiro encerrado.
  it('24. id de template no primeiro inbound pergunta a p1 e o roteiro segue', () => {
    const template = doTemplate()
    expect(proximoPasso([template])).toEqual({ acao: 'perguntar', pergunta: P1 })
    expect(proximoPasso([template, doBot(), botao('p1:artha')])).toEqual({
      acao: 'perguntar',
      pergunta: P2_POR_RAMO['p1:artha'],
    })
  })

  it('25. quem responde a um disparo tocando o botão do template é qualificado', () => {
    const camp = disparo()
    const template = doTemplate()
    expect(proximoPasso([camp, template])).toEqual({ acao: 'perguntar', pergunta: P1 })

    const passo = proximoPasso([
      camp,
      template,
      doBot(),
      botao('p1:dhana'),
      doBot(),
      botao('p2:dhana_demo'),
    ])
    expect(passo).toEqual({
      acao: 'encerrar',
      idP1: 'p1:dhana',
      idP2: 'p2:dhana_demo',
      comFecho: true,
    })
  })

  // Os quatro seguintes fixam a definição de "conversa anterior": o que separa
  // é ter havido uma SAÍDA no meio, não a quantidade de mensagens do lead.
  it('26. mensagem dupla na mesma chegada ainda é primeiro contato', () => {
    const passo = proximoPasso([entrada({ content: 'oi' }), entrada({ content: 'tudo bem?' })])
    expect(passo).toEqual({ acao: 'perguntar', pergunta: P1 })
  })

  it('27. quem toca o botão do template e ainda escreve continua sendo primeiro contato', () => {
    const passo = proximoPasso([disparo(), doTemplate(), entrada({ content: 'quero saber mais' })])
    expect(passo).toEqual({ acao: 'perguntar', pergunta: P1 })
  })

  it('28. quem escreveu antes do disparo e voltou depois dele não vê o bot', () => {
    const passo = proximoPasso([entrada({ content: 'oi' }), disparo(), entrada({ content: 'voltei' })])
    expect(passo.acao).toBe('calar')
  })

  it('29. quem já tinha respondido a um disparo anterior não vê o bot', () => {
    const passo = proximoPasso([disparo(), doTemplate(), disparo(), doTemplate()])
    expect(passo.acao).toBe('calar')
  })

  it('30. o botão do template com payload nosso não é descartado', () => {
    // ESTE É O TESTE QUE PROVA O DEFEITO DE 2026-08-25 CONSERTADO. Contra
    // aquele código ele falha devolvendo { acao: 'perguntar', pergunta: P1 }:
    // o disparo grava autoria nula, o portão de primeiro contato tratava o
    // toque como primeiro contato, e o `button_id` ia para o lixo.
    //
    // Usava `rtv:voltar` até 2026-09-28. Ele deixou de encerrar porque passou a
    // ABRIR a triagem — esse caminho agora é o teste 39. Um terminal prova a
    // mesma coisa e continua provando depois da mudança.
    expect(proximoPasso([disparo(), doTemplateRtv('rtv:problema')])).toEqual({
      acao: 'encerrar',
      idP1: 'rtv:problema',
      idP2: null,
      comFecho: true,
    })
  })

  it('32. o bot não fala duas vezes no mesmo toque', () => {
    expect(proximoPasso([disparo(), doTemplateRtv('rtv:voltar'), doBot()]).acao).toBe('calar')
  })

  it('33. a porta orgânica não regride: texto livre continua abrindo na p1', () => {
    expect(proximoPasso([entrada()])).toEqual({ acao: 'perguntar', pergunta: P1 })
  })

  it('34. operador que já falou desliga o bot também no ramo rtv', () => {
    expect(proximoPasso([doHumano(), disparo(), doTemplateRtv('rtv:voltar')]).acao).toBe('calar')
  })

  it('35. depois do terminal rtv, texto livre não traz a p1 de volta', () => {
    // O bot pediu "me conta o que travou". A pessoa contou. Devolver o menu de
    // segmentação aqui é o defeito que este ramo existe para consertar.
    const passo = proximoPasso([
      disparo(),
      doTemplateRtv('rtv:problema'),
      doBot(),
      entrada({ content: 'nao conectou o Nubank' }),
    ])
    expect(passo.acao).toBe('calar')
  })

  it('36. vale para os dois terminais do nível 1', () => {
    // `rtv:voltar` saiu daqui em 2026-09-28: ele abre a triagem, então escrever
    // depois dele não é "escrever depois do fim do roteiro" — a pergunta está
    // pendente e o certo é repetir a triagem, que é o teste 42.
    for (const id of ['rtv:problema', 'rtv:sair']) {
      const passo = proximoPasso([disparo(), doTemplateRtv(id), doBot(), entrada({ content: 'oi' })])
      expect(passo.acao, `${id} deixou a p1 voltar`).toBe('calar')
    }
  })

  it('37. quem pediu para sair não recebe menu de vendas ao responder', () => {
    const passo = proximoPasso([
      disparo(),
      doTemplateRtv('rtv:sair'),
      doBot(),
      entrada({ content: 'ok obrigado' }),
    ])
    expect(passo.acao).toBe('calar')
  })

  it('38. segundo toque num TERMINAL do template não responde de novo', () => {
    // A porta de campanha vem antes de tudo, então sem o portão de estado
    // terminal ela seria reentrante e o bot repetiria a resposta a cada toque.
    for (const id of ['rtv:problema', 'rtv:sair']) {
      const passo = proximoPasso([disparo(), doTemplateRtv(id), doBot(), doTemplateRtv(id)])
      expect(passo.acao, id).toBe('calar')
    }
  })

  it('38b. segundo toque num botão que ABRE re-abre a pergunta, como na porta orgânica', () => {
    // Não é exceção do ramo de campanha: `[oi, bot, p1:artha, bot, p1:artha]`
    // também devolve a p2 de novo. Botão que abre re-abre; botão que fecha cala.
    // A pergunta continua genuinamente pendente, e calar deixaria a pessoa sem
    // caminho depois de um toque que ela deu de propósito.
    expect(
      proximoPasso([disparo(), doTemplateRtv('rtv:voltar'), doBot(), doTemplateRtv('rtv:voltar')])
    ).toEqual({ acao: 'perguntar', pergunta: RTV2 })

    expect(proximoPasso([entrada(), doBot(), botao('p1:artha'), doBot(), botao('p1:artha')])).toEqual(
      { acao: 'perguntar', pergunta: P2_POR_RAMO['p1:artha'] }
    )
  })

  it('39. quem aperta Quero voltar recebe a triagem, não o fecho', () => {
    expect(proximoPasso([disparo(), doTemplateRtv('rtv:voltar')])).toEqual({
      acao: 'perguntar',
      pergunta: RTV2,
    })
  })

  it('40. responder a triagem encerra, carregando os dois ids', () => {
    expect(
      proximoPasso([disparo(), doTemplateRtv('rtv:voltar'), doBot(), botao('rtv2:preco')])
    ).toEqual({ acao: 'encerrar', idP1: 'rtv:voltar', idP2: 'rtv2:preco', comFecho: true })
  })

  it('41. depois da triagem respondida, texto livre cala', () => {
    expect(
      proximoPasso([
        disparo(),
        doTemplateRtv('rtv:voltar'),
        doBot(),
        botao('rtv2:preco'),
        doBot(),
        entrada({ content: 'obrigado' }),
      ]).acao
    ).toBe('calar')
  })

  it('42. quem abandona a triagem e escreve recebe a TRIAGEM de volta, não a p1', () => {
    // `rtv:voltar` não é id de p1, então sem carregar o rtv1 pendente o
    // fallback de texto livre devolvia a p1 de segmentação. Mesma família do
    // defeito consertado de manhã, num caminho novo.
    expect(
      proximoPasso([
        disparo(),
        doTemplateRtv('rtv:voltar'),
        doBot(),
        entrada({ content: 'nao sei explicar' }),
      ])
    ).toEqual({ acao: 'repetir', pergunta: RTV2 })
  })

  it('43. insistindo uma segunda vez, entrega a gente', () => {
    expect(
      proximoPasso([
        disparo(),
        doTemplateRtv('rtv:voltar'),
        doBot(),
        entrada({ content: 'nao sei' }),
        doBot(),
        entrada({ content: 'serio, nao sei' }),
      ])
    ).toEqual({ acao: 'encerrar', idP1: null, idP2: null, comFecho: false })
  })

  it('44. os outros dois do nível 1 continuam encerrando em um toque', () => {
    for (const id of ['rtv:problema', 'rtv:sair']) {
      expect(proximoPasso([disparo(), doTemplateRtv(id)])).toEqual({
        acao: 'encerrar',
        idP1: id,
        idP2: null,
        comFecho: true,
      })
    }
  })
})
