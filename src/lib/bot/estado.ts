// A ÚNICA decisão do bot, como função pura do histórico da conversa.
// Spec 2026-08-24 §3.5.
//
// Não há tabela de sessão. O passo do roteiro é derivado das mensagens, pelo
// mesmo princípio que `janela24h`, `timeline` e `getMetrics` já seguem. Isso dá
// de graça a idempotência que o webhook exige: a Meta reentrega quando a
// resposta demora, e reprocessar o mesmo histórico devolve a mesma decisão.
//
// Sem relógio: nada aqui depende de tempo. A janela de 24h é do executor.
import {
  AUTOR_BOT,
  P1,
  ehIdConhecido,
  ehIdP1,
  ehIdP2,
  perguntaP2,
  type Pergunta,
} from './roteiro'

/**
 * A forma mínima de mensagem que a decisão precisa — o mesmo padrão de
 * `MensagemJanela` em `janela24h.ts`. Declarar o mínimo mantém o módulo puro e
 * o teste construível à mão.
 */
export type MensagemBot = {
  direction: 'inbound' | 'outbound'
  created_at: string
  message_type: string
  content: string | null
  button_id: string | null
  enviado_por: string | null
  /**
   * A campanha que originou a mensagem, quando houver. É o que separa disparo
   * de resposta humana: as duas coisas gravam `enviado_por` nulo hoje, e sem
   * este campo um lead que recebeu template nunca veria o bot.
   */
  campanha_id: string | null
}

export type Passo =
  | { acao: 'perguntar'; pergunta: Pergunta }
  | { acao: 'repetir'; pergunta: Pergunta }
  | { acao: 'encerrar'; idP1: string | null; idP2: string | null; comFecho: boolean }
  | { acao: 'calar' }

const CALAR: Passo = { acao: 'calar' }

/** Quantas vezes o bot pode insistir antes de entregar ao humano. */
const TETO_DE_INSISTENCIA = 1

function ehDoBot(m: MensagemBot): boolean {
  return m.direction === 'outbound' && m.enviado_por === AUTOR_BOT
}

// A checagem é por `campanha_id`, não por `enviado_por !== null`: a resposta
// manual de operador grava autoria nula hoje (`useMessageSender` não manda
// `enviadoPor`, e a rota grava `enviadoPor ?? null`), então exigir autoria
// preenchida deixaria de desligar o bot justamente onde a regra importa. O
// disparo de campanha também grava autoria nula — só que ele não é fala de
// ninguém, e a §3.1 manda que receber template continue sendo primeiro contato.
//
// A checagem é de valor ausente-ou-nulo (`!m.campanha_id`, não `=== null`) DE
// PROPÓSITO: se alguém esquecer a coluna no `select` de `historicoParaBot`, o
// campo chega `undefined` e a comparação estrita faria esta função devolver
// false para todo outbound — a regra do operador morreria em silêncio, sem o
// `tsc` avisar. Assim, o esquecimento faz o bot calar onde deveria falar. É o
// lado errado, mas é o barato: um lead a menos qualificado, contra o bot
// atropelando um atendimento humano.
function ehDeHumano(m: MensagemBot): boolean {
  return m.direction === 'outbound' && m.enviado_por !== AUTOR_BOT && !m.campanha_id
}

/** Resposta que encerra o roteiro: resposta da p2, `p1:outro`, ou id fora do roteiro. */
function ehRespostaTerminal(m: MensagemBot): boolean {
  if (m.direction !== 'inbound' || m.button_id === null) return false
  return ehIdP2(m.button_id) || m.button_id === 'p1:outro' || !ehIdConhecido(m.button_id)
}

