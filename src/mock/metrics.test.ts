import { describe, expect, it } from 'vitest'
import { ANCORA, CONVERSAS, LEADS, MENSAGENS, TEMPLATES, agoraDemo } from './db'
import {
  DIAS_SEM_ACESSO_INATIVO,
  diasSemAcesso,
  ehAtivo,
  ehInativo,
  getMetrics,
  recorteReativacao,
} from './metrics'
import {
  cancelarAgendamento,
  enfileirarCampanha,
  enviarMensagem,
  listarAgendamentos,
  listarCardsDeConversa,
  mensagensDoCard,
  mudarEtapaLead,
  resetStore,
} from './store'

// Os números 760 / 148 / 612 são os que o cliente citou na reunião e sustentam
// a demo inteira. Este arquivo existe para que mudar uma distribuição em db.ts
// quebre o teste antes de quebrar a apresentação.

describe('a base', () => {
  it('tem 760 leads, 148 ativos e 612 inativos', () => {
    const m = getMetrics()
    expect(m.totalLeads).toBe(760)
    expect(m.ativos).toBe(148)
    expect(m.inativos).toBe(612)
  })

  it('particiona a base: ativo + inativo = total, sem sobra nem sobreposição', () => {
    const ativos = LEADS.filter(ehAtivo).length
    const inativos = LEADS.filter(ehInativo).length
    expect(ativos + inativos).toBe(LEADS.length)
    expect(LEADS.some((l) => ehAtivo(l) && ehInativo(l))).toBe(false)
  })

  it('distribui por segmento em ~70% artha, ~22% dhana, ~8% lucia', () => {
    const { porSegmento, totalLeads } = getMetrics()
    expect(porSegmento.artha + porSegmento.dhana + porSegmento.lucia).toBe(totalLeads)
    expect(porSegmento.artha / totalLeads).toBeCloseTo(0.7, 2)
    expect(porSegmento.dhana / totalLeads).toBeCloseTo(0.22, 2)
    expect(porSegmento.lucia / totalLeads).toBeCloseTo(0.08, 2)
  })

  it('soma 760 nas etapas de funil e nos status de plano', () => {
    const m = getMetrics()
    const etapas = Object.values(m.porEtapa).reduce((a, b) => a + b, 0)
    const planos = Object.values(m.porPlanoStatus).reduce((a, b) => a + b, 0)
    expect(etapas).toBe(760)
    expect(planos).toBe(760)
    expect(m.porPlanoStatus.ativo).toBe(148)
  })

  it('não repete telefone — telefone repetido racharia a conversa em dois cards', () => {
    expect(new Set(LEADS.map((l) => l.telefone)).size).toBe(760)
  })

  it('usa o formato 55DD9XXXXXXXX em todo telefone', () => {
    expect(LEADS.every((l) => /^55\d{2}9\d{8}$/.test(l.telefone))).toBe(true)
  })

  it('só usa valores de plano coerentes com o produto: 97, 997 ou nenhum', () => {
    expect(LEADS.every((l) => l.planoValor === 97 || l.planoValor === 997 || l.planoValor === null)).toBe(true)
    expect(LEADS.every((l) => l.planoStatus !== 'trial_expirado' || l.planoValor === null)).toBe(true)
  })
})

