// src/server/repo/templates.ts
// Cache local dos templates da Meta. A Meta é a fonte da verdade; esta tabela
// só existe para a tela não depender de um round-trip à Graph. Spec §4.2.
import 'server-only'
import { listarTemplatesDaMeta } from '../meta/client'
import type { Template } from '@/mock/types'
import { db } from '../supabase'

type ComponenteMeta = { type: string; text?: string; buttons?: { text: string }[] }

/** Os quatro estados que a coluna aceita, e que a tela sabe desenhar. Achatar
 *  `rejeitado` em `pendente` fazia o operador esperar por uma aprovação que a
 *  Meta já tinha recusado. */
const STATUS: Template['status'][] = ['aprovado', 'pendente', 'rejeitado', 'pausado']

export async function listarTemplates(): Promise<Template[]> {
  const { data, error } = await db().from('templates').select('*').order('nome')
  if (error) throw new Error(`listarTemplates: ${error.message}`)
  return (data ?? []).map((t) => ({
    nome: t.nome as string,
    categoria: t.categoria as Template['categoria'],
    idioma: 'pt_BR' as const,
    corpo: t.corpo as string,
    botoes: (t.botoes as string[]) ?? [],
    // O `check` do schema já garante os quatro, mas um valor fora da lista aqui
    // quebraria `STATUS[status]` no `status-label` — cai em `pendente`.
    status: STATUS.includes(t.status as Template['status'])
      ? (t.status as Template['status'])
      : 'pendente',
    motivoRejeicao: (t.motivo_rejeicao as string | null) ?? null,
  }))
}

const STATUS_META: Record<string, string> = {
  APPROVED: 'aprovado', PENDING: 'pendente', REJECTED: 'rejeitado', PAUSED: 'pausado',
}

/** Puxa da Meta e reescreve o cache local. A Meta é a fonte da verdade. */
export async function sincronizarTemplates(): Promise<number> {
  const resposta = (await listarTemplatesDaMeta()) as {
    data: { id: string; name: string; status: string; category: string; language: string; rejected_reason?: string; components: ComponenteMeta[] }[]
  }

  const linhas = resposta.data.map((t) => {
    const corpo = t.components.find((c) => c.type === 'BODY')?.text ?? ''
    const botoes = t.components.find((c) => c.type === 'BUTTONS')?.buttons?.map((b) => b.text) ?? []
    // A Graph manda `rejected_reason: 'NONE'` no template que não foi recusado.
    // Gravar esse "NONE" faria a tela exibir "Motivo: NONE".
    const motivo = t.rejected_reason && t.rejected_reason !== 'NONE' ? t.rejected_reason : null
    return {
      nome: t.name, meta_id: t.id, categoria: t.category, idioma: t.language,
      corpo, componentes: t.components, botoes,
      status: STATUS_META[t.status] ?? 'pendente',
      motivo_rejeicao: motivo,
      sincronizado_em: new Date().toISOString(),
    }
  })

  if (linhas.length > 0) {
    const { error } = await db().from('templates').upsert(linhas, { onConflict: 'nome' })
    if (error) throw new Error(`sincronizarTemplates: ${error.message}`)
  }
  return linhas.length
}
