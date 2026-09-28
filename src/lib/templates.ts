// Regras de template da Cloud API, puras e testadas. Existem para pegar
// localmente o que a Meta recusaria — o erro 132018 encontrado no teste real de
// 2026-08-20 é o caso-canário. Ver spec §7.1.
import { PREFIXO_TEMPLATE_RTV, RTV_BOTOES } from './bot/roteiro'

export type BotaoTemplate =
  | { tipo: 'QUICK_REPLY'; texto: string }
  | { tipo: 'URL'; texto: string; url: string }
  | { tipo: 'PHONE_NUMBER'; texto: string; telefone: string }

export type RascunhoTemplate = {
  nome: string
  categoria: 'MARKETING' | 'UTILITY'
  idioma: 'pt_BR'
  cabecalho: string | null
  corpo: string
  exemplos: string[]
  rodape: string | null
  botoes: BotaoTemplate[]
}

const VARIAVEL = /\{\{(\d+)\}\}/g

/** Índices distintos de variável, em ordem crescente. */
function indices(texto: string): number[] {
  const vistos = new Set<number>()
  for (const m of texto.matchAll(VARIAVEL)) vistos.add(Number(m[1]))
  return [...vistos].sort((a, b) => a - b)
}

export function contarVariaveis(texto: string): number {
  return indices(texto).length
}

export function validarTemplate(t: RascunhoTemplate): string[] {
  const erros: string[] = []

  if (!/^[a-z0-9_]+$/.test(t.nome)) {
    erros.push('O nome só aceita letras minúsculas, números e underscore.')
  }

  if (t.corpo.trim() === '') {
    erros.push('O corpo não pode ficar vazio.')
  } else {
    const idx = indices(t.corpo)
    const sequencial = idx.every((n, i) => n === i + 1)
    if (!sequencial) erros.push('As variáveis precisam ser sequenciais a partir de {{1}}.')
    if (idx.length !== t.exemplos.length) {
      const plural = t.exemplos.length === 1 ? 'exemplo' : 'exemplos'
      erros.push(
        `O corpo tem ${idx.length} variáveis e ${t.exemplos.length} ${plural}. Preencha um exemplo para cada.`
      )
    }
  }

  const quickReplies = t.botoes.filter((b) => b.tipo === 'QUICK_REPLY')
  if (quickReplies.length > 3) erros.push('No máximo 3 botões de resposta rápida.')

  for (const b of t.botoes) {
    // Botão URL com variável exige exemplo; botão URL estático NÃO aceita
    // parâmetro nenhum — foi exatamente isso que a Meta recusou com 132018.
    if (b.tipo === 'URL' && contarVariaveis(b.url) > 0) {
      erros.push(`O botão "${b.texto}" usa {{1}} na URL e precisa de um exemplo.`)
    }
  }

  return erros
}

type Parametro = { type: 'text'; text: string }
type ParametroPayload = { type: 'payload'; payload: string }
export type ComponenteEnvio =
  | { type: 'body'; parameters: Parametro[] }
  | { type: 'button'; sub_type: 'url'; index: string; parameters: Parametro[] }
  | { type: 'button'; sub_type: 'quick_reply'; index: string; parameters: ParametroPayload[] }

/**
 * Monta os `components` do POST /messages. Componente vazio é OMITIDO: mandar
 * `button` para um botão URL estático é o erro 132018.
 */
export function parametrosDoTemplate(
  t: RascunhoTemplate,
  valoresDoCorpo: string[],
  valoresDeBotao: string[] = []
): ComponenteEnvio[] {
  const componentes: ComponenteEnvio[] = []

  if (valoresDoCorpo.length > 0) {
    componentes.push({
      type: 'body',
      parameters: valoresDoCorpo.map((text) => ({ type: 'text', text })),
    })
  }

  t.botoes.forEach((b, index) => {
    if (b.tipo !== 'URL') return
    if (contarVariaveis(b.url) === 0) return
    const valor = valoresDeBotao.shift()
    if (valor === undefined) return
    componentes.push({
      type: 'button',
      sub_type: 'url',
      index: String(index),
      parameters: [{ type: 'text', text: valor }],
    })
  })

  return componentes
}

/**
 * Os componentes de botão do envio, resolvidos pelo NOME do template.
 *
 * É esta função que faz o quick reply do disparo chegar no webhook como
 * `rtv:voltar` em vez da string `"Quero voltar"`. O payload de um botão de
 * template não é definido na criação; ele é mandado a cada envio, e sem isto a
 * Meta usa o próprio título — que não é id de roteiro nenhum.
 *
 * POR NOME, e não por uma coluna nova em `agendamentos`: a fila guarda só o
 * nome do template, e acrescentar coluna para doze leads de teste é schema
 * novo por nada. O custo é uma convenção, travada por teste.
 *
 * Não é `parametrosDoTemplate`: aquela resolve variável a partir de um
 * `RascunhoTemplate`, e o worker não tem rascunho em mãos — teria de buscar um
 * por lead disparado.
 */
export function componentesDeBotao(nomeDoTemplate: string): ComponenteEnvio[] {
  if (!nomeDoTemplate.startsWith(PREFIXO_TEMPLATE_RTV)) return []
  return RTV_BOTOES.map((b, index) => ({
    type: 'button' as const,
    sub_type: 'quick_reply' as const,
    index: String(index),
    parameters: [{ type: 'payload' as const, payload: b.id }],
  }))
}
