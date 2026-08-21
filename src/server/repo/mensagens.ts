// src/server/repo/mensagens.ts
// A conversa é DERIVADA de `messages` pela mesma `conversationKey` que o
// frontend usa — replicá-la em tabela criaria duas fontes de verdade. Spec §4.2.
import 'server-only'
import { conversationKey } from '@/lib/conversationKey'
import type { Conversation, Message as MensagemFio } from '@/lib/conversationTypes'
import { getWindowStatus } from '@/lib/janela24h'
import { estadosPromovidosPor } from '@/lib/statusEntrega'
import type { DeliveryStatus } from '@/mock/types'
import { db } from '../supabase'

// MensagemUI vem de conversationTypes: o cliente também precisa dela, e este
// módulo é server-only.
export type { MensagemUI } from '@/lib/conversationTypes'
import type { MensagemUI } from '@/lib/conversationTypes'

// A linha do banco é a forma de fio MAIS as colunas que só existem no
// Postgres: quem gravou (operador humano ou automação), a campanha de origem e
// o lead resolvido. Sem elas declaradas, `inserirMensagem` recusa os campos que
// as rotas de envio e o worker de disparo precisam escrever.
type LinhaMensagem = MensagemFio & {
  status: DeliveryStatus | null
  lead_id: string | null
  enviado_por: string | null
  campanha_id: string | null
}

/**
 * Escapa a identidade antes de interpolá-la no filtro `or=(...)` do PostgREST.
 *
 * A chave do card trafega pela URL, então a identidade é entrada do cliente.
 * Crua, uma vírgula ou parêntese no valor acrescenta termos ao OR e o card
 * passa a devolver mensagens que não são dele. As aspas duplas neutralizam os
 * reservados do PostgREST (`,` `.` `:` `(` `)`); `"` e `\` são removidos porque
 * são justamente o que escaparia da aspa — e nenhum telefone canônico (11
 * dígitos, ver `telNorm11`) nem bsuid legítimo os contém.
 */
function aspas(identidade: string): string {
  return `"${identidade.replace(/["\\]/g, '')}"`
}

/** Todas as mensagens de um card, em ordem cronológica. */
export async function mensagensDoCard(key: string): Promise<MensagemUI[]> {
  const [identidade, phoneId] = key.split('::')
  let q = db().from('messages').select('*').order('created_at', { ascending: true })
  q = phoneId ? q.eq('phone_id', phoneId) : q.is('phone_id', null)
  const alvo = aspas(identidade)
  const { data, error } = await q.or(`phone.eq.${alvo},bsuid.eq.${alvo}`)
  if (error) throw new Error(`mensagensDoCard: ${error.message}`)
  // `lead_id` é coluna do banco que não faz parte da forma de fio.
  return (data as LinhaMensagem[]).map((linha) => {
    const m: Partial<LinhaMensagem> = { ...linha }
    delete m.lead_id
    return m as MensagemUI
  })
}

/**
 * Cards da lista + não-lidas, montados a partir das mensagens.
 *
 * LIMITAÇÃO CONHECIDA: o `.limit(5_000)` é um teto silencioso. Passando disso,
 * os cards cujas mensagens são todas mais antigas que a 5000ª simplesmente
 * somem da lista, sem erro. Enquanto a base for a reativação (~612 leads) sobra
 * folga; quando apertar, o certo é uma RPC que faça o `distinct on (chave)` no
 * Postgres, não aumentar o número.
 */
