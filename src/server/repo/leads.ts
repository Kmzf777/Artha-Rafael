// src/server/repo/leads.ts
// Espelha as funções de leitura/escrita de leads de `src/mock/store.ts`, com as
// MESMAS assinaturas, contra o Postgres. Spec §3.2.
import 'server-only'
import { telNorm11 } from '@/lib/phoneUtils'
import { semAcento } from '@/lib/texto'
import type { FiltroLeads } from '@/hooks/useLeads'
import type { Lead } from '@/mock/types'
import { db } from '../supabase'

type LinhaLead = {
  id: string; nome: string; telefone: string; email: string | null
  segmento: string; stage: string; plano_status: string; plano_valor: number | null
  ultimo_acesso_em: string | null; primeiro_contato_em: string; ultima_interacao_em: string
  cidade: string | null; tags: string[]; notas: string | null; ficticio: boolean
}

/** Linha do banco (snake_case) → domínio (camelCase de `src/mock/types.ts`). */
export function paraDominio(l: LinhaLead): Lead {
  return {
    id: l.id,
    nome: l.nome,
    telefone: l.telefone,
    email: l.email ?? '',
    segmento: l.segmento as Lead['segmento'],
    stage: l.stage as Lead['stage'],
    planoStatus: l.plano_status as Lead['planoStatus'],
    planoValor: l.plano_valor,
    ultimoAcessoEm: l.ultimo_acesso_em,
    primeiroContatoEm: l.primeiro_contato_em,
    ultimaInteracaoEm: l.ultima_interacao_em,
    cidade: l.cidade ?? '',
    tags: l.tags ?? [],
    notas: l.notas,
    ficticio: l.ficticio ?? false,
  }
}

export const TAMANHO_PAGINA = 25

/**
 * Texto do operador dentro de um filtro `or`: vírgula e parênteses são
 * delimitadores da sintaxe do PostgREST, então o valor vai entre aspas. Sem
 * isto, buscar "Silva, João" vira um filtro malformado e a tabela estoura.
 */