export function proximoPasso(mensagens: MensagemBot[]): Passo {
  // Comparar por `getTime()`, não pela string ISO: `janela24h` e `timeline` já
  // parseiam, e com offsets diferentes na mesma lista a ordem lexicográfica
  // inverte a ordem real.
  const ms = [...mensagens].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  if (ms.length === 0) return CALAR

  // Um operador que falou uma vez desliga o bot naquela conversa para sempre.
  // Vem antes de tudo: é a regra que o cliente comprou quando desligou o robô
  // dele por ele responder onde não devia.
  if (ms.some(ehDeHumano)) return CALAR

  // O bot só reage à última mensagem, e só se ela for do lead. Se a última é
  // dele mesmo, não há nada a responder — é reentrega da Meta.
  const ultima = ms[ms.length - 1]
  if (ultima.direction !== 'inbound') return CALAR

  // O bot ainda não falou: é aqui que o gatilho de primeiro contato mora. Mais
  // de um inbound significa que essa pessoa já escreveu antes, e quem já
  // escreveu não vê o bot. Depois que o bot fala, o roteiro continua — a
  // resposta ao botão também chega como inbound.
  if (!ms.some(ehDoBot)) {
    const entradas = ms.filter((m) => m.direction === 'inbound').length
    return entradas > 1 ? CALAR : { acao: 'perguntar', pergunta: P1 }
  }

  // O roteiro já acabou antes desta mensagem: o bot não fala mais. Sem isto, o
  // estado terminal evapora assim que o lead escreve depois do fecho, e ele
  // recebe de volta a pergunta que acabou de responder — o comportamento que
  // motivou este projeto.
  //
  // O corte é a PRIMEIRA fala do bot, não o começo da lista: resposta terminal
  // só quer dizer "o roteiro acabou" dentro de um roteiro que começou. Antes da
  // p1, um `button_id` é de outra história — quick reply de template de
  // disparo, campanha antiga, roteiro trocado. Sem o corte, quem responde a um
  // disparo tocando o botão do template ouvia a p1 (o portão de primeiro
  // contato só conta inbounds) e levava `calar` na resposta seguinte, porque a
  // regra terminal já tinha lido aquele id desconhecido como fim de roteiro:
  // o bot perguntava e sumia, e a coorte de maior intenção era a única que
  // nunca chegava em `qualificarLead`.
  const primeiraFalaDoBot = ms.findIndex(ehDoBot)
  if (ms.slice(0, -1).some((m, i) => i > primeiraFalaDoBot && ehRespostaTerminal(m))) return CALAR

  // A última resposta VÁLIDA do lead define onde o roteiro está.
  const idP1 = ms.reduce<string | null>((acc, m) => (ehIdP1(m.button_id) ? m.button_id : acc), null)

  const id = ultima.button_id
  if (ehIdP2(id)) return { acao: 'encerrar', idP1, idP2: id, comFecho: true }
  if (id === 'p1:outro') return { acao: 'encerrar', idP1: id, idP2: null, comFecho: true }
  if (ehIdP1(id)) {
    const p2 = perguntaP2(id!)
    if (p2) return { acao: 'perguntar', pergunta: p2 }
    return { acao: 'encerrar', idP1: id, idP2: null, comFecho: true }
  }
  // Botão que o roteiro não conhece: campanha antiga ou roteiro trocado no meio.
  // `idP1` vai junto: se a p1 já tinha sido respondida, o segmento é informação
  // boa e jogá-la fora não ajuda ninguém.
  if (id !== null) return { acao: 'encerrar', idP1, idP2: null, comFecho: false }

  // Texto livre. Quantas vezes o bot já falou desde a última resposta válida?
  // Contar mensagens do bot no histórico inteiro daria a resposta errada quando
  // o lead já avançou o roteiro antes de começar a escrever.
  const ultimaValida = ms.reduce<number>(
    (acc, m, i) => (m.direction === 'inbound' && ehIdConhecido(m.button_id) ? i : acc),
    -1
  )
  const falasDoBot = ms.filter((m, i) => i > ultimaValida && ehDoBot(m)).length

  if (falasDoBot > TETO_DE_INSISTENCIA) {
    return { acao: 'encerrar', idP1, idP2: null, comFecho: false }
  }

  const pendente = idP1 ? (perguntaP2(idP1) ?? P1) : P1
  return { acao: 'repetir', pergunta: pendente }
}