export async function listarCardsDeConversa(): Promise<{
  conversas: Conversation[]
  naoLidas: Record<string, number>
}> {
  const { data, error } = await db()
    .from('messages')
    .select('phone,phone_id,bsuid,contact_name,content,created_at,direction,message_type')
    .order('created_at', { ascending: false })
    .limit(5_000)
  if (error) throw new Error(`listarCardsDeConversa: ${error.message}`)

  const { data: leituras } = await db().from('conversation_reads').select('key,lido_ate')
  const lidoAte = new Map((leituras ?? []).map((r) => [r.key as string, r.lido_ate as string]))

  const porChave = new Map<string, Conversation>()
  const naoLidas: Record<string, number> = {}

  // A consulta vem do mais recente para o mais antigo: a PRIMEIRA linha de cada
  // chave já é a última mensagem do card.
  for (const linha of data as LinhaMensagem[]) {
    const key = conversationKey(linha)
    if (!key) continue

    if (!porChave.has(key)) {
      porChave.set(key, {
        key,
        phone: linha.phone,
        phone_id: linha.phone_id,
        bsuid: linha.bsuid,
        contact_name: linha.contact_name,
        last_message: linha.content,
        last_message_time: linha.created_at,
        last_direction: linha.direction,
        last_message_type: linha.message_type,
      })
      naoLidas[key] = 0
    }
    // Contato ainda sem nome: a linha mais recente que tiver nome preenche.
    const card = porChave.get(key)!
    if (!card.contact_name && linha.contact_name) card.contact_name = linha.contact_name

    if (linha.direction === 'inbound') {
      const marca = lidoAte.get(key)
      if (!marca || new Date(linha.created_at) > new Date(marca)) naoLidas[key] += 1
    }
  }

  const conversas = [...porChave.values()].sort(
    (a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()
  )
  return { conversas, naoLidas }
}

export async function marcarCardLido(key: string): Promise<void> {
  const { error } = await db()
    .from('conversation_reads')
    .upsert({ key, lido_ate: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw new Error(`marcarCardLido: ${error.message}`)
}

/**
 * A janela de 24h do servidor. O botão do cliente pode estar com cache velho —
 * quem decide é aqui. Critério de aceitação 6.
 */
export async function janelaAberta(key: string): Promise<boolean> {
  const mensagens = await mensagensDoCard(key)
  return getWindowStatus(
    mensagens.map((m) => ({ direction: m.direction, created_at: m.created_at })),
    new Date()
  ).isOpen
}

/** Insere ignorando duplicata de wamid. Critério de aceitação 4. */
export async function inserirMensagem(
  m: Partial<LinhaMensagem> & { direction: 'inbound' | 'outbound' }
): Promise<void> {
  const { error } = await db()
    .from('messages')
    .upsert(m, { onConflict: 'message_id', ignoreDuplicates: true })
  if (error) throw new Error(`inserirMensagem: ${error.message}`)
}

/** Aplica o status sem deixar callback atrasado rebaixar. Critério 5. */
export async function aplicarStatus(messageId: string, novo: DeliveryStatus): Promise<void> {
  // UMA instrução, com a régua no `where`. Ler-decidir-gravar em dois passos
  // deixa dois callbacks simultâneos lerem o mesmo estado e o mais lento
  // sobrescrever o mais rápido — `lido` viraria `entregue` em definitivo.
  // Aqui o Postgres avalia a condição sob o lock da linha, então a ordem de
  // chegada deixa de importar. Critério de aceitação 5.
  const promovidos = estadosPromovidosPor(novo)
  const guarda =
    promovidos.length > 0 ? `status.is.null,status.in.(${promovidos.join(',')})` : 'status.is.null'

  // Mensagem que não é nossa simplesmente não casa o `eq` — nenhuma linha muda.
  const { error } = await db()
    .from('messages')
    .update({ status: novo })
    .eq('message_id', messageId)
    .or(guarda)
  if (error) throw new Error(`aplicarStatus: ${error.message}`)
}

/** Conversas iniciadas nas últimas 24h — o teto do §7.3 conta por aqui. */
export async function conversasIniciadasEm24h(): Promise<number> {
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await db()
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('direction', 'outbound')
    .eq('message_type', 'template')
    .gte('created_at', desde)
  return count ?? 0
}

// ---------------------------------------------------------------------------
// Forma de domínio, para as métricas
// ---------------------------------------------------------------------------

import { WINDOW_MS } from '@/lib/janela24h'
import type { Conversa, Message as MensagemDominio } from '@/mock/types'

type LinhaDominio = {
  id: string; lead_id: string | null; phone: string | null; phone_id: string | null
  bsuid: string | null; message_type: string; content: string | null
  direction: 'inbound' | 'outbound'; created_at: string
  status: DeliveryStatus | null; enviado_por: string | null; campanha_id: string | null
}

/**
 * Conversas e mensagens na forma de DOMÍNIO (`src/mock/types.ts`) — que é o que
 * `DadosMetrics` de `src/lib/regras.ts` espera. `listarCardsDeConversa()` NÃO
 * serve aqui: ela devolve a forma de fio (`Conversation`, snake_case), com
 * outro conjunto de campos.
 *
 * As duas listas saem da MESMA consulta de propósito: `Message.conversaId` tem
 * de ser exatamente o `Conversa.id`, senão `filaAtendimento` — que casa a
 * última mensagem com o card — conta zero em silêncio.
 *
 * Mesmo teto de 5.000 linhas de `listarCardsDeConversa`, e pela mesma razão.
 */
export async function conversasEMensagens(): Promise<{
  conversas: Conversa[]
  mensagens: MensagemDominio[]
}> {
  const { data, error } = await db()
    .from('messages')
    .select(
      'id,lead_id,phone,phone_id,bsuid,message_type,content,direction,created_at,status,enviado_por,campanha_id'
    )
    .order('created_at', { ascending: false })
    .limit(5_000)
  if (error) throw new Error(`conversasEMensagens: ${error.message}`)

  const { data: leituras } = await db().from('conversation_reads').select('key,lido_ate')
  const lidoAte = new Map((leituras ?? []).map((r) => [r.key as string, r.lido_ate as string]))

  const porChave = new Map<string, Conversa>()
  const mensagens: MensagemDominio[] = []

  // Do mais recente para o mais antigo: a PRIMEIRA linha de cada chave já é a
  // última mensagem do card, e o primeiro inbound já é o que abre a janela.
  for (const linha of data as LinhaDominio[]) {
    const key = conversationKey(linha)
    if (!key) continue

    const m: MensagemDominio = {
      id: linha.id,
      conversaId: key,
      direcao: linha.direction,
      // A coluna é texto livre: um tipo novo da Meta (sticker, video…) cai fora
      // da união. As métricas só contam por direção, então não distorce nada.
      tipo: linha.message_type as MensagemDominio['tipo'],
      conteudo: linha.content ?? '',
      criadoEm: linha.created_at,
    }
    if (linha.status) m.status = linha.status
    if (linha.enviado_por) m.enviadoPor = linha.enviado_por
    if (linha.campanha_id) m.campanhaId = linha.campanha_id
    mensagens.push(m)

    if (!porChave.has(key)) {
      porChave.set(key, {
        id: key,
        leadId: linha.lead_id ?? '',
        ultimaMensagemEm: linha.created_at,
        naoLidas: 0,
        janela24hExpiraEm: null,
        atribuidoA: null,
      })
    }
    const card = porChave.get(key)!
    if (!card.leadId && linha.lead_id) card.leadId = linha.lead_id

    if (linha.direction === 'inbound') {
      const marca = lidoAte.get(key)
      if (!marca || new Date(linha.created_at) > new Date(marca)) card.naoLidas += 1
      if (card.janela24hExpiraEm === null) {
        card.janela24hExpiraEm = new Date(new Date(linha.created_at).getTime() + WINDOW_MS).toISOString()
      }
    } else if (card.atribuidoA === null && linha.enviado_por) {
      // Não existe coluna de atribuição no schema. O sinal honesto disponível é
      // `enviado_por`: quem respondeu à mão por último é quem está atendendo.
      card.atribuidoA = linha.enviado_por
    }
  }

  return { conversas: [...porChave.values()], mensagens }
}
