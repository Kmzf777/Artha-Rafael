// src/server/bot/reset.ts
// `!reset` — devolve um telefone ao estado de quem nunca escreveu, para o
// roteiro poder ser testado de novo sem trocar de chip.
//
// POR QUE APAGAR MENSAGEM, E NÃO SÓ O LEAD: a decisão do bot é derivada de
// `messages` filtrada por telefone, não por `lead_id`. E `messages.lead_id` é
// `on delete set null` — apagar só o lead deixaria o histórico inteiro de pé, o
// bot continuaria enxergando a conversa antiga e continuaria calado. O reset que
// não apaga mensagem não reseta nada.
import 'server-only'
import { ehComandoReset } from '@/lib/bot/comandos'
import { conversationKey } from '@/lib/conversationKey'
import { enviarTexto } from '../meta/client'
import { db } from '../supabase'

const CONFIRMACAO =
  'Pronto. Este número saiu da base: a próxima mensagem começa do zero.'

type Alvo = { phone: string | null; phoneId: string | null }

/**
 * Trata a mensagem se ela for o comando. Devolve `true` quando tratou, e aí o
 * chamador não deve seguir para o bot de qualificação.
 *
 * SEM LISTA DE AUTORIZADOS: qualquer telefone pode resetar o próprio cadastro.
 * O alcance é o que torna isso aceitável — o comando só apaga dado de QUEM o
 * mandou, nunca de terceiro. O risco que sobra é um lead de verdade digitar
 * exatamente `!reset` e perder o próprio histórico; em troca, testar o roteiro
 * de novo não depende de configuração nem de redeploy. Para voltar a fechar,
 * ver `podeResetar` no histórico do git.
 */
export async function tentarReset(alvo: Alvo, texto: string | null): Promise<boolean> {
  if (!ehComandoReset(texto)) return false
  if (!alvo.phone) return false

  const phone = alvo.phone

  // Todas as instâncias, não só a deste `phone_id`: reset é da pessoa inteira.
  // Inclui a própria mensagem `!reset`, que o webhook já gravou antes daqui.
  const msgs = await db().from('messages').delete().eq('phone', phone)
  if (msgs.error) throw new Error(`reset/messages: ${msgs.error.message}`)

  const chave = conversationKey({ bsuid: null, phone, phone_id: alvo.phoneId })
  if (chave) {
    const reads = await db().from('conversation_reads').delete().eq('key', chave)
    if (reads.error) throw new Error(`reset/conversation_reads: ${reads.error.message}`)
  }

  // `tel_norm` é a coluna gerada, e `phone` já vem canônico do webhook.
  const lead = await db().from('leads').delete().eq('tel_norm', phone)
  if (lead.error) throw new Error(`reset/leads: ${lead.error.message}`)

  // A confirmação NÃO é gravada em `messages`, de propósito. Se fosse, a
  // próxima mensagem do lead encontraria um outbound no histórico, o bot
  // concluiria que já tinha falado e responderia com a repetição
  // ("Te respondo já! Só me diz primeiro:") em vez da primeira pergunta limpa.
  // Reset que deixa rastro não é reset.
  //
  // A janela de 24h está aberta — o `!reset` acabou de chegar. Quem manda nisso
  // é a Meta, não o nosso histórico, que neste ponto está vazio.
  await enviarTexto(phone, CONFIRMACAO)
  return true
}
