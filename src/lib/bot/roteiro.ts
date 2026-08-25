// O roteiro do bot, como DADO. Sem decisão nenhuma aqui, quem decide é
// `estado.ts`. Spec 2026-08-25 §3.
//
// OS IDS SÃO O CONTRATO; OS TÍTULOS SÃO COPY. Trocar "Minhas finanças" por
// "Minhas contas" não pode mexer no roteamento, e é por isso que o webhook
// guarda `button_id` além do `content`.
//
// VOZ: institucional. "Aqui é da Artha", "equipe da Artha". Nenhum nome de
// persona, há três em circulação (Lúcia, Clara, LucIA) e a escolha é do
// cliente.
//
// ESCRITA: sem travessão, sem dois-pontos introduzindo frase, sem markdown, e
// link sozinho na linha. São regras do gestor e estão travadas por teste.
import type { Segmento } from '@/mock/types'

/** Autoria das mensagens do bot na coluna `messages.enviado_por`. */
export const AUTOR_BOT = 'bot'

/** Limites da Cloud API para `interactive.type = 'button'`. */
export const MAX_BOTOES = 3
export const MAX_TITULO = 20
export const MAX_CORPO_INTERATIVO = 1024
/** Teto do corpo de uma mensagem de texto simples. */
export const MAX_CORPO_TEXTO = 4096

export type Botao = { id: string; titulo: string }

export type Pergunta = {
  corpo: string
  /**
   * O mesmo texto sem a saudação, usado quando o bot repete a pergunta porque a
   * pessoa escreveu em vez de apertar. Sem isto o menu 1 dá um segundo "Oi!" na
   * mesma conversa, que é o que faz a URA parecer quebrada. Spec §4.4.
   *
   * OBRIGATÓRIO de propósito. Era opcional, e opcional queria dizer que uma
   * pergunta nova entrar no roteiro sem ele trazia a saudação repetida de volta
   * em silêncio. Quando o corpo não tem saudação, repetir o mesmo texto aqui é
   * uma linha de ruído; a alternativa é a regressão voltar sem ninguém ver.
   */
  corpoRepetido: string
  botoes: Botao[]
}

export const P1: Pergunta = {
  corpo: 'Oi! Aqui é da Artha. Me diz o que você procura.',
  corpoRepetido: 'O que você procura?',
  botoes: [
    { id: 'p1:artha', titulo: 'Minhas finanças' },
    { id: 'p1:dhana', titulo: 'Sou planejador' },
    { id: 'p1:outro', titulo: 'Falar com alguém' },
  ],
}

/** A p2 ramifica pela resposta da p1. `p1:outro` não tem p2: encerra ali. */
export const P2_POR_RAMO: Record<string, Pergunta> = {
  'p1:artha': {
    corpo: 'Boa. O que você quer saber?',
    corpoRepetido: 'O que você quer saber?',
    botoes: [
      { id: 'p2:artha_como', titulo: 'Como funciona' },
      { id: 'p2:artha_preco', titulo: 'Preços' },
      { id: 'p2:artha_comecar', titulo: 'Quero começar' },
    ],
  },
  'p1:dhana': {
    corpo: 'Certo. O que você quer saber?',
    corpoRepetido: 'O que você quer saber?',
    botoes: [
      { id: 'p2:dhana_como', titulo: 'Como funciona' },
      { id: 'p2:dhana_demo', titulo: 'Ver demonstração' },
      { id: 'p2:humano', titulo: 'Falar com alguém' },
    ],
  },
}

/**
 * O que sai quando a pessoa aperta. Spec §3.4.
 *
 * PREÇO É FATO COMERCIAL, NÃO COPY. A fonte é https://artha.ia.br, lido em
 * 2026-08-25, e inclui a taxa de adesão de R$100 que o CLAUDE.md omitia. Quando
 * o preço mudar no site, esta string tem de mudar junto: não há nada ligando os
 * dois, e o bot afirmando valor errado para cliente real é reclamação, não bug.
 *
 * Dhana não tem resposta de preço porque não há valor de Dhana publicado em
 * lugar nenhum. Quem pergunta preço de Dhana chega em gente.
 */
