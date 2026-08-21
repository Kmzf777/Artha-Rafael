// src/server/repo/campanhas.ts
// Campanhas e a fila de agendamentos. Spec §4.2.
import 'server-only'
import type { Agendamento, Campanha, Lead } from '@/mock/types'
import { paraDominio } from './leads'
import { db } from '../supabase'

// Exportado: é o tipo de retorno de `reservarAgendamentos`, que o worker
// da fila consome.
export type LinhaAgendamento = {
  id: string; lead_id: string; campanha_id: string | null; template: string
  variaveis: string[]; agendado_para: string; status: string; tentativas: number
  erro: string | null; message_id: string | null
}

export function agendamentoParaDominio(a: LinhaAgendamento): Agendamento {
  return {
    id: a.id,
    leadId: a.lead_id,
    template: a.template,
    agendadoPara: a.agendado_para,
    status: a.status as Agendamento['status'],
    tentativas: a.tentativas,
    erro: a.erro,
  }
}

/**
 * Cria a campanha e enfileira um agendamento por lead. O unique
 * (campanha_id, lead_id) do schema garante que reenfileirar não duplica.
 */
export async function criarCampanha(args: {
  nome: string
  template: string
  segmentoAlvo: string
  leads: { id: string; variaveis: string[] }[]
  /** Quando o PRIMEIRO agendamento sai. Ausente, agora. */
  agendadoPara?: string
  /** Intervalo entre um agendamento e o seguinte. Ausente, todos juntos. */
  espacamentoSegundos?: number
}): Promise<{ campanhaId: string; enfileirados: number }> {
  const { data: campanha, error } = await db()
    .from('campanhas')
    .insert({ nome: args.nome, template: args.template, segmento_alvo: args.segmentoAlvo })
    .select('id')
    .single()
  if (error) throw new Error(`criarCampanha: ${error.message}`)

  // O espaçamento entre envios É este carimbo: o worker só reserva linhas com
  // `agendado_para <= now()`. Com todos em `now()`, o lote de 20 saía de uma
  // vez — a tela prometia um envio a cada 45 s e o backend não cumpria.
  const inicio = args.agendadoPara ? new Date(args.agendadoPara) : new Date()
  const passoMs = (args.espacamentoSegundos ?? 0) * 1_000
  const linhas = args.leads.map((l, i) => ({
    lead_id: l.id,
    campanha_id: campanha.id as string,
    template: args.template,
    variaveis: l.variaveis,
    agendado_para: new Date(inicio.getTime() + i * passoMs).toISOString(),
  }))

  // Lotes de 500: o PostgREST recusa payload muito grande, e 612 leads passam.
  // `ignoreDuplicates` vira `on conflict do nothing`, e o `returning` do Postgres
  // devolve SÓ as linhas realmente inseridas — por isso `data.length` é a
  // contagem honesta de enfileirados, não o tamanho do lote.
  let enfileirados = 0
  for (let i = 0; i < linhas.length; i += 500) {
    const lote = linhas.slice(i, i + 500)
    const { data, error: erroLote } = await db()
      .from('agendamentos')
      .upsert(lote, { onConflict: 'campanha_id,lead_id', ignoreDuplicates: true })
      .select('id')
    if (erroLote) throw new Error(`enfileirar: ${erroLote.message}`)
    enfileirados += data?.length ?? 0
  }

  return { campanhaId: campanha.id as string, enfileirados }
}

/**
 * Reserva até `limite` agendamentos, marcando-os `enviando` sob
 * `for update skip locked`. Duas execuções sobrepostas do worker NÃO pegam a
 * mesma linha. Critério de aceitação 8.
 */
export async function reservarAgendamentos(limite: number): Promise<LinhaAgendamento[]> {
  const { data, error } = await db().rpc('reservar_agendamentos', { limite })
  if (error) throw new Error(`reservarAgendamentos: ${error.message}`)
  return (data ?? []) as LinhaAgendamento[]
}

export async function marcarAgendamentoEnviado(id: string, messageId: string): Promise<void> {
  await db().from('agendamentos')
    .update({ status: 'enviado', message_id: messageId, erro: null, atualizado_em: new Date().toISOString() })
    .eq('id', id)
}

/** Falhou: reagenda com recuo exponencial até a terceira tentativa. */
export async function marcarAgendamentoFalho(id: string, tentativas: number, erro: string): Promise<void> {
  const desistiu = tentativas + 1 >= 3

  // `agendado_para` é NOT NULL no schema. Quando desistimos não há nova data, e
  // a chave simplesmente NÃO entra no patch — em vez de ir como `undefined` e
  // depender de o serializador do supabase-js descartá-la.
  const patch: Record<string, unknown> = {
    status: desistiu ? 'falhou' : 'pendente',
    tentativas: tentativas + 1,
    erro,
    atualizado_em: new Date().toISOString(),
  }
  if (!desistiu) {
    const recuoMin = Math.pow(3, tentativas + 1) // 3, 9, …
    patch.agendado_para = new Date(Date.now() + recuoMin * 60_000).toISOString()
  }

  await db().from('agendamentos').update(patch).eq('id', id)
}

