'use client'

import { useMemo, useState } from 'react'
import { Inbox, Search } from 'lucide-react'
import { MediaLabel } from '@/components/MediaLabel'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import Badge from '@/components/ui/badge'
import { Chip } from '@/components/ui/chip'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ROTULO_MATCH, recortarTrecho } from '@/lib/buscaConversas'
import { contarConversasNaoLidas, filtrarConversas } from '@/lib/conversationFilter'
import type { Conversation } from '@/lib/conversationTypes'
import { formatMsgTime, getInitials } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ResultadoBuscaConversa } from '@/hooks/useConversationData'

type Props = {
  conversas: Conversation[]
  naoLidas: Record<string, number>
  selecionada: string | null
  onSelecionar: (conversa: Conversation) => void
  busca: string
  onBuscaChange: (valor: string) => void
  /** `null` = sem busca ativa; `[]` = buscou e não achou nada. */
  resultados: ResultadoBuscaConversa[] | null
  buscando: boolean
  carregando: boolean
}

export default function ConversationList({
  conversas,
  naoLidas,
  selecionada,
  onSelecionar,
  busca,
  onBuscaChange,
  resultados,
  buscando,
  carregando,
}: Props) {
  const [apenasNaoLidas, setApenasNaoLidas] = useState(false)

  const pendentes = contarConversasNaoLidas(conversas, naoLidas)

  // Com busca ativa manda o resultado global (casa também em conteúdo de
  // mensagem e tag); sem busca, a lista recente com o filtro de não lidas.
  const visiveis = useMemo(
    () =>
      filtrarConversas({
        conversas,
        busca: '',
        apenasNaoLidas,
        naoLidas,
        selecionada,
      }),
    [conversas, apenasNaoLidas, naoLidas, selecionada]
  )

  const emBusca = resultados !== null
  const lista: Conversation[] = emBusca ? resultados : visiveis

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-r border-hairline bg-canvas xl:w-96">
      <div className="flex flex-col gap-4 px-5 pt-8 pb-4">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="t-display-md text-ink">Conversas</h1>
          <span className="tabular t-body-sm text-body">
            {conversas.length} {conversas.length === 1 ? 'aberta' : 'abertas'}
          </span>
        </div>

        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-body"
            aria-hidden
          />
          <Input
            value={busca}
            onChange={(e) => onBuscaChange(e.target.value)}
            placeholder="Buscar por nome, telefone ou mensagem"
            aria-label="Buscar conversas"
            className="pl-11"
          />
        </div>

        <div className="flex items-center gap-2">
          <Chip selected={apenasNaoLidas} onClick={() => setApenasNaoLidas((v) => !v)}>
            Não lidas
            {pendentes > 0 && <span className="tabular">{pendentes}</span>}
          </Chip>
          {buscando && <span className="t-caption text-body">Buscando…</span>}
        </div>
      </div>

      <div className="scroll-soft flex-1 overflow-y-auto px-3 pb-4">
        {carregando && (
          <div className="flex flex-col gap-2 px-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-md" />
            ))}
          </div>
        )}

        {!carregando && lista.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <Inbox className="size-8 text-body" aria-hidden />
            <p className="t-body-sm text-body">
              {emBusca
                ? 'Nenhuma conversa encontrada para esta busca.'
                : apenasNaoLidas
                  ? 'Nenhuma conversa esperando resposta.'
                  : 'Nenhuma conversa por aqui.'}
            </p>
          </div>
        )}

        <ul className="flex flex-col">
          {lista.map((conversa) => {
            const achado = emBusca
              ? resultados.find((r) => r.key === conversa.key) ?? null
              : null
            return (
              <li key={conversa.key}>
                <CardConversa
                  conversa={conversa}
                  naoLidas={naoLidas[conversa.key] ?? 0}
                  selecionada={conversa.key === selecionada}
                  onSelecionar={onSelecionar}
                  achado={achado}
                  termo={busca}
                />
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function CardConversa({
  conversa,
  naoLidas,
  selecionada,
  onSelecionar,
  achado,
  termo,
}: {
  conversa: Conversation
  naoLidas: number
  selecionada: boolean
  onSelecionar: (conversa: Conversation) => void
  achado: ResultadoBuscaConversa | null
  termo: string
}) {
  const nome = conversa.contact_name || conversa.phone || 'Contato'
  // O rótulo do porquê do resultado: sem ele a busca por mensagem parece mágica.
  const mostrarMotivo = achado !== null && achado.match_tipo !== 'nome'

  return (
    <button
      type="button"
      onClick={() => onSelecionar(conversa)}
      aria-current={selecionada ? 'true' : undefined}
      className={cn(
        'flex w-full items-start gap-3 rounded-md px-2 py-3 text-left transition-colors',
        selecionada ? 'bg-surface-pressed' : 'hover:bg-canvas-soft'
      )}
    >
      <Avatar>
        <AvatarFallback>{getInitials(conversa.contact_name, conversa.phone ?? '')}</AvatarFallback>
      </Avatar>

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate t-body-md-strong text-ink">{nome}</span>
          <time className="tabular t-caption text-body" dateTime={conversa.last_message_time}>
            {formatMsgTime(conversa.last_message_time)}
          </time>
        </span>

        <span className="flex items-center gap-2">
          <span
            className={cn(
              'min-w-0 flex-1 truncate t-body-sm',
              naoLidas > 0 ? 'text-ink' : 'text-body'
            )}
          >
            {conversa.last_direction === 'outbound' && <span className="text-body">Você: </span>}
            <MediaLabel type={conversa.last_message_type} content={conversa.last_message} />
          </span>
          <Badge count={naoLidas} />
        </span>

        {mostrarMotivo && (
          <span className="truncate t-caption text-body">
            {ROTULO_MATCH[achado.match_tipo]}: {recortarTrecho(achado.match_trecho, termo)}
          </span>
        )}
      </span>
    </button>
  )
}
