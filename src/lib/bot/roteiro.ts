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

// ---------------------------------------------------------------------------
// Ramo de campanha. Spec 2026-09-26 §4.
//
// A porta de campanha não tem P1. Os três botões do template SÃO a primeira
// pergunta, e quem aperta já respondeu — perguntar "o que você procura" depois
// disso gasta o turno mais quente do disparo com o que a planilha já responde.
//
// A coorte é 100% Artha B2C, trial expirado, com pelo menos um banco conectado.
// Não há o que segmentar.
// ---------------------------------------------------------------------------

/** Prefixo dos templates que recebem os payloads deste ramo. Spec §5.3. */
export const PREFIXO_TEMPLATE_RTV = 'mkt_rtv'

/**
 * Os botões, NA ORDEM DOS ÍNDICES do template. A ordem é contrato: o payload do
 * quick reply é casado por índice no envio, então trocar duas linhas aqui manda
 * "quero voltar" para quem pediu para sair.
 */
export const RTV_BOTOES: Botao[] = [
  { id: 'rtv:voltar', titulo: 'Quero voltar' },
  { id: 'rtv:problema', titulo: 'Preciso de ajuda' },
  { id: 'rtv:sair', titulo: 'Não quero receber' },
]

export const RTV_IDS = RTV_BOTOES.map((b) => b.id)

/** O terminal que desliga o lead de todo disparo futuro. */
export const ID_OPTOUT = 'rtv:sair'

/**
 * O link de inscrição com o cupom já aplicado, mandado pelo Rafael. Vazio até
 * ele mandar, e há um teste que fica vermelho enquanto estiver vazio: mandar
 * https://artha.ia.br sob "já estará com o cupom aplicado" seria afirmar ao
 * cliente uma coisa falsa. Spec 2026-10-15 §3.3.
 */
export const LINK_CUPOM = ''

const IDS_RTV = new Set(RTV_IDS)

/** Os três botões do template. Desde 2026-10-15 os três encerram o roteiro. */
export function ehIdRtv(id: string | null): boolean {
  return id !== null && IDS_RTV.has(id)
}

/**
 * As três variantes de disparo. Spec 2026-09-28 §4.
 *
 * Moram aqui, junto dos botões, porque o título do botão aparece em dois
 * lugares — no template aprovado e no payload do envio — e os dois têm de ser o
 * mesmo dado. Fontes separadas divergem em silêncio.
 *
 * OS MESMOS TRÊS BOTÕES NAS TRÊS, de propósito: com uma variável mudando por
 * vez, o que o cliente aprende é qual MENSAGEM funciona, não qual botão. Também
 * é o que mantém o mapeamento de payload trivial.
 *
 * O CORPO NÃO ABRE NA VARIÁVEL. A validação da Meta recusa corpo que começa ou
 * termina em parâmetro. Custa três caracteres e evita rejeição depois de
 * submeter. Spec §4.1.
 *
 * A OFERTA VAI NO CORPO, não atrás do botão. Decisão do gestor em 2026-09-26: é
 * verdade, não insinua arquivamento que não vai acontecer, e a impressão do
 * template de marketing é o que se paga — quem não apertar nada precisa ter
 * visto a oferta.
 *
 * ISENÇÃO É FATO COMERCIAL, NÃO COPY. O preço está publicado em
 * https://artha.ia.br e dá para conferir; a isenção de R$100 não está publicada
 * em lugar nenhum. Se o cliente mudar a oferta, estas strings mudam à mão.
 *
 * NENHUMA PROMETE TESTE NOVO. O site não vende trial, e "testa por um mês" lido
 * por quem teve trial expirado lê como período grátis. Spec §6.1, travado por
 * teste.
 */
function rascunhoRtv(nome: string, linhas: string[]) {
  return {
    nome,
    categoria: 'MARKETING' as const,
    idioma: 'pt_BR' as const,
    cabecalho: null,
    corpo: linhas.join('\n'),
    exemplos: ['João'],
    rodape: null,
    botoes: RTV_BOTOES.map((b) => ({ tipo: 'QUICK_REPLY' as const, texto: b.titulo })),
  }
}

