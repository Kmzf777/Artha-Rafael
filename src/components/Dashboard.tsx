'use client'

import { format, isSameDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronRight } from 'lucide-react'

import Badge from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAgora } from '@/hooks/useAgora'
import { useConta } from '@/hooks/useConta'
import { useConversations } from '@/hooks/useConversations'
import { useMetrics } from '@/hooks/useMetrics'
import type { Conversation } from '@/lib/conversationTypes'
import { getInitials } from '@/lib/format'
import { tabHref, type ActiveTab } from '@/lib/tabs'

// Dashboard — spec §5. Quatro tiles `card-soft-tinted`, UMA banda
// `promo-card-on-dark` (o movimento assinatura do DESIGN.md: a inversão de
// polaridade é a pista de profundidade; repetida vira decoração) e duas listas
// planas apoiadas em hairline, sem chrome de card.
//
// Todo número desta tela sai de `useMetrics()`, que deriva do mesmo dataset que
// as outras telas leem. Nenhum número é digitado aqui.

// O "agora" vem de `useAgora()`: relógio real, ticando. A âncora do mock parava
// no load da página e a fila de atendimento mostrava espera congelada.
const MINUTO = 60_000
const HORA = 60 * MINUTO
const DIA = 24 * HORA

const NUM = new Intl.NumberFormat('pt-BR')

/** Espera acumulada desde a última mensagem do lead. */
function espera(iso: string, agora: Date): string {
  const ms = agora.getTime() - new Date(iso).getTime()
  if (ms < HORA) return `${Math.max(1, Math.round(ms / MINUTO))} min`
  if (ms < DIA) return `${Math.floor(ms / HORA)} h`
  return `${Math.floor(ms / DIA)} d`
}

/** Carimbo do card: hora no dia de hoje, data nos dias anteriores. */
function carimbo(iso: string, agora: Date): string {
  const d = new Date(iso)
  return isSameDay(d, agora) ? format(d, 'HH:mm') : format(d, 'dd/MM', { locale: ptBR })
}

// Imagem e documento chegam com o nome do arquivo como conteúdo; na lista o
// rótulo do tipo lê melhor que `extrato-agosto.png`.
const ROTULO_ANEXO: Record<string, string | undefined> = {
  image: 'Imagem',
  document: 'Documento',
}

function trecho(c: Conversation): string {
  const rotulo = c.last_message_type ? ROTULO_ANEXO[c.last_message_type] : undefined
  return rotulo ?? c.last_message ?? 'Sem mensagens'
}

function titulo(c: Conversation): string {
  return c.contact_name ?? c.phone ?? 'Contato sem nome'
}

// Mesma troca de aba client-only do shell: `history.pushState` atualiza a URL
// sem round-trip de RSC e o `useSearchParams` de `(app)/page.tsx` reage a ela.
function irParaAba(tab: ActiveTab): void {
  window.history.pushState(null, '', tabHref(tab))
}

function Tile({
  rotulo,
  valor,
  nota,
  atraso,
}: {
  rotulo: string
  valor: string
  nota: string
  atraso: number
}) {
  return (
    <Card tone="soft" className="reveal-rise" style={{ animationDelay: `${atraso}ms` }}>
      <CardContent className="flex flex-col gap-1">
        <p className="t-caption text-body">{rotulo}</p>
        <p className="t-display-lg tabular text-ink">{valor}</p>
        <p className="t-caption text-mute">{nota}</p>
      </CardContent>
    </Card>
  )
}

/** Lista plana: hairline entre linhas, sem card. É o idioma `faq-row` do doc. */
function Lista({
  titulo: cabecalho,
  descricao,
  acao,
  atraso,
  children,
}: {
  titulo: string
  descricao: string
  acao: () => void
  atraso: number
  children: React.ReactNode
}) {
  return (
    <section className="reveal-rise" style={{ animationDelay: `${atraso}ms` }}>
      <header className="flex items-end justify-between gap-4 px-3 pb-3">
        <div className="min-w-0">
          <h2 className="t-display-sm text-ink">{cabecalho}</h2>
          <p className="t-caption text-body">{descricao}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={acao}
          className="shrink-0 text-body hover:text-ink"
        >
          Ver todas
          <ChevronRight aria-hidden />
        </Button>
      </header>
      <ul>{children}</ul>
    </section>
  )
}

function Linha({
  conversa,
  meta,
}: {
  conversa: Conversation
  meta: React.ReactNode
}) {
  return (
    <li className="border-t border-hairline">
      <button
        type="button"
        onClick={() => irParaAba('conversations')}
        aria-label={`Abrir conversa com ${titulo(conversa)}`}
        className="group flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-canvas-soft"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-canvas-soft t-body-sm-strong text-ink transition-colors group-hover:bg-canvas">
          {getInitials(conversa.contact_name, conversa.phone ?? '')}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate t-body-md-strong text-ink">{titulo(conversa)}</span>
          <span className="block truncate t-body-sm text-body">
            {conversa.last_direction === 'outbound' && <span className="text-mute">Você: </span>}
            {trecho(conversa)}
          </span>
        </span>
        {meta}
      </button>
    </li>
  )
}

