// src/lib/webhookParse.ts
// Parse PURO do payload do webhook da Meta. Sem banco, sem rede — para que o
// contrato do webhook seja testável sem infraestrutura. Ver spec §6.2.
import type { DeliveryStatus } from '@/mock/types'
import { telNorm11 } from './phoneUtils'
import { statusDaMeta } from './statusEntrega'

/** Mensagem de entrada já na forma de fio de `conversationTypes.ts`. */
export type MensagemRecebida = {
  message_id: string
  phone: string | null
  phone_id: string | null
  contact_name: string | null
  message_type: string
  content: string | null
  created_at: string
  media_id: string | null
  media_mime_type: string | null
  reply_to_message_id: string | null
}

export type StatusRecebido = { message_id: string; status: DeliveryStatus }

export type WebhookParseado = { mensagens: MensagemRecebida[]; statuses: StatusRecebido[] }

type Qualquer = Record<string, unknown>

function obj(v: unknown): Qualquer | null {
  return typeof v === 'object' && v !== null ? (v as Qualquer) : null
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}
function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

/** Conteúdo textual por tipo. O que não tem texto vira null (a mídia carrega o resto). */
function conteudo(msg: Qualquer, tipo: string): string | null {
  switch (tipo) {
    case 'text':
      return str(obj(msg.text)?.body)
    case 'button':
      return str(obj(msg.button)?.text)
    case 'interactive': {
      const i = obj(msg.interactive)
      return str(obj(i?.button_reply)?.title) ?? str(obj(i?.list_reply)?.title)
    }
    case 'image':
    case 'video':
    case 'document':
      return str(obj(msg[tipo])?.caption)
    default:
      return null
  }
}

/** Mídia por tipo. Áudio e sticker não têm caption, mas têm id e mime. */
function midia(msg: Qualquer, tipo: string): { id: string | null; mime: string | null } {
  const comMidia = ['image', 'video', 'audio', 'document', 'sticker']
  if (!comMidia.includes(tipo)) return { id: null, mime: null }
  const m = obj(msg[tipo])
  return { id: str(m?.id), mime: str(m?.mime_type) }
}

export function parseWebhook(payload: unknown): WebhookParseado {
  const mensagens: MensagemRecebida[] = []
  const statuses: StatusRecebido[] = []

  const raiz = obj(payload)
  if (!raiz) return { mensagens, statuses }

  for (const entrada of arr(raiz.entry)) {
    for (const mudanca of arr(obj(entrada)?.changes)) {
      const valor = obj(obj(mudanca)?.value)
      if (!valor) continue

      const phoneId = str(obj(valor.metadata)?.phone_number_id)

      // Nome do contato: vem em `contacts`, casado por wa_id.
      const nomePorWaId = new Map<string, string>()
      for (const c of arr(valor.contacts)) {
        const contato = obj(c)
        const waId = str(contato?.wa_id)
        const nome = str(obj(contato?.profile)?.name)
        if (waId && nome) nomePorWaId.set(waId, nome)
      }

      for (const m of arr(valor.messages)) {
        const msg = obj(m)
        const id = str(msg?.id)
        const from = str(msg?.from)
        if (!msg || !id) continue

        const tipo = str(msg.type) ?? 'unknown'
        const { id: mediaId, mime } = midia(msg, tipo)
        const ts = Number(msg.timestamp)

        mensagens.push({
          message_id: id,
          // Gravamos os 11 dígitos canônicos: o `from` da Meta pode vir sem o
          // nono dígito e a conversa racharia em dois cards. Spec §2.1.
          phone: from ? (telNorm11(from) ?? from) : null,
          phone_id: phoneId,
          contact_name: from ? (nomePorWaId.get(from) ?? null) : null,
          message_type: tipo,
          content: conteudo(msg, tipo),
          created_at: new Date((Number.isFinite(ts) ? ts : 0) * 1000).toISOString(),
          media_id: mediaId,
          media_mime_type: mime,
          reply_to_message_id: str(obj(msg.context)?.id),
        })
      }

      for (const s of arr(valor.statuses)) {
        const st = obj(s)
        const id = str(st?.id)
        const bruto = str(st?.status)
        if (!id || !bruto) continue
        const traduzido = statusDaMeta(bruto)
        if (traduzido) statuses.push({ message_id: id, status: traduzido })
      }
    }
  }

  return { mensagens, statuses }
}
