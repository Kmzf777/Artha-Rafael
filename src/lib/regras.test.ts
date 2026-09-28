import { describe, expect, it } from 'vitest'
import { AUTOR_BOT, FECHO } from '@/lib/bot/roteiro'
import type { Conversa, Lead, Message } from '@/mock/types'
import {
  esperandoResposta,
  getMetrics,
  podeDisparar,
  recorteReativacao,
  type DadosMetrics,
} from './regras'

function lead(extra: Partial<Lead> = {}): Lead {
  return {
    id: 'lead_0001',
    nome: 'Fulano de Tal',
    telefone: '5534991000100',
    email: 'fulano@example.com',
    segmento: 'artha',
    stage: 'novo',
    planoStatus: 'cancelado',
    planoValor: null,
    ultimoAcessoEm: null,
    primeiroContatoEm: '2026-01-01T12:00:00.000Z',
    ultimaInteracaoEm: '2026-01-02T12:00:00.000Z',
    cidade: 'Uberlândia, MG',
    tags: [],
    notas: null,
    ...extra,
  }
}

describe('podeDisparar — a trava que impede spam a desconhecidos', () => {
  it('recusa lead de semente', () => {
    expect(podeDisparar(lead({ ficticio: true }))).toBe(false)
  })

  it('libera lead real', () => {
    expect(podeDisparar(lead({ ficticio: false }))).toBe(true)
  })

  it('trata ausência do campo como lead real', () => {
    // Lead vindo de importação antiga não tem a coluna. Bloquear por omissão
    // pararia a operação legítima; a marcação é explícita, e quem semeia marca.
    expect(podeDisparar(lead())).toBe(true)
  })

  it('não confunde outro valor verdadeiro com a marcação', () => {
    // A comparação é estrita: só `true` bloqueia. Um `'false'` vindo de JSON
    // mal tipado não pode virar bloqueio silencioso da campanha real.
    expect(podeDisparar(lead({ ficticio: undefined }))).toBe(true)
  })
})

describe('esperandoResposta — a régua única de fila, para Message e Conversation', () => {
  it('inbound conta, seja qual for a autoria', () => {
    expect(esperandoResposta('inbound', undefined)).toBe(true)
    expect(esperandoResposta('inbound', null)).toBe(true)
    expect(esperandoResposta('inbound', 'alguem')).toBe(true)
  })

  it('outbound do bot conta — ele entrega, não atende', () => {
    expect(esperandoResposta('outbound', AUTOR_BOT)).toBe(true)
  })

  it('outbound de humano nomeado não conta', () => {
    expect(esperandoResposta('outbound', 'operacao@artha.ia.br')).toBe(false)
  })

  it('outbound sem autoria não conta — é a forma que a resposta manual do operador tem hoje', () => {
    expect(esperandoResposta('outbound', null)).toBe(false)
    expect(esperandoResposta('outbound', undefined)).toBe(false)
  })
})

describe('filaAtendimento — o fecho do bot não tira o lead da fila', () => {
  function conversa(extra: Partial<Conversa> = {}): Conversa {
    return {
      id: 'conv_1',
      leadId: 'lead_0001',
      ultimaMensagemEm: '2026-01-01T12:00:00.000Z',
      naoLidas: 0,
      janela24hExpiraEm: null,
      atribuidoA: null,
      ...extra,
    }
  }

  function mensagem(extra: Partial<Message> & Pick<Message, 'id' | 'conversaId'>): Message {
    return {
      direcao: 'outbound',
      tipo: 'text',
      conteudo: 'Oi',
      criadoEm: '2026-01-01T12:00:00.000Z',
      ...extra,
    }
  }

  function dados(conversas: Conversa[], mensagens: Message[]): DadosMetrics {
    return { leads: [], conversas, mensagens, campanhas: [], agendamentos: [] }
  }

  it('conta a conversa cujo fecho do bot foi a última mensagem, mas não a que um humano respondeu por último', () => {
    const cs = [conversa({ id: 'conv_bot' }), conversa({ id: 'conv_humano' })]
    const ms = [
      mensagem({ id: 'm1', conversaId: 'conv_bot', conteudo: FECHO, enviadoPor: AUTOR_BOT }),
      mensagem({
        id: 'm2',
        conversaId: 'conv_humano',
        conteudo: 'Já te respondo',
        enviadoPor: 'operacao@artha.ia.br',
      }),
    ]

    const { conversas } = getMetrics(dados(cs, ms), new Date('2026-01-02T12:00:00.000Z'))

    expect(conversas.filaAtendimento).toBe(1)
  })
})

describe('opt-out', () => {
  it('podeDisparar recusa lead que pediu para sair', () => {
    expect(podeDisparar(lead({ ficticio: false, optoutEm: '2026-09-27T10:00:00.000Z' }))).toBe(false)
  })

  it('podeDisparar aceita lead sem opt-out', () => {
    expect(podeDisparar(lead({ ficticio: false, optoutEm: null }))).toBe(true)
  })

  it('lead sem a propriedade optoutEm continua podendo receber', () => {
    // Lead vindo de select antigo, ou do mock, chega sem a chave. Ausente não
    // pode virar opt-out: silenciaria a base inteira de uma vez. É o mesmo
    // raciocínio do teste de `ficticio` ausente logo acima.
    expect(podeDisparar(lead({ ficticio: false }))).toBe(true)
  })

  it('recorteReativacao não devolve lead com opt-out', () => {
    const agora = new Date('2026-09-27T12:00:00.000Z')
    const leads = [
      lead({ id: 'op1', planoStatus: 'trial_expirado', ultimoAcessoEm: null, optoutEm: '2026-09-27T10:00:00.000Z' }),
      lead({ id: 'op2', planoStatus: 'trial_expirado', ultimoAcessoEm: null, optoutEm: null }),
    ].filter(podeDisparar)
    const r = recorteReativacao(leads, { planoStatus: 'trial_expirado' }, agora)
    expect(r.map((l) => l.id)).toEqual(['op2'])
  })
})
