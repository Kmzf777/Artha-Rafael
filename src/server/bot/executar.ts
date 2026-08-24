// src/server/bot/executar.ts
// O efeito colateral do bot. Toda decisão está em `src/lib/bot/estado.ts`; aqui
// só existe ordem de operações. Spec 2026-08-24 §3.6 e §4.2.
import 'server-only'
import { proximoPasso } from '@/lib/bot/estado'
import { AUTOR_BOT, FECHO, REPETICAO, SEGMENTO_POR_P1, TAG_POR_RESPOSTA } from '@/lib/bot/roteiro'
import { getWindowStatus } from '@/lib/janela24h'
import type { Segmento } from '@/mock/types'
import { enviarBotoes, enviarTexto } from '../meta/client'
import { qualificarLead } from '../repo/leads'
import { historicoParaBot, inserirMensagem } from '../repo/mensagens'
import { db } from '../supabase'

type Gatilho = {
  messageId: string
  phone: string | null
  phoneId: string | null
  leadId: string | null
}

/**
 * Trava de concorrência. A derivação do estado resolve reentrega em série; duas
 * entregas SIMULTÂNEAS leem o mesmo histórico antes de qualquer uma escrever, e
 * as duas mandariam o botão. Conflito de chave primária significa que outra
 * entrega já cuidou desta mensagem.
 */
async function tomarATrava(inboundMessageId: string): Promise<boolean> {
  const { error } = await db().from('bot_acoes').insert({ inbound_message_id: inboundMessageId })
  if (!error) return true
  if (error.code === '23505') return false
  throw new Error(`tomarATrava: ${error.message}`)
}

export async function executarBot(gatilho: Gatilho): Promise<void> {
  if (!gatilho.phone) return

  const historico = await historicoParaBot(gatilho.phone, gatilho.phoneId)
  const passo = proximoPasso(historico)
  if (passo.acao === 'calar') return

  // A janela deveria estar sempre aberta — o gatilho é uma mensagem de entrada.
  // A checagem custa uma comparação e evita descobrir em produção que existe um
  // caminho onde a premissa não valia.
  if (!getWindowStatus(historico, new Date()).isOpen) return

  if (!(await tomarATrava(gatilho.messageId))) return

  if (passo.acao === 'perguntar' || passo.acao === 'repetir') {
    const corpo =
      passo.acao === 'repetir' ? `${REPETICAO}\n\n${passo.pergunta.corpo}` : passo.pergunta.corpo
    const resposta = await enviarBotoes(gatilho.phone, corpo, passo.pergunta.botoes)
    await gravarSaida(gatilho, resposta.messages[0]?.id ?? null, corpo, 'interactive')
    return
  }

  // encerrar. A qualificação vem ANTES do fecho de propósito: o fecho é
  // cortesia, a qualificação é o produto inteiro do bot. A trava de `bot_acoes`
  // já foi queimada acima e não há reprocessamento — se um erro da Meta deixar
  // só um dos dois acontecer, tem que ser a qualificação que sobrevive. Não
  // contradiz o "não retenta" da §3.7: aquilo é sobre a mensagem, não sobre a
  // gravação.
  if (gatilho.leadId) {
    // Os dois tipos são ANOTADOS de propósito. O projeto não liga
    // `noUncheckedIndexedAccess`, então indexar um `Record` devolve o tipo do
    // valor mesmo quando não há entrada — e não há para `p1:outro` em
    // `SEGMENTO_POR_P1`. Sem a anotação o `undefined` fica invisível para quem lê.
    const segmento: Segmento | undefined = passo.idP1 ? SEGMENTO_POR_P1[passo.idP1] : undefined
    const tag: string | undefined = passo.idP2
      ? TAG_POR_RESPOSTA[passo.idP2]
      : passo.idP1
        ? TAG_POR_RESPOSTA[passo.idP1]
        : undefined
    if (segmento || tag) await qualificarLead(gatilho.leadId, { segmento, tag })
  }

  if (passo.comFecho) {
    const resposta = await enviarTexto(gatilho.phone, FECHO)
    await gravarSaida(gatilho, resposta.messages[0]?.id ?? null, FECHO, 'text')
  }
}

async function gravarSaida(
  gatilho: Gatilho,
  messageId: string | null,
  conteudo: string,
  tipo: string
): Promise<void> {
  await inserirMensagem({
    message_id: messageId,
    lead_id: gatilho.leadId,
    phone: gatilho.phone,
    phone_id: gatilho.phoneId,
    content: conteudo,
    message_type: tipo,
    direction: 'outbound',
    created_at: new Date().toISOString(),
    enviado_por: AUTOR_BOT,
  })
}