export default function Dashboard() {
  const agora = useAgora()
  const { metrics } = useMetrics()
  const { conta } = useConta()
  const { conversas, naoLidas } = useConversations()

  // Fila = quem falou por último foi o lead. Mesma régua de
  // `metrics.conversas.filaAtendimento`. Quem espera há mais tempo vem primeiro.
  const fila = conversas
    .filter((c) => c.last_direction === 'inbound')
    .sort(
      (a, b) =>
        new Date(a.last_message_time).getTime() - new Date(b.last_message_time).getTime()
    )

  const recentes = conversas.slice(0, 6)

  return (
    <div className="scroll-soft h-full overflow-y-auto px-8 py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="t-display-xl text-ink">Dashboard</h1>
            <p className="mt-1 max-w-prose t-body-md text-body">
              Visão geral da operação de WhatsApp da Artha.
            </p>
          </div>
          {/* O número só entra quando a Meta responde: enquanto isso fica a
              data sozinha. Carimbar um número que talvez não seja o conectado
              é pior que não carimbar nenhum. */}
          <p className="t-caption text-mute">
            {conta ? `${conta.telefone} · ` : ''}
            {format(agora, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </header>

        {/* Quatro tiles `card-soft-tinted`: número em `--t-display-lg`, rótulo
            em caption. O 612 fica de fora — é a fala da banda abaixo. */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Tile
            rotulo="Leads na base"
            valor={NUM.format(metrics.totalLeads)}
            nota="Cadastro completo da operação"
            atraso={0}
          />
          <Tile
            rotulo="Fila de atendimento"
            valor={NUM.format(metrics.conversas.filaAtendimento)}
            nota="Conversas aguardando resposta"
            atraso={60}
          />
          <Tile
            rotulo="Conversas"
            valor={NUM.format(metrics.conversas.total)}
            nota={`${NUM.format(metrics.conversas.janelaAberta)} com janela de 24h aberta`}
            atraso={120}
          />
          <Tile
            rotulo="Qualificados"
            valor={NUM.format(metrics.porEtapa.qualificado)}
            nota="Produto e momento identificados"
            atraso={180}
          />
        </div>

        {/* A ÚNICA banda de polaridade invertida da tela. `--ink` de fundo e
            `--on-ink` de texto: preta no tema claro, branca no escuro.

            O ouro do número-herói (papel 3 da lista fechada, spec §3.2) usa
            `--accent-on-ink`, não `--accent-text`: este foi verificado contra o
            canvas, e a banda inverte a polaridade. No escuro ela é branca, onde
            `--accent-text` daria 1,61:1. O `--accent-on-ink` é o espelho dele —
            10,1:1 no claro (ouro sobre preto), 5,41:1 no escuro (sobre branco). */}
        <Card tone="dark" className="reveal-rise py-8" style={{ animationDelay: '240ms' }}>
          <CardContent className="px-8">
            <div className="min-w-0">
              <p className="t-caption text-on-ink opacity-70">Leads qualificados</p>
              <p className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="t-display-xxl tabular text-accent-on-ink">
                  {NUM.format(metrics.porEtapa.qualificado)}
                </span>
                <span className="t-display-md text-on-ink">
                  leads com produto e momento identificados
                </span>
              </p>
              <p className="mt-3 max-w-prose t-body-md text-on-ink opacity-75">
                {NUM.format(metrics.porSegmento.artha)} para a Artha e{' '}
                {NUM.format(metrics.porSegmento.dhana)} para a Dhana — separados na entrada,
                antes de o operador abrir a conversa.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-8 lg:grid-cols-2">
          <Lista
            titulo="Fila de atendimento"
            descricao="Última mensagem foi do lead — quem espera há mais tempo vem primeiro."
            acao={() => irParaAba('conversations')}
            atraso={300}
          >
            {fila.length === 0 ? (
              <li className="border-t border-hairline px-3 py-6 t-body-sm text-mute">
                Nenhuma conversa aguardando resposta.
              </li>
            ) : (
              fila.map((c) => (
                <Linha
                  key={c.key}
                  conversa={c}
                  meta={
                    <span className="shrink-0 t-caption tabular text-body">
                      há {espera(c.last_message_time, agora)}
                    </span>
                  }
                />
              ))
            )}
          </Lista>

          <Lista
            titulo="Últimas conversas"
            descricao="Movimento mais recente do número conectado."
            acao={() => irParaAba('conversations')}
            atraso={360}
          >
            {recentes.map((c) => (
              <Linha
                key={c.key}
                conversa={c}
                meta={
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="t-caption tabular text-mute">
                      {carimbo(c.last_message_time, agora)}
                    </span>
                    <Badge count={naoLidas[c.key] ?? 0} />
                  </span>
                }
              />
            ))}
          </Lista>
        </div>
      </div>
    </div>
  )
}