export const TEMPLATES_RTV = {
  mkt_rtv_isencao_01: rascunhoRtv('mkt_rtv_isencao_01', [
    'Oi, {{1}}. Você conectou seu banco no Artha e parou no meio do caminho.',
    '',
    'Sua conta continua aqui, do jeito que você deixou.',
    '',
    'A taxa de adesão de R$100 a gente tirou pra você voltar. O primeiro mês sai R$97 em vez de R$197, e a gente te acompanha na hora de reconectar.',
    '',
    'Reconectar leva 2 minutos.',
  ]),

  mkt_rtv_trial_01: rascunhoRtv('mkt_rtv_trial_01', [
    'Oi, {{1}}. Seu teste do Artha terminou e você não chegou a continuar.',
    '',
    'Os bancos que você conectou continuam salvos, do jeito que você deixou.',
    '',
    'Pra voltar, a gente tirou a taxa de adesão de R$100. O primeiro mês sai R$97 em vez de R$197.',
    '',
    'Retomar é de onde você parou, não do zero.',
  ]),

  mkt_rtv_pergunta_01: rascunhoRtv('mkt_rtv_pergunta_01', [
    'Oi, {{1}}. Você sabe quanto gastou no mês passado?',
    '',
    'O Artha responde isso em 1 segundo. Ele soma suas contas e cartões sozinho, sem planilha nenhuma.',
    '',
    'Você chegou a conectar seu banco e parou no meio do caminho. Sua conta continua aqui.',
  ]),

  // Texto do Rafael (cliente), 2026-10-15.
  mkt_rtv_volta_01: rascunhoRtv('mkt_rtv_volta_01', [
    'Oi, {{1}}. Você conectou seu banco no Artha e não assinou. Sua conta continua aqui, do jeito que você deixou.',
    '',
    'A taxa de adesão de R$100 a gente tirou pra você voltar. O primeiro mês sai R$97 em vez de R$197, e a gente te acompanha na hora de reconectar, o que leva 2 minutos.',
  ]),
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
    'No mensal o primeiro mês sai R$197. São R$97 do plano mais R$100 de adesão, que você paga uma vez só. Do segundo mês em diante são R$97.\n\n' +
    'No anual são R$997 pagos de uma vez, e não tem adesão.',

  'p2:artha_comecar':
    'Ótimo. É por aqui.\n\n' +
    'https://artha.ia.br\n\n' +
    'Você conecta seus bancos por lá. Se travar em algum passo, é só escrever aqui.',

  'p2:dhana_como':
    'A Dhana é a plataforma que você usa para acompanhar seus clientes.\n\n' +
    'Cada um conecta as contas dele e você enxerga a carteira inteira num lugar só, sem pedir extrato para ninguém.',

  // Textos do Rafael (cliente), 2026-10-15. `{vocativo}` vira ", Nome" ou some.
  // O link de `rtv:voltar` sai ANTES, em mensagem própria: ver `mensagensTerminais`.
  'rtv:voltar':
    'Ótimo{vocativo}. É só você clicar no link acima e fazer a sua inscrição. Já estará com o cupom aplicado. Mas o cupom é válido somente hoje, ok?',

  'rtv:sair': 'Obrigado pelo retorno{vocativo}. Se precisar de ajuda com as finanças, fale comigo.',
}

/**
 * Terminais que não respondem nada e entregam a conversa a gente. Spec §3.5.
 *
 * Existe como conjunto explícito, e não como "o que sobra de RESPOSTA_POR_ID",
 * para que esquecer de escrever uma resposta seja um teste vermelho em vez de
 * um encaminhamento silencioso.
 */
export const IDS_QUE_ENCAMINHAM = new Set(['p1:outro', 'p2:dhana_demo', 'p2:humano', 'rtv:problema'])

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
  'rtv:voltar': 'rtv-quer-voltar',
  'rtv:problema': 'rtv-precisa-ajuda',
  'rtv:sair': 'rtv-optout',
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
  return ehIdP1(id) || ehIdP2(id) || ehIdRtv(id)
}

export function perguntaP2(idP1: string): Pergunta | null {
  return P2_POR_RAMO[idP1] ?? null
}

/** `, Nome` para quem tem nome de verdade. Lead criado sem cadastro tem `+55…`. */
function vocativo(primeiroNome: string | null): string {
  const nome = primeiroNome?.trim() ?? ''
  return nome && !nome.startsWith('+') ? `, ${nome}` : ''
}

/**
 * As mensagens que encerram o roteiro, em ordem. Spec §4.3. Quase sempre uma;
 * "Quero voltar" manda o link sozinho antes da frase que diz "clicar no link
 * acima".
 *
 * `idP2 ?? idP1` porque `p1:outro` termina no nível 1 e não tem idP2. O
 * fallback para FECHO cobre quem encaminha e qualquer id que entre na árvore sem
 * resposta: falha para a frase de espera, nunca para o silêncio.
 *
 * Mora aqui, e não dentro de `executar.ts`, para ser testável sem banco, sem
 * Meta e sem `server-only`.
 */
export function mensagensTerminais(
  idP1: string | null,
  idP2: string | null,
  primeiroNome: string | null
): string[] {
  const id = idP2 ?? idP1
  const texto = ((id ? RESPOSTA_POR_ID[id] : undefined) ?? FECHO).replace('{vocativo}', vocativo(primeiroNome))
  return id === 'rtv:voltar' ? [LINK_CUPOM, texto] : [texto]
}
