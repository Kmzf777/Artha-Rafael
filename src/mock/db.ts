// Dataset da demo (spec §4.2). Fonte única de número do sistema inteiro.
//
// SEMENTE DETERMINÍSTICA — regra dura deste arquivo:
//   · zero `Math.random()`, zero `Date.now()`, zero `new Date()` sem argumento;
//   · toda data é offset fixo de `ANCORA`, exportada abaixo;
//   · a variedade vem de um LCG semeado com constante, avaliado UMA vez na
//     carga do módulo — nunca em tempo de render.
// Um screenshot tirado hoje tem de reproduzir amanhã.
//
// Os volumes (760 / 148 / 612) são os números que o cliente citou na reunião.
// Não são digitados em lugar nenhum da UI: `src/mock/metrics.ts` os deriva
// daqui. Alterar as distribuições abaixo muda todas as telas de uma vez.

// Import relativo (e não `@/lib/...`) de propósito: `vitest.config.ts` não
// declara o alias `@`, e este módulo precisa carregar sob o test runner.
import { conversationKey } from '../lib/conversationKey'
import type {
  Agendamento,
  AgendamentoStatus,
  Campanha,
  Conversa,
  DeliveryStatus,
  FunnelStage,
  Lead,
  Message,
  PlanoStatus,
  QuickReply,
  Segmento,
  Template,
} from './types'

// ---------------------------------------------------------------------------
// Âncora temporal
// ---------------------------------------------------------------------------

/**
 * Meio-dia de Brasília do dia corrente, resolvido UMA vez no carregamento do
 * módulo — nunca em render.
 *
 * A âncora era fixa em 2026-08-17. Todo dado do mock é offset dela, mas
 * `formatMsgTime`/`formatSectionDate` decidem "Hoje"/"Ontem" contra o relógio do
 * sistema: com a âncora congelada, no dia seguinte o thread inteiro trocava
 * "14:32" por "17/08/26" e a demo parecia parada no tempo. Como os offsets são
 * relativos, mover a âncora mantém o mundo fictício internamente idêntico —
 * mesmas contagens, mesmas distâncias, mesmos rótulos — e sempre no presente.
 *
 * Resolvida no load, e não a cada chamada, para que uma sessão inteira compartilhe
 * um único "agora": duas telas abertas à meia-noite não podem discordar sobre que
 * dia é hoje.
 */
function ancoraDoDia(): Date {
  const agora = new Date()
  const meioDia = new Date(agora)
  meioDia.setUTCHours(15, 0, 0, 0) // 12:00 em Brasília (UTC-3)
  // Nunca no futuro: rodar de manhã não pode carimbar mensagem à tarde.
  return meioDia.getTime() > agora.getTime() ? agora : meioDia
}

export const ANCORA = ancoraDoDia()
export const ANCORA_ISO = ANCORA.toISOString()

/**
 * O "agora" das telas. Use isto no lugar de `new Date()` ao calcular janela de
 * 24h, "há quanto tempo", eixo de gráfico — senão cada componente teria o seu
 * próprio relógio e as telas discordariam entre si.
 */
export function agoraDemo(): Date {
  return new Date(ANCORA.getTime())
}

const MIN = 60_000
const HORA = 60 * MIN
const DIA = 24 * HORA

/** ISO de `ms` milissegundos antes da âncora. */
function antes(ms: number): string {
  return new Date(ANCORA.getTime() - ms).toISOString()
}

/** ISO de `ms` milissegundos depois da âncora. */
function depois(ms: number): string {
  return new Date(ANCORA.getTime() + ms).toISOString()
}

// ---------------------------------------------------------------------------
// Instância WhatsApp e operadores
// ---------------------------------------------------------------------------

/** Número WABA fictício da Artha. Uma instância só — não há multi-número aqui. */
export const WABA_PHONE_ID = '790112233445566'
export const WABA_NUMERO = '5534991000100'
export const WABA_ROTULO = 'Artha · (34) 99100-0100'

/** Humanos da operação. Nunca aparecem como persona da automação. */
export const OPERADORES = ['Rafael Recidive', 'Camila Prado', 'Bruno Teixeira'] as const

// ---------------------------------------------------------------------------
// Sorteio determinístico
// ---------------------------------------------------------------------------