/** Devolve reservados à fila sem gastar tentativa — usado quando o teto trava. */
export async function devolverAFila(ids: string[], quando: string): Promise<void> {
  if (ids.length === 0) return
  await db().from('agendamentos')
    .update({ status: 'pendente', agendado_para: quando, atualizado_em: new Date().toISOString() })
    .in('id', ids)
}

/**
 * A fila com o lead de cada linha resolvido.
 *
 * O lead vem junto de propósito: a tela mostra nome e telefone do
 * destinatário, e sem ele toda linha exibiria "Contato removido" e um uuid. É
 * UMA consulta a mais para o lote inteiro — não uma por linha.
 */
export async function listarAgendamentos(): Promise<(Agendamento & { lead: Lead | null })[]> {
  const { data, error } = await db()
    .from('agendamentos')
    .select('*')
    .order('agendado_para', { ascending: true })
    .limit(2_000)
  if (error) throw new Error(`listarAgendamentos: ${error.message}`)

  const linhas = data as LinhaAgendamento[]
  const ids = [...new Set(linhas.map((a) => a.lead_id).filter(Boolean))]

  const porId = new Map<string, Lead>()
  // Mesmo cuidado do `listarCampanhas`: filtro `in` viaja na query string e
  // estoura 414 com muitos uuids.
  for (const lote of emLotes(ids, LOTE_IN)) {
    const { data: leads } = await db().from('leads').select('*').in('id', lote)
    for (const l of leads ?? []) porId.set(l.id as string, paraDominio(l as never))
  }

  return linhas.map((a) => ({
    ...agendamentoParaDominio(a),
    lead: porId.get(a.lead_id) ?? null,
  }))
}

export async function cancelarAgendamento(id: string): Promise<void> {
  await db().from('agendamentos').update({ status: 'cancelado' }).eq('id', id).eq('status', 'pendente')
}

/**
 * Teto de ids por filtro `in`. O PostgREST recebe a lista na QUERY STRING: 612
 * uuids dão ~23 KB de URL e o proxy devolve 414 antes de o Postgres ver a
 * consulta. 200 uuids ≈ 7,5 KB, abaixo do limite de 8 KB do supabase-js.
 */
const LOTE_IN = 200

function emLotes<T>(itens: T[], tamanho: number): T[][] {
  const lotes: T[][] = []
  for (let i = 0; i < itens.length; i += tamanho) lotes.push(itens.slice(i, i + tamanho))
  return lotes
}

/**
 * Contadores DERIVADOS de `messages` — nunca digitados. Spec §4.2.
 *
 * Limitação conhecida: N+1. Uma consulta por campanha para as mensagens, mais
 * duas por lote de 200 alvos. Aceitável na escala da demo; a partir de ~15
 * campanhas o tempo de resposta passa de 1 s e vale trocar por uma view
 * agregada em SQL.
 */
export async function listarCampanhas(): Promise<Campanha[]> {
  const { data: campanhas, error } = await db().from('campanhas').select('*').order('criada_em', { ascending: false })
  if (error) throw new Error(`listarCampanhas: ${error.message}`)

  const resultado: Campanha[] = []
  for (const c of campanhas ?? []) {
    const id = c.id as string
    const { data: msgs } = await db().from('messages').select('status,lead_id').eq('campanha_id', id)
    const enviados = msgs?.length ?? 0
    const entregues = msgs?.filter((m) => m.status === 'entregue' || m.status === 'lido').length ?? 0
    const alvos = new Set((msgs ?? []).map((m) => m.lead_id).filter(Boolean) as string[])

    // `respondidos` é gente, não mensagem: um lead que responde cinco vezes
    // conta UMA. O PostgREST não faz `count(distinct)`, então os lead_id vêm
    // para cá e o Set desduplica.
    const respondentes = new Set<string>()
    let qualificados = 0
    let convertidos = 0
    for (const lote of emLotes([...alvos], LOTE_IN)) {
      const { data: inbound } = await db().from('messages')
        .select('lead_id').eq('direction', 'inbound').in('lead_id', lote).limit(50_000)
      for (const m of inbound ?? []) if (m.lead_id) respondentes.add(m.lead_id as string)

      const { data: leads } = await db().from('leads').select('stage').in('id', lote)
      qualificados += leads?.filter((l) => l.stage === 'qualificado').length ?? 0
      convertidos += leads?.filter((l) => l.stage === 'convertido').length ?? 0
    }

    resultado.push({
      id, nome: c.nome as string, template: c.template as string,
      criadaEm: c.criada_em as string,
      segmentoAlvo: c.segmento_alvo as Campanha['segmentoAlvo'],
      enviados, entregues, respondidos: respondentes.size, qualificados, convertidos,
    })
  }
  return resultado
}