function aspas(valor: string): string {
  return `"${valor.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

export async function listarLeads(
  filtro: FiltroLeads = {}
): Promise<{ leads: Lead[]; total: number; totalGeral: number; pagina: number; paginas: number }> {
  const cliente = db()
  const { count: totalGeral } = await cliente.from('leads').select('id', { count: 'exact', head: true })

  // Um builder do supabase-js é consumido quando awaitado e carrega o `range`
  // já aplicado: reusá-lo entre a contagem e a página devolveria o recorte
  // errado. Cada consulta monta o seu — o filtro é que é compartilhado.
  const montar = (head: boolean) => {
    let q = cliente.from('leads').select('*', { count: 'exact', head })
    if (filtro.segmento && filtro.segmento !== 'todos') q = q.eq('segmento', filtro.segmento)
    if (filtro.stage && filtro.stage !== 'todos') q = q.eq('stage', filtro.stage)
    if (filtro.planoStatus && filtro.planoStatus !== 'todos') q = q.eq('plano_status', filtro.planoStatus)

    const busca = (filtro.busca ?? '').trim()
    if (busca) {
      const digitos = busca.replace(/\D/g, '')
      // Nome casa pela coluna `nome_norm`, que o Postgres gera com
      // `sem_acento()` — espelho de `semAcento()` daqui. Sem isto, "jose"
      // deixaria de achar "José", que é o que o store em memória fazia.
      const nome = semAcento(busca)

      // Telefone: substring resolve digitação parcial ("98886"), mas NÃO resolve
      // forma. `5534988861441` e `553488861441` são a mesma pessoa e nenhum dos
      // dois é substring do outro — o nono dígito está no meio. Colar o wa_id de
      // 12 dígitos que a Meta devolve não acharia o lead.
      //
      // Por isso a busca também passa por `telNorm11` e compara com `tel_norm`,
      // que é o que o Postgres gerou pela MESMA régua. Spec §2.1: toda
      // identificação por número — webhook, disparo, importação e busca —
      // passa pelas duas.
      const canonico = telNorm11(busca)
      const termos = [
        `telefone.ilike.${aspas(`%${digitos}%`)}`,
        `tel_norm.ilike.${aspas(`%${digitos}%`)}`,
        `nome_norm.ilike.${aspas(`%${nome}%`)}`,
      ]
      if (canonico) termos.push(`tel_norm.eq.${aspas(canonico)}`)

      q = digitos.length >= 2 ? q.or(termos.join(',')) : q.ilike('nome_norm', `%${nome}%`)
    }
    return q
  }

  // Contar primeiro para grampear a página: pedir range fora do fim devolve vazio.
  const { count: total, error: erroContagem } = await montar(true)
  if (erroContagem) throw new Error(`listarLeads: ${erroContagem.message}`)

  const paginas = Math.max(1, Math.ceil((total ?? 0) / TAMANHO_PAGINA))
  const pagina = Math.min(Math.max(1, filtro.pagina ?? 1), paginas)
  const inicio = (pagina - 1) * TAMANHO_PAGINA

  // `id` desempata: ordenar só por timestamp não é determinístico quando dois
  // leads têm a mesma `ultima_interacao_em`, e aí a linha repete numa página e
  // some da outra.
  const { data, error } = await montar(false)
    .order('ultima_interacao_em', { ascending: false })
    .order('id', { ascending: true })
    .range(inicio, inicio + TAMANHO_PAGINA - 1)
  if (error) throw new Error(`listarLeads: ${error.message}`)

  return {
    leads: (data as LinhaLead[]).map(paraDominio),
    total: total ?? 0,
    totalGeral: totalGeral ?? 0,
    pagina,
    paginas,
  }
}

/** Todos os leads, sem paginar. Só para as regras de `src/lib/regras.ts`. */
export async function todosOsLeads(): Promise<Lead[]> {
  const { data, error } = await db().from('leads').select('*').limit(50_000)
  if (error) throw new Error(`todosOsLeads: ${error.message}`)
  return (data as LinhaLead[]).map(paraDominio)
}

export async function buscarLead(id: string): Promise<Lead | null> {
  const { data } = await db().from('leads').select('*').eq('id', id).maybeSingle()
  return data ? paraDominio(data as LinhaLead) : null
}

/**
 * Lookup pela forma canônica. É ESTA função que reconcilia o wa_id de 12
 * dígitos da Meta com o telefone de 13 da base. Spec §2.1.
 */
export async function buscarLeadPorTelefone(telefone: string | null): Promise<Lead | null> {
  const norm = telNorm11(telefone)
  if (!norm) return null
  const { data } = await db().from('leads').select('*').eq('tel_norm', norm).maybeSingle()
  return data ? paraDominio(data as LinhaLead) : null
}

/** Acha ou cria. O webhook chama quando chega mensagem de número desconhecido. */
export async function acharOuCriarLeadPorTelefone(
  telefone: string,
  nome: string | null
): Promise<Lead | null> {
  const existente = await buscarLeadPorTelefone(telefone)
  if (existente) return existente

  const norm = telNorm11(telefone)
  if (!norm) return null // fixo ou lixo: não fabricamos lead

  const { data, error } = await db()
    .from('leads')
    .insert({ nome: nome ?? `+${telefone}`, telefone, stage: 'novo', segmento: 'artha' })
    .select('*')
    .single()

  // Corrida com outro evento do mesmo webhook: o unique de tel_norm venceu.
  if (error?.code === '23505') return buscarLeadPorTelefone(telefone)
  if (error) throw new Error(`acharOuCriarLeadPorTelefone: ${error.message}`)
  return paraDominio(data as LinhaLead)
}

export async function mudarEtapaLead(id: string, stage: Lead['stage']): Promise<Lead | null> {
  const { data, error } = await db()
    .from('leads')
    .update({ stage, ultima_interacao_em: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(`mudarEtapaLead: ${error.message}`)
  return paraDominio(data as LinhaLead)
}