/** LCG (Numerical Recipes). Mesma semente, mesma sequência, sempre. */
function prng(semente: number): () => number {
  let s = semente >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

function repetir<T>(pares: [T, number][]): T[] {
  const out: T[] = []
  for (const [valor, n] of pares) for (let i = 0; i < n; i++) out.push(valor)
  return out
}

/** Fisher-Yates com aleatório semeado. Não muta a entrada. */
function embaralhar<T>(itens: T[], semente: number): T[] {
  const out = itens.slice()
  const rnd = prng(semente)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// ---------------------------------------------------------------------------
// Vocabulário brasileiro
// ---------------------------------------------------------------------------

const NOMES = [
  'Ana', 'Bruno', 'Carla', 'Daniel', 'Eduarda', 'Felipe', 'Gabriela', 'Henrique',
  'Isabela', 'João', 'Karina', 'Leonardo', 'Mariana', 'Nathalia', 'Otávio', 'Patrícia',
  'Rafael', 'Sabrina', 'Thiago', 'Vanessa', 'Wagner', 'Yasmin', 'André', 'Beatriz',
  'Caio', 'Débora', 'Emerson', 'Fernanda', 'Gustavo', 'Helena', 'Igor', 'Juliana',
  'Kleber', 'Larissa', 'Marcelo', 'Natália', 'Olívia', 'Paulo', 'Renata', 'Sérgio',
  'Tatiane', 'Vinícius', 'Adriana', 'Bernardo', 'Cristiane', 'Diego', 'Elaine', 'Fábio',
  'Giovana', 'Hugo', 'Ingrid', 'Jorge', 'Letícia', 'Murilo', 'Nádia', 'Pedro',
  'Rodrigo', 'Simone', 'Tiago', 'Viviane', 'Alexandre', 'Camila', 'Douglas', 'Eliane',
]

const SOBRENOMES = [
  'Almeida', 'Barbosa', 'Cardoso', 'Dias', 'Esteves', 'Faria', 'Gomes', 'Henriques',
  'Ibrahim', 'Jardim', 'Lacerda', 'Machado', 'Nogueira', 'Oliveira', 'Pereira', 'Queiroz',
  'Ribeiro', 'Santos', 'Teixeira', 'Vasconcelos', 'Xavier', 'Andrade', 'Bastos', 'Coelho',
  'Duarte', 'Fonseca', 'Guimarães', 'Lima', 'Moreira', 'Neves', 'Pacheco', 'Rezende',
  'Siqueira', 'Tavares', 'Vieira', 'Azevedo', 'Braga', 'Camargo', 'Drummond', 'Ferreira',
  'Godoy', 'Lopes', 'Mendonça', 'Prado',
]

/** Cidades reais de MG e SP, com o DDD verdadeiro. O cliente é de Uberlândia. */
const CIDADES: { cidade: string; ddd: string; peso: number }[] = [
  { cidade: 'Uberlândia, MG', ddd: '34', peso: 170 },
  { cidade: 'Uberaba, MG', ddd: '34', peso: 48 },
  { cidade: 'Araguari, MG', ddd: '34', peso: 26 },
  { cidade: 'Patos de Minas, MG', ddd: '34', peso: 22 },
  { cidade: 'Ituiutaba, MG', ddd: '34', peso: 18 },
  { cidade: 'Araxá, MG', ddd: '34', peso: 16 },
  { cidade: 'Belo Horizonte, MG', ddd: '31', peso: 92 },
  { cidade: 'Contagem, MG', ddd: '31', peso: 24 },
  { cidade: 'Betim, MG', ddd: '31', peso: 18 },
  { cidade: 'Sete Lagoas, MG', ddd: '31', peso: 14 },
  { cidade: 'Ipatinga, MG', ddd: '31', peso: 14 },
  { cidade: 'Juiz de Fora, MG', ddd: '32', peso: 30 },
  { cidade: 'Barbacena, MG', ddd: '32', peso: 12 },
  { cidade: 'Governador Valadares, MG', ddd: '33', peso: 14 },
  { cidade: 'Poços de Caldas, MG', ddd: '35', peso: 18 },
  { cidade: 'Varginha, MG', ddd: '35', peso: 14 },
  { cidade: 'Passos, MG', ddd: '35', peso: 10 },
  { cidade: 'Divinópolis, MG', ddd: '37', peso: 16 },
  { cidade: 'Montes Claros, MG', ddd: '38', peso: 20 },
  { cidade: 'São Paulo, SP', ddd: '11', peso: 96 },
  { cidade: 'Jundiaí, SP', ddd: '11', peso: 16 },
  { cidade: 'Bragança Paulista, SP', ddd: '11', peso: 10 },
  { cidade: 'São José dos Campos, SP', ddd: '12', peso: 20 },
  { cidade: 'Taubaté, SP', ddd: '12', peso: 12 },
  { cidade: 'Santos, SP', ddd: '13', peso: 18 },
  { cidade: 'Bauru, SP', ddd: '14', peso: 16 },
  { cidade: 'Marília, SP', ddd: '14', peso: 10 },
  { cidade: 'Botucatu, SP', ddd: '14', peso: 8 },
  { cidade: 'Sorocaba, SP', ddd: '15', peso: 20 },
  { cidade: 'Ribeirão Preto, SP', ddd: '16', peso: 34 },
  { cidade: 'Franca, SP', ddd: '16', peso: 14 },
  { cidade: 'Araraquara, SP', ddd: '16', peso: 12 },
  { cidade: 'São Carlos, SP', ddd: '16', peso: 12 },
  { cidade: 'São José do Rio Preto, SP', ddd: '17', peso: 18 },
  { cidade: 'Barretos, SP', ddd: '17', peso: 8 },
  { cidade: 'Presidente Prudente, SP', ddd: '18', peso: 12 },
  { cidade: 'Campinas, SP', ddd: '19', peso: 38 },
  { cidade: 'Piracicaba, SP', ddd: '19', peso: 16 },
  { cidade: 'Limeira, SP', ddd: '19', peso: 12 },
]

const CIDADES_SORTEIO = repetir(CIDADES.map((c) => [c, c.peso] as [typeof c, number]))

/**
 * "José" → "jose", para montar e-mail plausível. O descarte é por faixa de
 * código (U+0300..U+036F, os diacríticos combinantes que o NFD separa da
 * letra) e não por classe de regex: um combinante escrito literalmente no
 * código-fonte gruda no caractere anterior e desaparece do editor.
 */
// Mudou para `src/lib/texto.ts`: o servidor precisa dela, e importar deste
// módulo construiria os 760 leads fictícios no load. Reexportada para não
// quebrar chamador nenhum.
import { semAcento } from '../lib/texto'
export { semAcento }

const DOMINIOS = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com.br', 'uol.com.br']

/** Tags por segmento: etiqueta de B2B não pode aparecer em lead pessoa física. */
const TAGS: Record<Segmento, string[]> = {
  artha: [
    'open-finance', 'plano-anual', 'plano-mensal', 'indicação', 'webinar', 'instagram',
    'meta-ads', 'trial', 'reserva-emergência', 'aposentadoria', 'primeiro-investimento',
    'orçamento-familiar',
  ],
  dhana: ['white-label', 'planejador-cfp', 'indicação', 'webinar', 'trial', 'carteira-própria', 'multi-assessor'],
  lucia: ['escritório', 'triagem-whatsapp', 'indicação', 'webinar', 'trial', 'equipe-pequena'],
}

const NOTAS = [
  'Pediu para retomar depois do fechamento do semestre.',
  'Tem conta em três bancos; quer tudo consolidado num painel só.',
  'Cancelou por aperto no orçamento, não por insatisfação.',
  'Prefere contato por WhatsApp, nunca por ligação.',
  'Quer entender a diferença entre o plano mensal e o anual.',
  'Escritório com 4 planejadores; avaliou a versão white-label.',
  'Parou de acessar quando o consentimento de Open Finance venceu.',
  'Indicado por cliente ativo.',
  'Trocou de emprego e pediu para pausar o planejamento.',
  'Interessado em montar reserva de emergência primeiro.',
]

// ---------------------------------------------------------------------------
// Distribuições — a fonte dos 760 / 148 / 612
// ---------------------------------------------------------------------------

/**
 * Segmento × status de plano. Colunas somam 148 ativos e 612 inativos; linhas
 * somam 532 artha (70,0%), 167 dhana (22,0%) e 61 lucia (8,0%).
 * O churn maior no B2C é intencional: é a história que o produto vende.
 */
const DISTRIBUICAO: Record<Segmento, Record<PlanoStatus, number>> = {
  artha: { ativo: 89, cancelado: 250, trial_expirado: 135, inadimplente: 58 },
  dhana: { ativo: 41, cancelado: 61, trial_expirado: 41, inadimplente: 24 },
  lucia: { ativo: 18, cancelado: 20, trial_expirado: 13, inadimplente: 10 },
}

/** Etapa de funil condicionada ao plano. Ativo é sempre `convertido`. */
const ETAPAS_POR_PLANO: Record<PlanoStatus, [FunnelStage, number][]> = {
  ativo: [['convertido', 148]],
  cancelado: [['perdido', 118], ['contatado', 96], ['qualificado', 47], ['novo', 70]],
  trial_expirado: [['novo', 112], ['contatado', 52], ['qualificado', 19], ['perdido', 6]],
  inadimplente: [['contatado', 36], ['qualificado', 30], ['novo', 26]],
}

/**
 * Dias sem acesso dos 612 inativos. TODO inativo tem no mínimo 30 dias — é o
 * que garante que a régua da Reativação (30/60/90/180+) devolva exatamente os
 * mesmos 612 que o Dashboard mostra. Ver `src/mock/metrics.ts`.
 */
const FAIXAS_INATIVIDADE: [[number, number], number][] = [
  [[30, 59], 78],
  [[60, 89], 96],
  [[90, 179], 168],
  [[180, 350], 270],
]

/** Inativos que nunca chegaram a acessar a plataforma (`ultimoAcessoEm: null`). */
const NUNCA_ACESSARAM = 24

// ---------------------------------------------------------------------------
// Geração dos 760 leads
// ---------------------------------------------------------------------------

type Espec = { segmento: Segmento; planoStatus: PlanoStatus }

function montarEspecs(): Espec[] {
  const especs: Espec[] = []
  for (const segmento of ['artha', 'dhana', 'lucia'] as Segmento[]) {
    for (const [planoStatus, n] of Object.entries(DISTRIBUICAO[segmento])) {
      for (let i = 0; i < n; i++) especs.push({ segmento, planoStatus: planoStatus as PlanoStatus })
    }
  }
  return embaralhar(especs, 20260817)
}

function montarLeads(): Lead[] {
  const especs = montarEspecs()
  const total = especs.length

  // Etapa de funil: um sorteio por status de plano, sobre os índices daquele status.
  const stages = new Array<FunnelStage>(total)
  for (const [planoStatus, pares] of Object.entries(ETAPAS_POR_PLANO)) {
    const indices = especs
      .map((e, i) => (e.planoStatus === planoStatus ? i : -1))
      .filter((i) => i >= 0)
    const pool = embaralhar(repetir(pares), 7717 + planoStatus.length)
    indices.forEach((idx, k) => (stages[idx] = pool[k]))
  }

  // Dias sem acesso: ativos são recentes; inativos saem das faixas acima.
  const diasSemAcesso = new Array<number>(total)
  const idxInativos = especs.map((e, i) => (e.planoStatus === 'ativo' ? -1 : i)).filter((i) => i >= 0)
  const faixas = embaralhar(repetir(FAIXAS_INATIVIDADE), 31337)
  const rndFaixa = prng(4242)
  idxInativos.forEach((idx, k) => {
    const [min, max] = faixas[k]
    diasSemAcesso[idx] = min + Math.floor(rndFaixa() * (max - min + 1))
  })
  const rndAtivo = prng(909)
  especs.forEach((e, i) => {
    if (e.planoStatus === 'ativo') diasSemAcesso[i] = Math.floor(rndAtivo() * 26)
  })
  // Os que nunca acessaram: os primeiros da faixa mais antiga, para continuarem
  // caindo em qualquer régua (180+ inclusive) quando o acesso é `null`.
  const semAcesso = new Set(
    idxInativos.filter((i) => diasSemAcesso[i] >= 180).slice(0, NUNCA_ACESSARAM)
  )

  const rnd = prng(1234567)
  return especs.map((espec, i) => {
    const nome = NOMES[(i * 13 + 5) % NOMES.length]
    const sob1 = SOBRENOMES[(i * 7 + 3) % SOBRENOMES.length]
    const sob2 = SOBRENOMES[(i * 29 + 17) % SOBRENOMES.length]
    const nomeCompleto = sob1 === sob2 ? `${nome} ${sob1}` : `${nome} ${sob1} ${sob2}`

    const local = CIDADES_SORTEIO[Math.floor(rnd() * CIDADES_SORTEIO.length)]
    // (i * 104729) mod 1e8 é bijetivo (104729 é primo, coprimo de 1e8):
    // nenhum telefone se repete, e telefone repetido racharia a conversa em dois cards.
    const assinante = String((i * 104729 + 31415926) % 100_000_000).padStart(8, '0')
    const telefone = `55${local.ddd}9${assinante}`

    const dias = diasSemAcesso[i]
    const ultimoAcessoEm = semAcesso.has(i) ? null : antes(dias * DIA)
    // Contato sempre anterior ao último acesso, entre 1 e 3 anos de base.
    const primeiroContatoEm = antes((dias + 45 + Math.floor(rnd() * 620)) * DIA)
    // A última interação (mensagem, campanha) é mais recente que o último acesso.
    const diasInteracao = Math.min(dias, 2 + Math.floor(rnd() * 70))
    const ultimaInteracaoEm = antes(diasInteracao * DIA + Math.floor(rnd() * 20) * HORA)

    const planoValor =
      espec.planoStatus === 'trial_expirado' ? null : rnd() < 0.22 ? 997 : 97

    const pool = TAGS[espec.segmento]
    const tags: string[] = espec.segmento === 'dhana' ? ['white-label'] : espec.segmento === 'lucia' ? ['escritório'] : []
    for (let t = 0, qtd = 1 + Math.floor(rnd() * 2); t < qtd; t++) {
      const tag = pool[Math.floor(rnd() * pool.length)]
      if (!tags.includes(tag)) tags.push(tag)
    }

    const primeiro = semAcento(nome)
    const ultimo = semAcento(sob2)
    const email = `${primeiro}.${ultimo}${10 + (i % 89)}@${DOMINIOS[i % DOMINIOS.length]}`

    return {
      id: `lead_${String(i + 1).padStart(4, '0')}`,
      nome: nomeCompleto,
      telefone,
      email,
      segmento: espec.segmento,
      stage: stages[i],
      planoStatus: espec.planoStatus,
      planoValor,
      ultimoAcessoEm,
      primeiroContatoEm,
      ultimaInteracaoEm,
      cidade: local.cidade,
      tags,
      notas: rnd() < 0.12 ? NOTAS[Math.floor(rnd() * NOTAS.length)] : null,
    }
  })
}

export const LEADS: Lead[] = montarLeads()

/** Chave do card de conversa de um lead — a mesma que `conversationKey` monta. */
export function chaveDoLead(lead: Lead): string {
  return conversationKey({ bsuid: null, phone: lead.telefone, phone_id: WABA_PHONE_ID })!
}

// ---------------------------------------------------------------------------
// Templates aprovados na Meta
// ---------------------------------------------------------------------------

export const TEMPLATES: Template[] = [
  {
    nome: 'reativacao_acesso_parado',
    categoria: 'MARKETING',
    idioma: 'pt_BR',
    corpo:
      'Olá, {{1}}! Aqui é da Artha. Vimos que o seu acesso ao planejamento financeiro está parado há alguns meses. Reunimos o que mudou desde então: mais bancos conectados por Open Finance, relatório mensal automático e metas por objetivo. Quer retomar de onde parou?',
    botoes: ['Quero retomar', 'Ver o que mudou', 'Não tenho interesse'],
    status: 'aprovado',
  },
  {
    nome: 'reativacao_plano_cancelado',
    categoria: 'MARKETING',
    idioma: 'pt_BR',
    corpo:
      'Oi, {{1}}, aqui é da Artha. O seu plano foi cancelado, mas o seu histórico de planejamento continua salvo — nada foi perdido. Se quiser voltar, a sua conta é reativada exatamente de onde você parou.',
    botoes: ['Reativar meu plano', 'Falar com um planejador'],
    status: 'aprovado',
  },
  {
    nome: 'retomar_planejamento_anual',
    categoria: 'MARKETING',
    idioma: 'pt_BR',
    corpo:
      '{{1}}, aqui é da Artha. Quem retoma o planejamento no plano anual paga R$ 997 por 12 meses — o equivalente a R$ 83 por mês, contra R$ 97 no mensal. A sua base de dados e as suas metas continuam lá.',
    botoes: ['Quero o plano anual', 'Prefiro o mensal'],
    status: 'aprovado',
  },
  {
    nome: 'convite_diagnostico_gratuito',
    categoria: 'MARKETING',
    idioma: 'pt_BR',
    corpo:
      'Olá, {{1}}! Aqui é da Artha. Estamos abrindo agendas para um diagnóstico financeiro gratuito de 30 minutos, com um planejador, por videochamada. Sem compromisso de assinatura.',
    botoes: ['Quero o diagnóstico', 'Agora não'],
    status: 'aprovado',
  },
  {
    nome: 'aviso_relatorio_mensal',
    categoria: 'UTILITY',
    idioma: 'pt_BR',
    corpo:
      '{{1}}, o seu relatório mensal da Artha ficou pronto: gastos por categoria, evolução das metas e o resumo das contas conectadas.',
    botoes: ['Ver relatório'],
    status: 'pendente',
  },
]

// ---------------------------------------------------------------------------
// As 14 conversas
// ---------------------------------------------------------------------------

type Esboco = {
  /** Horas antes da âncora. */
  h: number
  dir: 'inbound' | 'outbound'
  tipo: Message['tipo']
  txt: string
  status?: DeliveryStatus
  /** Nome do humano; ausente = automação. */
  por?: string
  camp?: string
}

type Roteiro = {
  /** Perfil do lead que recebe a thread. O primeiro não usado que casar. */
  perfil: (l: Lead) => boolean
  atribuidoA?: string
  naoLidas?: number
  msgs: Esboco[]
}

/** `{n}` vira o primeiro nome do lead sorteado para a thread. */
function comNome(txt: string, lead: Lead): string {
  return txt.replace(/\{n\}/g, lead.nome.split(' ')[0])
}

const semAcessoHa = (dias: number) => (l: Lead) =>
  l.ultimoAcessoEm === null || ANCORA.getTime() - new Date(l.ultimoAcessoEm).getTime() >= dias * DIA

const ROTEIROS: Roteiro[] = [
  // 1 — A ESTRELA DA DEMO: template → clique em botão → qualificação → humano.
  {
    perfil: (l) =>
      l.segmento === 'artha' &&
      l.planoStatus === 'cancelado' &&
      l.stage === 'qualificado' &&
      l.planoValor === 97 &&
      semAcessoHa(90)(l),
    atribuidoA: 'Rafael Recidive',
    naoLidas: 1,
    msgs: [
      { h: 27, dir: 'outbound', tipo: 'template', status: 'lido', camp: 'camp_002',
        txt: 'Olá, {n}! Aqui é da Artha. Vimos que o seu acesso ao planejamento financeiro está parado há alguns meses. Reunimos o que mudou desde então: mais bancos conectados por Open Finance, relatório mensal automático e metas por objetivo. Quer retomar de onde parou?' },
      { h: 3.4, dir: 'inbound', tipo: 'button', txt: 'Quero retomar' },
      { h: 3.35, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Que bom te ver de volta, {n}. Para retomar do jeito certo, três perguntas rápidas. A primeira: você quer voltar ao plano individual ou está buscando algo para um escritório?' },
      { h: 3.1, dir: 'inbound', tipo: 'text', txt: 'Individual mesmo, é pra mim e pra minha esposa' },
      { h: 3.05, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Perfeito. A segunda: o seu objetivo agora é organizar o orçamento do mês a mês ou montar um plano de longo prazo — reserva, aposentadoria, investimentos?' },
      { h: 2.8, dir: 'inbound', tipo: 'text',
        txt: 'Mais longo prazo. O orçamento a gente já organizou, agora queremos montar a reserva e começar a investir' },
      { h: 2.75, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Anotado. A última: prefere o plano mensal de R$ 97 ou o anual de R$ 997, que sai equivalente a R$ 83 por mês?' },
      { h: 2.5, dir: 'inbound', tipo: 'text',
        txt: 'O anual faz mais sentido. Mas queria entender como fica a conexão com os bancos, eu tenho conta em três' },
      { h: 2.45, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Pode conectar os três: a plataforma consolida tudo em um painel só por Open Finance, e o histórico que você já tinha continua lá. Vou passar você agora para um planejador da Artha finalizar a reativação e detalhar essa parte. Ele responde por aqui mesmo.' },
      { h: 2.2, dir: 'outbound', tipo: 'text', status: 'lido', por: 'Rafael Recidive',
        txt: 'Oi, {n}, aqui é o Rafael, da Artha. Vi que você quer voltar no anual e conectar três bancos. Consigo reativar a sua conta hoje mantendo todo o seu histórico. Te mando o link de pagamento por aqui ou prefere que eu ligue?' },
      { h: 0.7, dir: 'inbound', tipo: 'text', txt: 'Pode mandar o link por aqui mesmo. Obrigado!' },
    ],
  },

  // 2 — Recusa educada: o lead sai da campanha.
  {
    perfil: (l) => l.segmento === 'artha' && l.planoStatus === 'cancelado' && l.stage === 'perdido',
    naoLidas: 0,
    msgs: [
      { h: 50, dir: 'outbound', tipo: 'template', status: 'lido', camp: 'camp_001',
        txt: 'Oi, {n}, aqui é da Artha. O seu plano foi cancelado, mas o seu histórico de planejamento continua salvo — nada foi perdido. Se quiser voltar, a sua conta é reativada exatamente de onde você parou.' },
      { h: 49.6, dir: 'inbound', tipo: 'button', txt: 'Falar com um planejador' },
      { h: 49.5, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Claro, {n}. Antes de agendar: você quer retomar o planejamento agora ou está só olhando as condições?' },
      { h: 48.9, dir: 'inbound', tipo: 'text',
        txt: 'Olhando. Neste momento eu tô sem condições de assumir mensalidade, sinceramente' },
      { h: 48.8, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Entendo, {n}, e agradeço a franqueza. Posso te deixar cadastrado para avisar quando abrirmos condição especial de retorno? Sem compromisso nenhum.' },
      { h: 48.2, dir: 'inbound', tipo: 'text', txt: 'Pode sim, obrigado pela atenção' },
      { h: 48.1, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Anotado. Boa sorte com a organização das contas — quando quiser voltar, o seu histórico continua salvo. Equipe Artha.' },
    ],
  },

  // 3 — B2B Dhana: planejador avaliando o white-label.
  {
    perfil: (l) => l.segmento === 'dhana' && l.planoStatus === 'trial_expirado' && l.stage === 'qualificado',
    atribuidoA: 'Camila Prado',
    naoLidas: 0,
    msgs: [
      { h: 30, dir: 'outbound', tipo: 'template', status: 'lido', camp: 'camp_005',
        txt: 'Olá, {n}! Aqui é da Artha. Estamos abrindo agendas para um diagnóstico financeiro gratuito de 30 minutos, com um planejador, por videochamada. Sem compromisso de assinatura.' },
      { h: 29.4, dir: 'inbound', tipo: 'text',
        txt: 'Boa tarde. Na verdade eu testei a plataforma de vocês pro meu escritório, não como cliente pessoa física' },
      { h: 29.3, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Obrigado por avisar, {n} — corrigimos aqui. Nesse caso o produto certo é a plataforma white-label para planejadores. Quantos clientes você atende hoje?' },
      { h: 28.8, dir: 'inbound', tipo: 'text', txt: 'Somos dois planejadores, uns 40 clientes ativos' },
      { h: 28.7, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Nesse porte a versão white-label costuma fazer sentido: painel com a sua marca, seus clientes conectando os bancos por Open Finance e relatório mensal saindo automático. O que travou no teste anterior?' },
      { h: 28.1, dir: 'inbound', tipo: 'text',
        txt: 'A parte de personalizar o relatório com a identidade do escritório. Não achei onde mexia e acabei largando' },
      { h: 28, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Essa parte mudou: hoje a marca, as cores e o rodapé do relatório ficam em Configurações do escritório. Vou te passar para a equipe comercial da Artha montar uma demonstração em cima do seu caso.' },
      { h: 27.9, dir: 'outbound', tipo: 'text', status: 'lido', por: 'Camila Prado',
        txt: 'Oi, {n}, aqui é a Camila, da Artha. Tenho quinta às 15h ou sexta às 10h para te mostrar o painel já com a marca do escritório. Qual fica melhor?' },
      { h: 27.2, dir: 'inbound', tipo: 'text', txt: 'Sexta às 10h fica ótimo' },
      { h: 27.1, dir: 'outbound', tipo: 'text', status: 'lido', por: 'Camila Prado',
        txt: 'Fechado, {n}. Mando o convite por e-mail hoje ainda. Até sexta!' },
    ],
  },

  // 4 — LucIA: escritório de planejamento avaliando a IA operacional.
  {
    perfil: (l) => l.segmento === 'lucia' && l.planoStatus === 'cancelado' && l.stage === 'contatado',
    naoLidas: 0,
    msgs: [
      { h: 74, dir: 'outbound', tipo: 'template', status: 'lido', camp: 'camp_006',
        txt: 'Olá, {n}! Aqui é da Artha. Estamos abrindo agendas para um diagnóstico financeiro gratuito de 30 minutos, com um planejador, por videochamada. Sem compromisso de assinatura.' },
      { h: 73.5, dir: 'inbound', tipo: 'button', txt: 'Quero o diagnóstico' },
      { h: 73.4, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Ótimo, {n}. Antes de agendar: o diagnóstico é para você ou para os clientes do seu escritório?' },
      { h: 72.9, dir: 'inbound', tipo: 'text',
        txt: 'Pro escritório. O que eu preciso mesmo é de alguém pra dar conta do atendimento, hoje somos eu e uma assistente' },
      { h: 72.8, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Entendi. Nesse caso o produto é a IA operacional para escritórios de planejamento: ela faz a triagem do WhatsApp, responde dúvida de rotina e só chama vocês quando o assunto exige. Quer que eu te mostre funcionando?' },
      { h: 72.2, dir: 'inbound', tipo: 'text', txt: 'Quero sim, mas só depois do dia 20, tô fechando o mês agora' },
      { h: 72.1, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Combinado, {n}. Deixei anotado para retomar depois do dia 20. Equipe Artha.' },
    ],
  },

  // 5 — Cliente ativo: consentimento de Open Finance vencido.
  {
    perfil: (l) => l.segmento === 'artha' && l.planoStatus === 'ativo' && l.planoValor === 997,
    atribuidoA: 'Bruno Teixeira',
    naoLidas: 0,
    msgs: [
      { h: 8.5, dir: 'inbound', tipo: 'text',
        txt: 'Boa tarde! Minha conta do banco sumiu do painel, aparece "reconectar". Perdi meus dados?' },
      { h: 8.4, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Boa tarde, {n}. Não perdeu nada. O consentimento de Open Finance vale 12 meses e o seu venceu — o histórico continua salvo, só a atualização automática pausou.' },
      { h: 8.2, dir: 'inbound', tipo: 'text', txt: 'Ah, que alívio. E como eu renovo?' },
      { h: 8.15, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'No painel, em Contas conectadas, o banco aparece com o botão "Reconectar". Você é redirecionado para o app do banco, confirma por lá e volta. Leva menos de dois minutos e os lançamentos do período pausado entram sozinhos.' },
      { h: 7.9, dir: 'inbound', tipo: 'text', txt: 'Fiz aqui, voltou tudo. Obrigado!' },
      { h: 7.85, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Que bom, {n}. Já que estamos aqui: o relatório de agosto sai dia 1º, com gastos por categoria e a evolução das suas metas.' },
      { h: 7.6, dir: 'inbound', tipo: 'text', txt: 'Perfeito, vou acompanhar' },
      { h: 7.55, dir: 'outbound', tipo: 'text', status: 'lido', por: 'Bruno Teixeira',
        txt: 'Qualquer coisa é só chamar por aqui, {n}. Equipe Artha.' },
    ],
  },

  // 6 — Janela de 24h fechada: só template pode sair.
  {
    perfil: (l) => l.segmento === 'artha' && l.planoStatus === 'inadimplente' && l.stage === 'contatado',
    naoLidas: 0,
    msgs: [
      { h: 40, dir: 'outbound', tipo: 'template', status: 'lido', camp: 'camp_001',
        txt: 'Oi, {n}, aqui é da Artha. O seu plano foi cancelado, mas o seu histórico de planejamento continua salvo — nada foi perdido. Se quiser voltar, a sua conta é reativada exatamente de onde você parou.' },
      { h: 39.2, dir: 'inbound', tipo: 'button', txt: 'Reativar meu plano' },
      { h: 39.1, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Boa, {n}. Antes de reativar: a cobrança de julho voltou como não paga. Quer regularizar essa e seguir no mesmo plano, ou prefere recomeçar do zero?' },
      { h: 38.4, dir: 'inbound', tipo: 'text', txt: 'Regularizar. Mas hoje eu não consigo, só na semana que vem' },
      { h: 38.3, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Sem problema. Deixo a reativação agendada para segunda e te aviso por aqui quando estiver liberada.' },
      { h: 30.5, dir: 'inbound', tipo: 'text', txt: 'Beleza, combinado' },
      { h: 30.4, dir: 'outbound', tipo: 'text', status: 'entregue',
        txt: 'Combinado, {n}. Até segunda. Equipe Artha.' },
    ],
  },

  // 7 — Fila de atendimento: inbound sem resposta, esperando a operadora.
  {
    perfil: (l) => l.segmento === 'artha' && l.planoStatus === 'trial_expirado' && l.stage === 'contatado',
    naoLidas: 2,
    msgs: [
      { h: 26, dir: 'outbound', tipo: 'template', status: 'lido', camp: 'camp_004',
        txt: 'Olá, {n}! Aqui é da Artha. Estamos abrindo agendas para um diagnóstico financeiro gratuito de 30 minutos, com um planejador, por videochamada. Sem compromisso de assinatura.' },
      { h: 25.5, dir: 'inbound', tipo: 'button', txt: 'Quero o diagnóstico' },
      { h: 25.4, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Ótimo, {n}. Você tem preferência de dia e horário? Atendemos de segunda a sexta, das 9h às 18h.' },
      { h: 24.8, dir: 'inbound', tipo: 'text', txt: 'De manhã é melhor pra mim' },
      { h: 24.7, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Anotado. Vou verificar as agendas da manhã e te confirmo aqui mesmo.' },
      { h: 2.6, dir: 'inbound', tipo: 'text', txt: 'Oi, conseguiu ver o horário?' },
      { h: 2.55, dir: 'inbound', tipo: 'text', txt: 'É que amanhã eu viajo, queria deixar marcado antes' },
    ],
  },

  // 8 — Disparo que falhou e foi reenviado.
  {
    perfil: (l) => l.segmento === 'artha' && l.planoStatus === 'cancelado' && l.stage === 'contatado',
    naoLidas: 0,
    msgs: [
      { h: 96, dir: 'outbound', tipo: 'template', status: 'falhou', camp: 'camp_002',
        txt: 'Olá, {n}! Aqui é da Artha. Vimos que o seu acesso ao planejamento financeiro está parado há alguns meses. Reunimos o que mudou desde então: mais bancos conectados por Open Finance, relatório mensal automático e metas por objetivo. Quer retomar de onde parou?' },
      { h: 72, dir: 'outbound', tipo: 'template', status: 'lido', camp: 'camp_002',
        txt: 'Olá, {n}! Aqui é da Artha. Vimos que o seu acesso ao planejamento financeiro está parado há alguns meses. Reunimos o que mudou desde então: mais bancos conectados por Open Finance, relatório mensal automático e metas por objetivo. Quer retomar de onde parou?' },
      { h: 71.3, dir: 'inbound', tipo: 'button', txt: 'Ver o que mudou' },
      { h: 71.2, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Desde que você saiu, {n}: 12 bancos novos disponíveis por Open Finance, relatório mensal automático por e-mail e metas por objetivo, com acompanhamento semana a semana. O painel também ficou mais rápido no celular.' },
      { h: 70.6, dir: 'inbound', tipo: 'text', txt: 'Legal. Vou pensar e te falo' },
      { h: 70.5, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Fico à disposição, {n}. Quando quiser, é só responder por aqui. Equipe Artha.' },
    ],
  },

  // 9 — Mídia: print do extrato e comprovante em PDF.
  {
    perfil: (l) => l.segmento === 'artha' && l.planoStatus === 'ativo' && l.planoValor === 97,
    naoLidas: 0,
    msgs: [
      { h: 12, dir: 'inbound', tipo: 'text',
        txt: 'Bom dia! Tem uma despesa duplicada no meu painel, mandei o print aí' },
      { h: 11.9, dir: 'inbound', tipo: 'image', txt: 'extrato-agosto.png' },
      { h: 11.8, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Bom dia, {n}. Recebi o print. Esse lançamento aparece duas vezes porque a mesma compra veio pelo cartão e pela conta corrente. Dá para marcar uma como transferência interna e ela sai do total de gastos.' },
      { h: 11.4, dir: 'inbound', tipo: 'text', txt: 'Perfeito. Onde eu faço isso?' },
      { h: 11.35, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'No lançamento, toque em Categoria e escolha "Transferência entre contas". Mandei o passo a passo em PDF.' },
      { h: 11.3, dir: 'outbound', tipo: 'document', status: 'lido', txt: 'como-marcar-transferencia-interna.pdf' },
      { h: 10.9, dir: 'inbound', tipo: 'text', txt: 'Resolvido, obrigada!' },
    ],
  },

  // 10 — Áudio do lead.
  {
    perfil: (l) => l.segmento === 'artha' && l.planoStatus === 'inadimplente' && l.stage === 'qualificado',
    naoLidas: 1,
    msgs: [
      { h: 34, dir: 'outbound', tipo: 'template', status: 'lido', camp: 'camp_003',
        txt: '{n}, aqui é da Artha. Quem retoma o planejamento no plano anual paga R$ 997 por 12 meses — o equivalente a R$ 83 por mês, contra R$ 97 no mensal. A sua base de dados e as suas metas continuam lá.' },
      { h: 33.2, dir: 'inbound', tipo: 'audio', txt: 'Áudio de 0:38' },
      { h: 33.1, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Ouvi seu áudio, {n}. Resumindo o que entendi: você quer voltar, mas só depois que a fatura em aberto for quitada. É isso?' },
      { h: 32.6, dir: 'inbound', tipo: 'text', txt: 'Isso mesmo' },
      { h: 32.5, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Perfeito. A fatura em aberto pode ser parcelada em duas vezes, e a reativação vale a partir da primeira. Quer que eu deixe encaminhado assim?' },
      { h: 5.2, dir: 'inbound', tipo: 'text', txt: 'Pode deixar sim, me manda os detalhes' },
    ],
  },

  // 11 — Migração para o plano anual.
  {
    perfil: (l) =>
      l.segmento === 'artha' && l.planoStatus === 'cancelado' && l.planoValor === 997 && l.stage === 'qualificado',
    atribuidoA: 'Camila Prado',
    naoLidas: 0,
    msgs: [
      { h: 20, dir: 'outbound', tipo: 'template', status: 'lido', camp: 'camp_003',
        txt: '{n}, aqui é da Artha. Quem retoma o planejamento no plano anual paga R$ 997 por 12 meses — o equivalente a R$ 83 por mês, contra R$ 97 no mensal. A sua base de dados e as suas metas continuam lá.' },
      { h: 19.4, dir: 'inbound', tipo: 'button', txt: 'Quero o plano anual' },
      { h: 19.3, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Ótimo, {n}. Duas perguntas para reativar do jeito certo. Você quer manter as metas que já estavam montadas ou começar um planejamento novo?' },
      { h: 18.9, dir: 'inbound', tipo: 'text', txt: 'Manter. Eu tinha uma meta de reserva que estava quase fechando' },
      { h: 18.8, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Ela continua lá, com o progresso salvo. Segunda: quer reconectar os mesmos bancos de antes ou incluir alguma conta nova?' },
      { h: 18.3, dir: 'inbound', tipo: 'text', txt: 'Os mesmos, e queria incluir a conta do meu MEI também' },
      { h: 18.2, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Dá para incluir. Vale separar pessoa física de MEI em painéis diferentes, senão o gasto da empresa entra no seu orçamento pessoal. Um planejador da Artha assume daqui e organiza isso com você.' },
      { h: 18.1, dir: 'outbound', tipo: 'text', status: 'lido', por: 'Camila Prado',
        txt: 'Oi, {n}, aqui é a Camila, da Artha. Reativei a sua conta no anual e deixei o painel do MEI separado. Já pode entrar e conferir.' },
      { h: 17.5, dir: 'inbound', tipo: 'text', txt: 'Entrei aqui, ficou muito bom. Obrigado, Camila!' },
      { h: 17.4, dir: 'outbound', tipo: 'text', status: 'lido', por: 'Camila Prado',
        txt: 'Que bom, {n}. Qualquer dúvida é só chamar por aqui.' },
    ],
  },

  // 12 — Trial expirado perguntando preço.
  {
    perfil: (l) => l.segmento === 'artha' && l.planoStatus === 'trial_expirado' && l.stage === 'novo',
    naoLidas: 0,
    msgs: [
      { h: 62, dir: 'outbound', tipo: 'template', status: 'lido', camp: 'camp_004',
        txt: 'Olá, {n}! Aqui é da Artha. Estamos abrindo agendas para um diagnóstico financeiro gratuito de 30 minutos, com um planejador, por videochamada. Sem compromisso de assinatura.' },
      { h: 61.5, dir: 'inbound', tipo: 'text', txt: 'Oi. Quanto custa a plataforma depois do teste?' },
      { h: 61.4, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Oi, {n}. São R$ 97 por mês, ou R$ 997 no plano anual — o anual equivale a R$ 83 por mês. Nos dois casos você conecta quantos bancos quiser por Open Finance e recebe o relatório mensal.' },
      { h: 60.9, dir: 'inbound', tipo: 'text', txt: 'E tem fidelidade?' },
      { h: 60.8, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Não. O mensal você cancela quando quiser, direto no painel. No anual, se cancelar antes, a diferença dos meses usados é ajustada.' },
      { h: 60.2, dir: 'inbound', tipo: 'text', txt: 'Certo, vou conversar em casa e te retorno' },
      { h: 60.1, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Fico à disposição, {n}. Se quiser, o diagnóstico gratuito continua de pé, sem compromisso. Equipe Artha.' },
    ],
  },

  // 13 — Parceiro Dhana ativo pedindo suporte.
  {
    perfil: (l) => l.segmento === 'dhana' && l.planoStatus === 'ativo',
    naoLidas: 0,
    msgs: [
      { h: 6, dir: 'inbound', tipo: 'text',
        txt: 'Bom dia. Um cliente meu não consegue conectar o banco no painel do escritório, dá erro na volta' },
      { h: 5.9, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Bom dia, {n}. Esse erro na volta costuma ser consentimento negado no app do banco, quando a pessoa desmarca alguma permissão. Ele chegou a ver a tela de confirmação?' },
      { h: 5.6, dir: 'inbound', tipo: 'text', txt: 'Viu sim, disse que marcou tudo' },
      { h: 5.55, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Então provavelmente é a conta conjunta: nesse caso o banco pede autorização dos dois titulares. Consegue confirmar com ele se a conta é conjunta?' },
      { h: 5.1, dir: 'inbound', tipo: 'text', txt: 'É conjunta com a esposa, acabei de confirmar' },
      { h: 5.05, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'É isso. A esposa precisa aprovar o mesmo consentimento no app dela e a conta aparece no painel em alguns minutos. Se depois disso continuar dando erro, me chama que eu escalo.' },
      { h: 4.7, dir: 'inbound', tipo: 'text', txt: 'Show, vou orientar ele. Valeu!' },
    ],
  },

  // 14 — Reativação longa, com objeção de preço e fechamento.
  {
    perfil: (l) =>
      l.segmento === 'artha' &&
      l.planoStatus === 'cancelado' &&
      l.stage === 'qualificado' &&
      semAcessoHa(180)(l),
    atribuidoA: 'Rafael Recidive',
    naoLidas: 0,
    msgs: [
      { h: 46, dir: 'outbound', tipo: 'template', status: 'lido', camp: 'camp_002',
        txt: 'Olá, {n}! Aqui é da Artha. Vimos que o seu acesso ao planejamento financeiro está parado há alguns meses. Reunimos o que mudou desde então: mais bancos conectados por Open Finance, relatório mensal automático e metas por objetivo. Quer retomar de onde parou?' },
      { h: 45.4, dir: 'inbound', tipo: 'button', txt: 'Ver o que mudou' },
      { h: 45.3, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Desde que você parou, {n}: 12 bancos novos por Open Finance, relatório mensal automático, metas por objetivo com acompanhamento semanal e o painel bem mais rápido no celular.' },
      { h: 44.8, dir: 'inbound', tipo: 'text', txt: 'O que me fez parar foi não conseguir puxar o cartão de crédito, só a conta' },
      { h: 44.7, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Isso mudou. Hoje a fatura do cartão entra junto com a conta, com os lançamentos separados por categoria e a projeção do mês seguinte.' },
      { h: 44.1, dir: 'inbound', tipo: 'text', txt: 'Isso resolveria mesmo. Mas o preço subiu?' },
      { h: 44, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Continua R$ 97 por mês. E tem o anual de R$ 997, equivalente a R$ 83 por mês.' },
      { h: 43.4, dir: 'inbound', tipo: 'text', txt: 'Hmm. Sinceramente achei caro pro que eu usava antes' },
      { h: 43.3, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Justo. Posso te perguntar o que você usava mais? Se era só o controle de gastos, talvez o plano mensal já resolva sem o anual.' },
      { h: 42.7, dir: 'inbound', tipo: 'text', txt: 'Gastos e a meta de viagem. Investimento eu nem cheguei a usar' },
      { h: 42.6, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Então o mensal cobre bem o seu uso, e você fica livre para cancelar quando quiser. Quer que eu reative assim, mantendo a meta de viagem com o progresso que já estava lá?' },
      { h: 42, dir: 'inbound', tipo: 'text', txt: 'A meta ainda tá salva mesmo depois desse tempo todo?' },
      { h: 41.9, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Está. Nada é apagado no cancelamento — só para de atualizar. Ao reativar, os lançamentos do período entram de uma vez.' },
      { h: 41.3, dir: 'inbound', tipo: 'text', txt: 'Então vamos no mensal mesmo' },
      { h: 41.2, dir: 'outbound', tipo: 'text', status: 'lido',
        txt: 'Perfeito, {n}. Vou passar para um planejador da Artha concluir a reativação com você.' },
      { h: 41, dir: 'outbound', tipo: 'text', status: 'lido', por: 'Rafael Recidive',
        txt: 'Oi, {n}, aqui é o Rafael, da Artha. Reativei no mensal e a meta de viagem voltou com o progresso salvo. Faltou só reconectar o cartão — o botão está em Contas conectadas.' },
      { h: 40.4, dir: 'inbound', tipo: 'text', txt: 'Reconectei, apareceu a fatura certinha. Muito bom!' },
      { h: 40.3, dir: 'outbound', tipo: 'text', status: 'lido', por: 'Rafael Recidive',
        txt: 'Ótimo, {n}. Daqui a 30 dias você recebe o primeiro relatório mensal. Qualquer coisa, é só chamar por aqui.' },
    ],
  },
]

function montarConversas(): { conversas: Conversa[]; mensagens: Message[] } {
  const conversas: Conversa[] = []
  const mensagens: Message[] = []
  const usados = new Set<string>()

  ROTEIROS.forEach((roteiro, indice) => {
    const lead = LEADS.find((l) => !usados.has(l.id) && roteiro.perfil(l))
    if (!lead) return // perfil sem candidato: a thread simplesmente não existe
    usados.add(lead.id)

    const conversaId = `conv_${String(indice + 1).padStart(2, '0')}`
    const ordenadas = roteiro.msgs.slice().sort((a, b) => b.h - a.h)

    ordenadas.forEach((m, k) => {
      mensagens.push({
        id: `msg_${conversaId}_${String(k + 1).padStart(2, '0')}`,
        conversaId,
        direcao: m.dir,
        tipo: m.tipo,
        conteudo: comNome(m.txt, lead),
        criadoEm: antes(Math.round(m.h * HORA)),
        ...(m.dir === 'outbound' ? { status: m.status ?? 'entregue' } : {}),
        ...(m.por ? { enviadoPor: m.por } : {}),
        ...(m.camp ? { campanhaId: m.camp } : {}),
      })
    })

    const ultima = ordenadas[ordenadas.length - 1]
    const ultimoInbound = ordenadas.filter((m) => m.dir === 'inbound').pop()

    conversas.push({
      id: conversaId,
      leadId: lead.id,
      ultimaMensagemEm: antes(Math.round(ultima.h * HORA)),
      naoLidas: roteiro.naoLidas ?? 0,
      // Derivada da thread, nunca digitada: `getWindowStatus` tem de concordar.
      janela24hExpiraEm: ultimoInbound
        ? new Date(ANCORA.getTime() - Math.round(ultimoInbound.h * HORA) + DIA).toISOString()
        : null,
      atribuidoA: roteiro.atribuidoA ?? null,
    })

    // A conversa é a interação mais recente do lead — a tabela de Leads mostra isso.
    lead.ultimaInteracaoEm = antes(Math.round(ultima.h * HORA))
  })

  return { conversas, mensagens }
}

const { conversas: CONVERSAS_INICIAIS, mensagens: MENSAGENS_INICIAIS } = montarConversas()

export const CONVERSAS: Conversa[] = CONVERSAS_INICIAIS
export const MENSAGENS: Message[] = MENSAGENS_INICIAIS

// ---------------------------------------------------------------------------
// Campanhas
// ---------------------------------------------------------------------------

/**
 * `convertidos` aqui é assinatura fechada e atribuída à campanha — não é a
 * etapa `convertido` do funil de leads (que conta quem assina hoje).
 */
export const CAMPANHAS: Campanha[] = [
  {
    id: 'camp_001',
    nome: 'Plano cancelado — primeira leva',
    template: 'reativacao_plano_cancelado',
    criadaEm: antes(52 * DIA),
    segmentoAlvo: 'artha',
    enviados: 180, entregues: 171, respondidos: 63, qualificados: 24, convertidos: 9,
  },
  {
    id: 'camp_002',
    nome: 'Acesso parado há 90 dias ou mais',
    template: 'reativacao_acesso_parado',
    criadaEm: antes(34 * DIA),
    segmentoAlvo: 'artha',
    enviados: 240, entregues: 228, respondidos: 82, qualificados: 31, convertidos: 11,
  },
  {
    id: 'camp_003',
    nome: 'Oferta de retorno no plano anual',
    template: 'retomar_planejamento_anual',
    criadaEm: antes(19 * DIA),
    segmentoAlvo: 'artha',
    enviados: 120, entregues: 116, respondidos: 44, qualificados: 19, convertidos: 8,
  },
  {
    id: 'camp_004',
    nome: 'Diagnóstico gratuito — trial expirado',
    template: 'convite_diagnostico_gratuito',
    criadaEm: antes(11 * DIA),
    segmentoAlvo: 'todos',
    enviados: 96, entregues: 90, respondidos: 27, qualificados: 12, convertidos: 4,
  },
  {
    id: 'camp_005',
    nome: 'Planejadores — retomada Dhana',
    template: 'reativacao_plano_cancelado',
    criadaEm: antes(6 * DIA),
    segmentoAlvo: 'dhana',
    enviados: 74, entregues: 71, respondidos: 26, qualificados: 11, convertidos: 5,
  },
  {
    id: 'camp_006',
    nome: 'Escritórios — retomada LucIA',
    template: 'convite_diagnostico_gratuito',
    criadaEm: antes(3 * DIA),
    segmentoAlvo: 'lucia',
    enviados: 32, entregues: 31, respondidos: 12, qualificados: 6, convertidos: 2,
  },
]

// ---------------------------------------------------------------------------
// Agendamentos
// ---------------------------------------------------------------------------

const ERROS_ENVIO = [
  'Número sem conta de WhatsApp ativa',
  'Template pausado pela Meta por queda de qualidade',
  'Limite de disparos do número atingido nas últimas 24h',
  'Destinatário bloqueou o recebimento de mensagens',
]

function montarAgendamentos(): Agendamento[] {
  const alvos = LEADS.filter((l) => l.planoStatus !== 'ativo')
  const statusPool = embaralhar(
    repetir<AgendamentoStatus>([
      ['pendente', 14], ['enviando', 2], ['enviado', 17], ['falhou', 4], ['cancelado', 3],
    ]),
    5150
  )
  const templates = ['reativacao_acesso_parado', 'reativacao_plano_cancelado', 'retomar_planejamento_anual', 'convite_diagnostico_gratuito']

  return statusPool.map((status, i) => {
    // Passo primo sobre a lista de inativos: nunca repete lead nos 40.
    const lead = alvos[(i * 37 + 11) % alvos.length]
    const futuro = status === 'pendente' || status === 'cancelado'
    return {
      id: `agd_${String(i + 1).padStart(3, '0')}`,
      leadId: lead.id,
      template: templates[i % templates.length],
      agendadoPara: futuro
        ? depois((2 + i * 47) * MIN + (i % 5) * HORA)
        : antes((1 + i * 53) * MIN),
      status,
      tentativas: status === 'enviado' ? 1 : status === 'falhou' ? 3 : status === 'enviando' ? 1 : 0,
      erro: status === 'falhou' ? ERROS_ENVIO[i % ERROS_ENVIO.length] : null,
    }
  })
}

export const AGENDAMENTOS: Agendamento[] = montarAgendamentos()

// ---------------------------------------------------------------------------
// Respostas rápidas
// ---------------------------------------------------------------------------

export const QUICK_REPLIES: QuickReply[] = [
  { id: 'qr_1', shortcut: 'planos', message: 'O plano mensal é R$ 97 e o anual R$ 997 (equivalente a R$ 83 por mês). Nos dois você conecta quantos bancos quiser por Open Finance.' },
  { id: 'qr_2', shortcut: 'openfinance', message: 'A conexão com o banco é por Open Finance: você autoriza no app do próprio banco e o painel consolida tudo automaticamente. O consentimento vale 12 meses.' },
  { id: 'qr_3', shortcut: 'reativar', message: 'Consigo reativar a sua conta mantendo todo o histórico e as metas. Quer seguir no mensal ou no anual?' },
  { id: 'qr_4', shortcut: 'historico', message: 'Nada é apagado no cancelamento — o histórico só para de atualizar. Ao reativar, os lançamentos do período entram de uma vez.' },
  { id: 'qr_5', shortcut: 'diagnostico', message: 'Posso agendar um diagnóstico financeiro gratuito de 30 minutos com um planejador, por videochamada, sem compromisso.' },
  { id: 'qr_6', shortcut: 'despedida', message: 'Fico à disposição por aqui. Equipe Artha.' },
]
