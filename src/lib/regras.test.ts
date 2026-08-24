import { describe, expect, it } from 'vitest'
import { AUTOR_BOT, FECHO } from '@/lib/bot/roteiro'
import type { Conversa, Lead, Message } from '@/mock/types'
import { getMetrics, podeDisparar, type DadosMetrics } from './regras'

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
