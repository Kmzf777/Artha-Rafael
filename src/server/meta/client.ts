// src/server/meta/client.ts
// Cliente da WhatsApp Cloud API. Único lugar que fala com graph.facebook.com.
import 'server-only'
import { env } from '../env'
import type { ComponenteEnvio } from '@/lib/templates'

export class MetaError extends Error {
  constructor(readonly codigo: number, readonly detalhe: string) {
    super(`Meta ${codigo}: ${detalhe}`)
    this.name = 'MetaError'
  }
}

/** Corpo pode não ser JSON (502 de gateway devolve HTML). Nunca estoura. */
function comoJson(bruto: string): unknown {
  try {
    return JSON.parse(bruto) as unknown
  } catch {
    return null
  }
}

function objeto(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : null
}

function texto(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined
}

/**
 * Traduz a resposta de erro da Graph para MetaError.
 *
 * `error_data.details` é bem mais específico que `message` e é ele que resolve o
 * caso 132018: `message` diz só "Parameter format does not match", enquanto
 * `details` diz "buttons: Button at index 0 of type Url does not require
 * parameters". Por isso vem primeiro na ordem.
 *
 * Tolera resposta sem `error`, sem JSON nenhum e `error_data` serializado como
 * string — nesses casos cai no status HTTP e no corpo bruto, em vez de estourar
 * um TypeError que apagaria a causa real.
 */
function erroDaResposta(status: number, json: unknown, bruto: string): MetaError {
  const erro = objeto(objeto(json)?.error)

  // Em algumas respostas `error_data` chega como JSON serializado em string.
  const dadosBrutos = erro?.error_data
  const dados = objeto(typeof dadosBrutos === 'string' ? comoJson(dadosBrutos) : dadosBrutos)

  const detalhe =
    texto(dados?.details) ??
    texto(erro?.error_user_msg) ??
    texto(erro?.message) ??
    texto(bruto.slice(0, 300)) ??
    'erro desconhecido'

  const codigo = typeof erro?.code === 'number' ? erro.code : status
  return new MetaError(codigo, detalhe)
}

async function chamar(caminho: string, init?: RequestInit): Promise<unknown> {
  const url = `https://graph.facebook.com/${env.graphVersion}/${caminho}`
  const resp = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.whatsappToken}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    cache: 'no-store',
  })
  const bruto = await resp.text()
  const json = comoJson(bruto)
  if (!resp.ok) throw erroDaResposta(resp.status, json, bruto)
  return json
}

type RespostaEnvio = { messages: { id: string }[]; contacts: { wa_id: string }[] }

/** Texto livre. Só vale dentro da janela de 24h — quem checa é o chamador. */
export async function enviarTexto(para: string, texto: string): Promise<RespostaEnvio> {
  return (await chamar(`${env.phoneNumberId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: para,
      type: 'text',
      text: { preview_url: false, body: texto },
    }),
  })) as RespostaEnvio
}

/**
 * Mensagem com botões de resposta. Só vale DENTRO da janela de 24h — quem checa
 * é o chamador, como em `enviarTexto`.
 *
 * Os limites são validados aqui e estouram antes da chamada: descobrir "3 botões
 * no máximo" por `MetaError` em produção custa uma conversa perdida, e o erro da
 * Graph para isto não diz qual botão é o problema.
 */
export async function enviarBotoes(
  para: string,
  corpo: string,
  botoes: { id: string; titulo: string }[]
): Promise<RespostaEnvio> {
  if (botoes.length === 0 || botoes.length > 3) {
    throw new Error(`enviarBotoes: a Cloud API aceita de 1 a 3 botões, recebi ${botoes.length}`)
  }
  for (const b of botoes) {
    if (b.titulo.length > 20) {
      throw new Error(`enviarBotoes: título "${b.titulo}" passa de 20 caracteres`)
    }
  }

  return (await chamar(`${env.phoneNumberId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: para,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: corpo },
        action: {
          buttons: botoes.map((b) => ({
            type: 'reply',
            reply: { id: b.id, title: b.titulo },
          })),
        },
      },
    }),
  })) as RespostaEnvio
}

/** Template aprovado. Único envio possível fora da janela de 24h. */
export async function enviarTemplate(
  para: string,
  nome: string,
  componentes: ComponenteEnvio[],
  idioma = 'pt_BR'
): Promise<RespostaEnvio> {
  const template: Record<string, unknown> = { name: nome, language: { code: idioma } }
  // Componente vazio é OMITIDO: mandar `components: []` é o erro 132018.
  if (componentes.length > 0) template.components = componentes

  return (await chamar(`${env.phoneNumberId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ messaging_product: 'whatsapp', to: para, type: 'template', template }),
  })) as RespostaEnvio
}

export type NumeroDaMeta = {
  display_phone_number: string
  verified_name: string
  quality_rating: string
  code_verification_status: string
  name_status: string
}

/**
 * Dados do número conectado. É o que a aba de Configurações confere.
 *
 * `name_status` é o campo que interessa ao cliente: `DECLINED` significa que a
 * Meta recusou o nome de exibição — as mensagens saem, mas quem recebe vê só o
 * número. O reenvio para revisão é feito na Business Manager, não por aqui.
 */
export async function dadosDoNumero(): Promise<NumeroDaMeta> {
  const campos = 'display_phone_number,verified_name,quality_rating,code_verification_status,name_status'
  return (await chamar(`${env.phoneNumberId}?fields=${campos}`)) as NumeroDaMeta
}

export async function listarTemplatesDaMeta(): Promise<unknown> {
  return chamar(`${env.wabaId}/message_templates?fields=name,status,category,language,components,id&limit=100`)
}

export async function criarTemplateNaMeta(corpo: Record<string, unknown>): Promise<{ id: string }> {
  return (await chamar(`${env.wabaId}/message_templates`, {
    method: 'POST',
    body: JSON.stringify(corpo),
  })) as { id: string }
}

/** URL temporária da mídia de entrada. Expira em ~5 min e exige o token. */
export async function urlDaMidia(mediaId: string): Promise<string> {
  const r = (await chamar(mediaId)) as { url: string }
  return r.url
}

/**
 * Baixa o binário da mídia. NÃO passa por `chamar()`: a URL devolvida por
 * `urlDaMidia` já é absoluta (host lookaside, não graph.facebook.com) e
 * concatená-la ao prefixo da Graph daria 404. O header Authorization continua
 * obrigatório — sem ele a Meta devolve 401 mesmo com a URL válida.
 */
export async function baixarMidia(url: string): Promise<ArrayBuffer> {
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${env.whatsappToken}` },
    cache: 'no-store',
  })
  if (!resp.ok) throw new MetaError(resp.status, 'falha ao baixar mídia')
  return resp.arrayBuffer()
}

/** Inscreve o app no webhook da WABA. Resolve o bloqueio 3 da spec §9. */
export async function inscreverWebhook(): Promise<unknown> {
  return chamar(`${env.wabaId}/subscribed_apps`, { method: 'POST' })
}
