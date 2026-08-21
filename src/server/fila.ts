// src/server/fila.ts
// Worker do disparo. Drena um lote da fila de agendamentos enviando templates.
// Spec §7.2 e §7.3.
//
// Mora aqui, e não dentro de uma rota, porque DOIS chamadores precisam
// exatamente da mesma lógica:
//   · `/api/fila/processar`      — o cron, protegido por CRON_SECRET.
//   · `/api/fila/disparar-agora` — o botão do painel, atrás do basic auth.
// Duplicar o worker seria manter duas cópias da trava de segurança da §7.4 em
// sincronia, e a que ficasse para trás é a que manda mensagem real para a
// semente.
//
// LIMITAÇÃO CONHECIDA: o disparo só preenche variáveis de CORPO. Variável em
// botão URL não é suportada por este fluxo — a criação de campanha resolve um
// `variaveis[]` por lead e não tem onde guardar parâmetro de botão. Template com
// {{1}} na URL do botão precisaria de outra coluna na fila antes de sair daqui.
import 'server-only'
import { telNorm11, toBrazilPhone } from '@/lib/phoneUtils'
import type { ComponenteEnvio } from '@/lib/templates'
import { podeDisparar } from '@/lib/regras'
import { env } from '@/server/env'
import { enviarTemplate, MetaError } from '@/server/meta/client'
import {
  devolverAFila,
  marcarAgendamentoEnviado,
  marcarAgendamentoFalho,
  reservarAgendamentos,
} from '@/server/repo/campanhas'
import { buscarLead } from '@/server/repo/leads'
import { conversasIniciadasEm24h, inserirMensagem } from '@/server/repo/mensagens'

const LOTE = 20

/** Códigos em que a própria Meta trava o disparo — não é falha do lead. */
const CODIGOS_DE_TETO = [131049, 130472]

/**
 * O que o ciclo fez. É também a forma de fio das duas rotas, e o que o toast de
 * Agendamentos lê — por isso os campos de teto vêm nomeados, e não num texto.
 */
export type ResultadoFila = {
  enviados: number
  falhas: number
  /** Quantos o lote reservou. Ausente quando parou antes de reservar. */
  reservados?: number
  motivo?: 'teto_diario' | 'teto_da_meta'
  /** Só em `teto_diario`. */
  jaIniciadas?: number
  teto?: number
  /** Só em `teto_da_meta`. */
  codigo?: number
  devolvidos?: number
}