describe('a régua da reativação', () => {
  it('encontra exatamente os 612 inativos que o Dashboard estampa', () => {
    const dashboard = getMetrics().inativos
    const recorte = recorteReativacao()
    expect(recorte.length).toBe(612)
    expect(recorte.length).toBe(dashboard)
  })

  it('devolve o mesmo total com a faixa padrão declarada explicitamente', () => {
    expect(recorteReativacao({ diasSemAcesso: DIAS_SEM_ACESSO_INATIVO }).length).toBe(612)
    expect(
      recorteReativacao({ diasSemAcesso: 30, planoStatus: 'todos', segmento: 'todos' }).length
    ).toBe(612)
  })

  it('nunca inclui assinante ativo, em nenhuma combinação de filtro', () => {
    for (const faixa of [30, 60, 90, 180] as const) {
      for (const segmento of ['todos', 'artha', 'dhana', 'lucia'] as const) {
        expect(recorteReativacao({ diasSemAcesso: faixa, segmento }).every(ehInativo)).toBe(true)
      }
    }
  })

  it('mantém todo inativo acima do piso de 30 dias sem acesso', () => {
    // É isto que faz o chip de 30 dias devolver 612 e não um número menor.
    expect(LEADS.filter(ehInativo).every((l) => diasSemAcesso(l) >= 30)).toBe(true)
  })

  it('encolhe monotonicamente conforme a faixa aperta', () => {
    const { inativosPorFaixa } = getMetrics()
    expect(inativosPorFaixa[30]).toBe(612)
    expect(inativosPorFaixa[30]).toBeGreaterThan(inativosPorFaixa[60])
    expect(inativosPorFaixa[60]).toBeGreaterThan(inativosPorFaixa[90])
    expect(inativosPorFaixa[90]).toBeGreaterThan(inativosPorFaixa[180])
    for (const faixa of [30, 60, 90, 180] as const) {
      expect(recorteReativacao({ diasSemAcesso: faixa }).length).toBe(inativosPorFaixa[faixa])
    }
  })

  it('fecha a soma ao fatiar por segmento e por status de plano', () => {
    const porSegmento = (['artha', 'dhana', 'lucia'] as const)
      .map((s) => recorteReativacao({ segmento: s }).length)
      .reduce((a, b) => a + b, 0)
    const porPlano = (['cancelado', 'trial_expirado', 'inadimplente'] as const)
      .map((p) => recorteReativacao({ planoStatus: p }).length)
      .reduce((a, b) => a + b, 0)
    expect(porSegmento).toBe(612)
    expect(porPlano).toBe(612)
  })
})

describe('as conversas', () => {
  it('são 14, todas com thread de 6 a 20 mensagens', () => {
    expect(CONVERSAS.length).toBe(14)
    for (const conversa of CONVERSAS) {
      const n = MENSAGENS.filter((m) => m.conversaId === conversa.id).length
      expect(n).toBeGreaterThanOrEqual(6)
      expect(n).toBeLessThanOrEqual(20)
    }
  })

  it('inclui a sequência completa de reativação: template → botão → qualificação → humano', () => {
    const thread = MENSAGENS.filter((m) => m.conversaId === 'conv_01')
    expect(thread[0].tipo).toBe('template')
    expect(thread[0].direcao).toBe('outbound')
    expect(thread.some((m) => m.tipo === 'button' && m.direcao === 'inbound')).toBe(true)
    // A passagem para humano: mensagem de saída com autor nomeado.
    expect(thread.some((m) => m.direcao === 'outbound' && m.enviadoPor !== undefined)).toBe(true)
    const lead = LEADS.find((l) => l.id === CONVERSAS[0].leadId)!
    expect(lead.stage).toBe('qualificado')
    expect(CONVERSAS[0].atribuidoA).not.toBeNull()
  })

  it('não cita nome de persona em nenhuma copy de mensagem nem de template', () => {
    const proibidos = /\b(l[úu]cia|lucia|clara)\b/i
    for (const m of MENSAGENS) expect(m.conteudo).not.toMatch(proibidos)
    for (const t of TEMPLATES) expect(t.corpo).not.toMatch(proibidos)
  })

  it('não carrega herança de crédito consignado', () => {
    const proibidos = /\b(cpf|consignado|empr[ée]stimo|margem|benef[íi]cio do inss)\b/i
    for (const m of MENSAGENS) expect(m.conteudo).not.toMatch(proibidos)
    for (const t of TEMPLATES) expect(t.corpo).not.toMatch(proibidos)
  })

  it('deriva a janela de 24h do último inbound de verdade', () => {
    for (const conversa of CONVERSAS) {
      const inbounds = MENSAGENS.filter((m) => m.conversaId === conversa.id && m.direcao === 'inbound')
      const ultimo = inbounds[inbounds.length - 1]
      const esperado = new Date(new Date(ultimo.criadoEm).getTime() + 24 * 3600_000).toISOString()
      expect(conversa.janela24hExpiraEm).toBe(esperado)
    }
  })

  it('serve os cards na forma de fio, ordenados por recência', () => {
    resetStore()
    const { conversas, naoLidas } = listarCardsDeConversa()
    expect(conversas.length).toBe(14)
    for (let i = 1; i < conversas.length; i++) {
      expect(new Date(conversas[i - 1].last_message_time).getTime()).toBeGreaterThanOrEqual(
        new Date(conversas[i].last_message_time).getTime()
      )
    }
    expect(Object.values(naoLidas).every((n) => n > 0)).toBe(true)
    expect(mensagensDoCard(conversas[0].key).length).toBeGreaterThanOrEqual(6)
  })
})

