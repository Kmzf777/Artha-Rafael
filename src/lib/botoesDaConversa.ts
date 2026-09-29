// Quais botões cada bolha ofereceu, e qual o lead tocou.
//
// DERIVADO, não gravado. O corpo de uma pergunta do bot é string literal exata
// — diferente do template, não tem variável — então casar `content` contra o
// roteiro é igualdade, não heurística. E derivar conserta o histórico inteiro
// que já está no banco, coisa que gravar no envio não faria.
//
// A FALHA É MUDA, NUNCA ERRADA: corpo que não casa devolve bolha sem botão, que
// é o comportamento de antes desta onda. Spec 2026-09-29 §3.1.
import type { Template } from '@/mock/types'
import {
  AUTOR_BOT,
  ehIdP1,
  P1,
  P2_POR_RAMO,
  REPETICAO,
  RTV2,
  type Botao,
  type Pergunta,
} from './bot/roteiro'
import type { Message } from './conversationTypes'

export type BotoesDaBolha = {
  /** Rótulos na ordem em que foram oferecidos. */
  rotulos: string[]
  /** O rótulo que o lead tocou, quando tocou. */
  clicado: string | null
  /** Nome do template, quando a bolha é um disparo. `null` para o bot. */
  nomeTemplate: string | null
}

/** Toda pergunta que o bot sabe fazer. DERIVADA, nunca escrita à mão. */
const PERGUNTAS: Pergunta[] = [P1, ...Object.values(P2_POR_RAMO), RTV2]

/** Corpo da primeira vez. Os corpos são distintos entre si. */
const POR_CORPO = new Map(PERGUNTAS.map((p) => [p.corpo, p]))

/**
 * Corpo de repetição → perguntas que o produzem. É LISTA, não valor único: os
 * dois ramos do nível 2 têm `corpoRepetido` idêntico ("O que você quer saber?")
 * e conjuntos de botões diferentes. Ver §4.2 da spec.
 */
const POR_REPETICAO = new Map<string, Pergunta[]>()
for (const p of PERGUNTAS) {
  const chave = `${REPETICAO}\n\n${p.corpoRepetido}`
  POR_REPETICAO.set(chave, [...(POR_REPETICAO.get(chave) ?? []), p])
}

/** O corpo do template tem no máximo um `{{1}}`; o resto casa literalmente. */
function corpoCasa(corpo: string, conteudo: string): boolean {
  const partes = corpo.split('{{1}}')
  if (partes.length !== 2) return corpo === conteudo
  const [inicio, fim] = partes
  return (
    conteudo.length >= inicio.length + fim.length &&
    conteudo.startsWith(inicio) &&
    conteudo.endsWith(fim)
  )
}

/**
 * A pergunta que produziu este corpo. `ramo` é o último `p1:*` respondido antes
 * da bolha, e só é consultado quando o corpo é ambíguo.
 */
function perguntaDoCorpo(corpo: string, ramo: string | null): Pergunta | null {
  const direta = POR_CORPO.get(corpo)
  if (direta) return direta

  const candidatas = POR_REPETICAO.get(corpo)
  if (!candidatas) return null
  if (candidatas.length === 1) return candidatas[0]

  // Ambígua. Sem o ramo, calar é a única resposta honesta: mostrar os botões da
  // Dhana para quem está na Artha é mentira na tela.
  if (!ramo) return null
  const doRamo = P2_POR_RAMO[ramo]
  return doRamo && candidatas.includes(doRamo) ? doRamo : null
}

/**
 * O título do botão cujo ID casa o próximo inbound.
 *
 * ID É CONTRATO, TÍTULO É COPY — a regra que `roteiro.ts` declara no cabeçalho.
 * Casar pelo id deixa a marcação imune a troca de rótulo, e é mais forte que o
 * caminho de template, que só conhece títulos.
 */
function tituloClicado(botoes: Botao[], mensagens: Message[], i: number): string | null {
  const proximo = mensagens.slice(i + 1).find((m) => m.direction === 'inbound')
  if (!proximo?.button_id) return null
  return botoes.find((b) => b.id === proximo.button_id)?.titulo ?? null
}

export function mapearBotoes(
  mensagens: Message[],
  templates: Template[]
): Map<string, BotoesDaBolha> {
  const mapa = new Map<string, BotoesDaBolha>()
  let ramo: string | null = null

  mensagens.forEach((msg, i) => {
    // O ramo é carregado enquanto se percorre, do mesmo jeito que `proximoPasso`
    // carrega `idP1`. Atualiza antes de resolver a bolha: a resposta do lead
    // nunca é a mesma mensagem que a pergunta do bot.
    if (msg.direction === 'inbound' && ehIdP1(msg.button_id)) ramo = msg.button_id

    if (msg.direction !== 'outbound' || !msg.content) return

    if (msg.message_type === 'interactive' && msg.enviado_por === AUTOR_BOT) {
      const pergunta = perguntaDoCorpo(msg.content, ramo)
      if (!pergunta) return
      mapa.set(msg.id, {
        rotulos: pergunta.botoes.map((b) => b.titulo),
        clicado: tituloClicado(pergunta.botoes, mensagens, i),
        nomeTemplate: null,
      })
      return
    }

    if (msg.message_type === 'template') {
      const conteudo = msg.content
      const template = templates.find((t) => corpoCasa(t.corpo, conteudo))
      if (!template) return
      // O clicado do template casa por TEXTO, não por id: aqui só se conhecem os
      // títulos, e é o título que a Meta manda como conteúdo do toque.
      const proximo = mensagens.slice(i + 1).find((m) => m.direction === 'inbound')
      const clicado =
        proximo?.message_type === 'button' &&
        proximo.content &&
        template.botoes.includes(proximo.content)
          ? proximo.content
          : null
      mapa.set(msg.id, { rotulos: template.botoes, clicado, nomeTemplate: template.nome })
    }
  })

  return mapa
}