export const RESPOSTA_POR_ID: Record<string, string> = {
  'p2:artha_como':
    'A Artha conecta seus bancos, cartões e investimentos uma vez e atualiza tudo sozinha, todo dia.\n\n' +
    'Suas contas de várias instituições ficam num lugar só, sem planilha e sem digitar nada.',

  'p2:artha_preco':
    'No plano mensal são R$197 no primeiro mês e R$97 por mês depois. Os R$100 da entrada são a taxa de adesão.\n\n' +
    'No anual são R$997 pagos de uma vez, sem adesão.',

  'p2:artha_comecar':
    'Ótimo. É por aqui.\n\n' +
    'https://artha.ia.br\n\n' +
    'Você conecta seus bancos por lá. Se travar em algum passo, é só escrever aqui.',

  'p2:dhana_como':
    'A Dhana é a plataforma que você usa para acompanhar seus clientes. ' +
    'Cada um conecta as contas dele e você enxerga a carteira inteira num lugar só, sem pedir extrato para ninguém.',
}

/**
 * Terminais que não respondem nada e entregam a conversa a gente. Spec §3.5.
 *
 * Existe como conjunto explícito, e não como "o que sobra de RESPOSTA_POR_ID",
 * para que esquecer de escrever uma resposta seja um teste vermelho em vez de
 * um encaminhamento silencioso.
 */
export const IDS_QUE_ENCAMINHAM = new Set(['p1:outro', 'p2:dhana_demo', 'p2:humano'])

export const FECHO =
  'Perfeito, obrigado! Já passei para a equipe da Artha, e em instantes alguém te responde por aqui.'

export const REPETICAO = 'Te respondo já. Antes me ajuda com uma coisa.'

/** Só artha e dhana decidem segmento. `p1:outro` não qualifica ninguém. */
export const SEGMENTO_POR_P1: Record<string, Segmento> = {
  'p1:artha': 'artha',
  'p1:dhana': 'dhana',
}

/** Toda resposta terminal vira uma tag no lead. */
export const TAG_POR_RESPOSTA: Record<string, string> = {
  'p1:outro': 'quer-humano',
  'p2:artha_como': 'quer-saber-como',
  'p2:artha_preco': 'quer-saber-preco',
  'p2:artha_comecar': 'quer-comecar',
  'p2:dhana_como': 'dhana-quer-saber-como',
  'p2:dhana_demo': 'dhana-quer-demo',
  'p2:humano': 'quer-humano',
}

const IDS_P1 = new Set(P1.botoes.map((b) => b.id))
const IDS_P2 = new Set(Object.values(P2_POR_RAMO).flatMap((p) => p.botoes.map((b) => b.id)))

export function ehIdP1(id: string | null): boolean {
  return id !== null && IDS_P1.has(id)
}

export function ehIdP2(id: string | null): boolean {
  return id !== null && IDS_P2.has(id)
}

/** Um id que o roteiro não conhece veio de campanha antiga ou de roteiro trocado. */
export function ehIdConhecido(id: string | null): boolean {
  return ehIdP1(id) || ehIdP2(id)
}

export function perguntaP2(idP1: string): Pergunta | null {
  return P2_POR_RAMO[idP1] ?? null
}

/**
 * A mensagem que fecha o roteiro. Spec §4.3.
 *
 * `idP2 ?? idP1` porque `p1:outro` termina no nível 1 e não tem idP2. O
 * fallback para FECHO cobre quem encaminha e qualquer id que entre na árvore sem
 * resposta: falha para a frase de espera, nunca para o silêncio.
 *
 * Mora aqui, e não dentro de `executar.ts`, para ser testável sem banco, sem
 * Meta e sem `server-only`.
 */
export function mensagemTerminal(idP1: string | null, idP2: string | null): string {
  const id = idP2 ?? idP1
  return (id ? RESPOSTA_POR_ID[id] : undefined) ?? FECHO
}