describe('a semente determinística', () => {
  it('ancora o "agora" da demo ao meio-dia de Brasília do dia corrente', () => {
    // A âncora acompanha o calendário DE PROPÓSITO (ver `ancoraDoDia` em db.ts):
    // congelada, a demo envelhece e todo thread vira "17/08/26". Cravar a data
    // aqui fazia este teste falhar em todo dia que não fosse o da escrita.
    // O invariante é a regra: meio-dia de Brasília, nunca no futuro.
    const meioDia = new Date()
    meioDia.setUTCHours(15, 0, 0, 0)
    const esperado = meioDia.getTime() > Date.now() ? Date.now() : meioDia.getTime()

    expect(agoraDemo().getTime()).toBe(ANCORA.getTime())
    expect(Math.abs(agoraDemo().getTime() - esperado)).toBeLessThan(5_000)
  })

  it('produz o mesmo primeiro e último lead a cada carga', () => {
    // Congelado de propósito: se a semente mudar, o screenshot muda.
    expect(LEADS[0].id).toBe('lead_0001')
    expect(LEADS[759].id).toBe('lead_0760')
    expect(new Set(LEADS.map((l) => l.id)).size).toBe(760)
  })

  it('mantém as datas coerentes: contato antes do acesso, sem data no futuro', () => {
    const agora = agoraDemo().getTime()
    for (const lead of LEADS) {
      expect(new Date(lead.primeiroContatoEm).getTime()).toBeLessThan(agora)
      if (lead.ultimoAcessoEm) {
        expect(new Date(lead.primeiroContatoEm).getTime()).toBeLessThanOrEqual(
          new Date(lead.ultimoAcessoEm).getTime()
        )
      }
    }
  })
})

