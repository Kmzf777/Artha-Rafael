import { describe, expect, it } from 'vitest'
import { AUTOR_BOT, P1, P2_POR_RAMO, REPETICAO, RTV2 } from './bot/roteiro'
import { mapearBotoes } from './botoesDaConversa'
import type { Message } from './conversationTypes'
import type { Template } from '@/mock/types'

let n = 0
function msg(over: Partial<Message>): Message {
  n += 1
  return {
    id: `m${n}`,
    message_id: `wamid.${n}`,
    phone: '34988861441',
    phone_id: '1',
    bsuid: null,
    contact_name: null,
    message_type: 'text',
    content: null,
    direction: 'inbound',
    created_at: `2026-09-29T12:00:${String(n).padStart(2, '0')}Z`,
    raw_payload: null,
    media_id: null,
    media_mime_type: null,
    media_storage_path: null,
    reply_to_message_id: null,
    enviado_por: null,
    button_id: null,
    ...over,
  }
}

const pergunta = (corpo: string) =>
  msg({ direction: 'outbound', message_type: 'interactive', content: corpo, enviado_por: AUTOR_BOT })
const toque = (id: string, titulo: string) =>
  msg({ message_type: 'interactive', button_id: id, content: titulo })

const TEMPLATE: Template = {
  nome: 'mkt_rtv_isencao_01',
  categoria: 'MARKETING',
  idioma: 'pt_BR',
  corpo: 'Oi, {{1}}. Volte para o Artha.',
  botoes: ['Quero voltar', 'Tive um problema', 'Não quero receber'],
  status: 'aprovado',
}

describe('mapearBotoes — pergunta do bot', () => {
  it('1. o corpo da p1 devolve os três rótulos, na ordem', () => {
    const p = pergunta(P1.corpo)
    expect(mapearBotoes([p], []).get(p.id)?.rotulos).toEqual(P1.botoes.map((b) => b.titulo))
  })

  it('2. a forma de repetição devolve os mesmos rótulos', () => {
    const p = pergunta(`${REPETICAO}\n\n${P1.corpoRepetido}`)
    expect(mapearBotoes([p], []).get(p.id)?.rotulos).toEqual(P1.botoes.map((b) => b.titulo))
  })

  it('3. repetição do nível 2 depois de p1:artha devolve os botões da Artha', () => {
    const artha = P2_POR_RAMO['p1:artha']
    const hist = [
      pergunta(P1.corpo),
      toque('p1:artha', 'Minhas finanças'),
      pergunta(artha.corpo),
      msg({ content: 'texto solto' }),
      pergunta(`${REPETICAO}\n\n${artha.corpoRepetido}`),
    ]
    const alvo = hist[hist.length - 1]
    expect(mapearBotoes(hist, []).get(alvo.id)?.rotulos).toEqual(artha.botoes.map((b) => b.titulo))
  })

  it('4. a MESMA repetição depois de p1:dhana devolve os botões da Dhana', () => {
    // 3 e 4 são o par que prova a desambiguação. Os dois ramos têm
    // `corpoRepetido` IDÊNTICO e botões diferentes; um teste sozinho não prova
    // nada, porque passaria por acidente.
    const dhana = P2_POR_RAMO['p1:dhana']
    const hist = [
      pergunta(P1.corpo),
      toque('p1:dhana', 'Sou planejador'),
      pergunta(dhana.corpo),
      msg({ content: 'texto solto' }),
      pergunta(`${REPETICAO}\n\n${dhana.corpoRepetido}`),
    ]
    const alvo = hist[hist.length - 1]
    expect(mapearBotoes(hist, []).get(alvo.id)?.rotulos).toEqual(dhana.botoes.map((b) => b.titulo))
  })

  it('5. repetição ambígua sem nenhum p1 antes não devolve botões', () => {
    const p = pergunta(`${REPETICAO}\n\n${P2_POR_RAMO['p1:artha'].corpoRepetido}`)
    expect(mapearBotoes([p], []).has(p.id)).toBe(false)
  })

  it('6. corpo desconhecido não devolve botões', () => {
    const p = pergunta('Uma frase que o roteiro nunca disse.')
    expect(mapearBotoes([p], []).has(p.id)).toBe(false)
  })

  it('7. interativa que não é do bot não devolve botões, mesmo casando o corpo', () => {
    // Disparo simulado e envio manual usam `interactive` sem autoria de bot.
    // Dar botões de roteiro a eles seria inventar o que a pessoa recebeu.
    const p = msg({
      direction: 'outbound',
      message_type: 'interactive',
      content: P1.corpo,
      enviado_por: null,
    })
    expect(mapearBotoes([p], []).has(p.id)).toBe(false)
  })

  it('8. o clicado sai do id do próximo inbound, não do texto', () => {
    const p = pergunta(P1.corpo)
    const t = toque('p1:artha', 'ROTULO QUE NAO EXISTE')
    expect(mapearBotoes([p, t], []).get(p.id)?.clicado).toBe('Minhas finanças')
  })

  it('9. sem id conhecido no próximo inbound, clicado é null', () => {
    const p = pergunta(P1.corpo)
    expect(mapearBotoes([p, msg({ content: 'escrevi à mão' })], []).get(p.id)?.clicado).toBeNull()
  })

  it('10. a triagem do ramo de campanha também é reconhecida', () => {
    const p = pergunta(RTV2.corpo)
    expect(mapearBotoes([p], []).get(p.id)?.rotulos).toEqual(RTV2.botoes.map((b) => b.titulo))
  })

  it('11. os corpos de primeira vez são distintos entre si', () => {
    // O índice é um Map por corpo. Se duas perguntas passarem a ter o mesmo
    // corpo, a última vence EM SILÊNCIO e a bolha mostra os botões da outra —
    // que é exatamente o modo de falha que a desambiguação do `corpoRepetido`
    // existe para evitar. Este teste vigia o outro índice, o que hoje não tem
    // colisão e por isso não tem defesa em runtime.
    const corpos = [P1, ...Object.values(P2_POR_RAMO), RTV2].map((p) => p.corpo)
    expect(new Set(corpos).size).toBe(corpos.length)
  })
})

describe('mapearBotoes — disparo de template', () => {
  it('12. corpo que casa o template devolve botões e nome', () => {
    const d = msg({
      direction: 'outbound',
      message_type: 'template',
      content: 'Oi, Rafael. Volte para o Artha.',
    })
    const r = mapearBotoes([d], [TEMPLATE]).get(d.id)
    expect(r?.rotulos).toEqual(TEMPLATE.botoes)
    expect(r?.nomeTemplate).toBe('mkt_rtv_isencao_01')
  })

  it('13. corpo que não casa nada não devolve botões', () => {
    const d = msg({ direction: 'outbound', message_type: 'template', content: 'mkt_rtv_isencao_01' })
    expect(mapearBotoes([d], [TEMPLATE]).has(d.id)).toBe(false)
  })
})