export async function processarFila(): Promise<ResultadoFila> {
  // Teto de CONVERSAS INICIADAS por 24h — grandeza diferente de throughput, e é
  // esta que importa para 612 leads. Estourar devolve 131049 e queima a
  // qualidade do número, então contamos ANTES de cada lote. Spec §7.3.
  const jaIniciadas = await conversasIniciadasEm24h()
  const folga = env.limiteDiario - jaIniciadas
  if (folga <= 0) {
    return {
      enviados: 0,
      falhas: 0,
      motivo: 'teto_diario',
      jaIniciadas,
      teto: env.limiteDiario,
    }
  }

  const reservados = await reservarAgendamentos(Math.min(LOTE, folga))
  let enviados = 0
  let falhas = 0

  for (let i = 0; i < reservados.length; i++) {
    const a = reservados[i]

    // Vira true no instante em que a Meta aceita a mensagem. Depois disso
    // NENHUMA falha pode devolver esta linha à fila: reenviar cobraria de novo
    // e o lead receberia duas vezes.
    let jaEnviou = false

    try {
      // Uma consulta por lead. Num lote de 20 são 20 idas ao banco (~1 s), bem
      // dentro do maxDuration de 60 s que os 20 POSTs à Meta já ocupam. Buscar
      // o lote de uma vez exigiria uma função nova no repositório e economiza
      // tempo que não está faltando.
      const lead = await buscarLead(a.lead_id)
      if (!lead) {
        await marcarAgendamentoFalho(a.id, a.tentativas, 'lead inexistente')
        falhas += 1
        continue
      }

      // TRAVA DE SEGURANÇA. Os telefones da semente são celulares brasileiros
      // estruturalmente válidos, com DDD real: disparar para eles manda
      // template de verdade para desconhecidos, junta denúncia e derruba a
      // reputação do número — a operação inteira morre no primeiro disparo.
      // Esta é a última defesa antes da chamada irreversível à Meta, e por
      // isso mora aqui, e não só na criação da campanha.
      if (!podeDisparar(lead)) {
        await marcarAgendamentoFalho(a.id, 2, 'lead fictício: disparo bloqueado pela trava de segurança')
        falhas += 1
        continue
      }

      // A Meta exige o destino com DDI. `toBrazilPhone` acrescenta o 55 quando
      // falta e NÃO mexe em número que já o tem — fabricar o nono dígito aqui
      // criaria um destino que não existe. `telNorm11` só valida: null é fixo ou
      // lixo, e nesse caso nem gastamos a chamada.
      const canonico = telNorm11(lead.telefone)
      if (!canonico) {
        await marcarAgendamentoFalho(a.id, a.tentativas, `telefone inválido: ${lead.telefone}`)
        falhas += 1
        continue
      }
      const destino = toBrazilPhone(lead.telefone)

      // Só variáveis de corpo. Componente vazio é OMITIDO — mandar
      // `components: []` para template sem variável é o erro 132018 que esta
      // conta já levou; `enviarTemplate` também omite `components` quando a
      // lista chega vazia, então a defesa existe nas duas pontas.
      const variaveis = Array.isArray(a.variaveis) ? a.variaveis : []
      const componentes: ComponenteEnvio[] =
        variaveis.length > 0
          ? [{ type: 'body', parameters: variaveis.map((text) => ({ type: 'text', text })) }]
          : []

      const resposta = await enviarTemplate(destino, a.template, componentes)
      jaEnviou = true

      // Marcar ANTES de gravar a mensagem: se a escrita em `messages` falhar, o
      // pior resultado é uma linha de conversa faltando — reabrir a fila seria
      // um segundo envio para o mesmo lead.
      const wamid = resposta.messages[0]?.id ?? null
      await marcarAgendamentoEnviado(a.id, wamid ?? '')

      // `phone` guarda os 11 dígitos canônicos, a mesma forma que o webhook
      // grava no inbound. Gravar aqui o telefone com DDI racharia a conversa em
      // dois cards, porque `conversationKey` compara a string crua. Spec §2.1.
      const linha = {
        message_id: wamid,
        lead_id: lead.id,
        phone: canonico,
        phone_id: env.phoneNumberId,
        message_type: 'template',
        content: a.template,
        direction: 'outbound' as const,
        created_at: new Date().toISOString(),
        status: 'enviado' as const,
        // Coluna de `messages` que não faz parte da forma de fio de `MensagemUI`
        // — é por ela que `listarCampanhas` deriva enviados e entregues.
        campanha_id: a.campanha_id,
      }
      await inserirMensagem(linha)

      enviados += 1
    } catch (e) {
      if (jaEnviou) {
        // A mensagem SAIU. Falha de escrita depois disso não volta para a fila.
        enviados += 1
        continue
      }

      // Teto da própria Meta batendo. Devolve o restante do lote sem gastar
      // tentativa e para aqui — insistir é o que derruba a qualidade do número.
      if (e instanceof MetaError && CODIGOS_DE_TETO.includes(e.codigo)) {
        const restantes = reservados.slice(i).map((r) => r.id)
        await devolverAFila(restantes, new Date(Date.now() + 60 * 60_000).toISOString())
        return {
          enviados,
          falhas,
          motivo: 'teto_da_meta',
          codigo: e.codigo,
          devolvidos: restantes.length,
        }
      }

      // `a.tentativas` é o valor lido na reserva (a RPC não o incrementa), então
      // `marcarAgendamentoFalho` reagenda em 3 min, depois 9 min, e desiste na
      // terceira. O texto do erro fica no campo `erro` do agendamento, que a
      // tela mostra ao operador.
      const detalhe = e instanceof MetaError ? `${e.codigo}: ${e.detalhe}` : String(e)
      await marcarAgendamentoFalho(a.id, a.tentativas, detalhe)
      falhas += 1
    }
  }

  return { enviados, falhas, reservados: reservados.length }
}