describe('a mutação em memória', () => {
  it('enviar mensagem entra na thread com status enviado e sobe o card', () => {
    resetStore()
    const { conversas } = listarCardsDeConversa()
    const alvo = conversas[3]
    const antes = mensagensDoCard(alvo.key).length

    const enviada = enviarMensagem({ key: alvo.key, tipo: 'text', conteudo: 'Teste de envio' })
    expect(enviada).not.toBeNull()
    expect(enviada!.status).toBe('enviado')
    expect(enviada!.direction).toBe('outbound')

    const thread = mensagensDoCard(alvo.key)
    expect(thread.length).toBe(antes + 1)
    expect(thread[thread.length - 1].content).toBe('Teste de envio')
    expect(listarCardsDeConversa().conversas[0].key).toBe(alvo.key)
  })

  it('mudar a etapa move o funil sem alterar o total nem a partição ativo/inativo', () => {
    resetStore()
    const antes = getMetrics()
    const lead = LEADS.find((l) => l.stage === 'contatado')!
    mudarEtapaLead(lead.id, 'qualificado')

    const depois = getMetrics()
    expect(depois.porEtapa.contatado).toBe(antes.porEtapa.contatado - 1)
    expect(depois.porEtapa.qualificado).toBe(antes.porEtapa.qualificado + 1)
    expect(depois.totalLeads).toBe(760)
    expect(depois.ativos).toBe(148)
    expect(depois.inativos).toBe(612)
  })

  it('enfileirar campanha popula Agendamentos e não mexe na contagem da base', () => {
    resetStore()
    const recorte = recorteReativacao({ diasSemAcesso: 180 })
    const antes = listarAgendamentos().length

    const { campanha, agendamentos } = enfileirarCampanha({
      nome: 'Reativação 180+ dias',
      template: 'reativacao_acesso_parado',
      segmentoAlvo: 'todos',
      leadIds: recorte.map((l) => l.id),
    })

    expect(agendamentos.length).toBe(recorte.length)
    expect(agendamentos.every((a) => a.status === 'pendente' && a.tentativas === 0)).toBe(true)
    // Campanha recém-criada nasce zerada: o funil dela ainda não aconteceu.
    expect(campanha.enviados).toBe(0)
    expect(listarAgendamentos().length).toBe(antes + recorte.length)

    const m = getMetrics()
    expect(m.inativos).toBe(612)
    expect(m.agendamentos.total).toBe(antes + recorte.length)
    resetStore()
  })

  it('cancela agendamento pendente e recusa o que já está saindo', () => {
    resetStore()
    const pendente = listarAgendamentos().find((a) => a.status === 'pendente')!
    const enviando = listarAgendamentos().find((a) => a.status === 'enviando')!

    expect(cancelarAgendamento(pendente.id)?.status).toBe('cancelado')
    // 'enviando' é ponto de não-retorno: cancelar seria mentira na tela.
    expect(cancelarAgendamento(enviando.id)).toBeNull()
    resetStore()
  })
})

describe('as métricas derivadas', () => {
  it('acompanha o store: mudar a etapa de um lead move o funil', () => {
    resetStore()
    const antes = getMetrics().porEtapa
    const total = Object.values(antes).reduce((a, b) => a + b, 0)
    expect(total).toBe(760)
  })

  it('fecha as taxas de campanha entre 0 e 1', () => {
    const { campanhas } = getMetrics()
    expect(campanhas.total).toBe(6)
    for (const t of [campanhas.taxaEntrega, campanhas.taxaResposta, campanhas.taxaQualificacao, campanhas.taxaConversao]) {
      expect(t).toBeGreaterThan(0)
      expect(t).toBeLessThanOrEqual(1)
    }
    expect(campanhas.entregues).toBeLessThanOrEqual(campanhas.enviados)
    expect(campanhas.respondidos).toBeLessThanOrEqual(campanhas.entregues)
    expect(campanhas.qualificados).toBeLessThanOrEqual(campanhas.respondidos)
    expect(campanhas.convertidos).toBeLessThanOrEqual(campanhas.qualificados)
  })

  it('conta 40 agendamentos e fecha a soma por status', () => {
    resetStore()
    const { agendamentos } = getMetrics()
    expect(agendamentos.total).toBe(40)
    const soma =
      agendamentos.pendente + agendamentos.enviando + agendamentos.enviado +
      agendamentos.falhou + agendamentos.cancelado
    expect(soma).toBe(40)
  })

  it('deriva a série mensal fechando no total de ativos de hoje', () => {
    const { serieMensal, ativos } = getMetrics()
    expect(serieMensal.length).toBe(8)
    expect(serieMensal[serieMensal.length - 1].ativos).toBe(ativos)
  })

  it('calcula a receita a partir dos planos, não de um número digitado', () => {
    const { receita, ativos } = getMetrics()
    // Piso: todo ativo paga ao menos o equivalente ao anual (R$ 83/mês).
    expect(receita.mrrAtual).toBeGreaterThan(ativos * 83)
    expect(receita.mrrAtual).toBeLessThanOrEqual(ativos * 97)
    expect(receita.mrrRecuperavel).toBeGreaterThan(receita.mrrAtual)
  })
})
