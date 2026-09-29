'use client'

import { useEffect, useMemo, useRef } from 'react'
import { MessageSquareText } from 'lucide-react'
import MessageBubble from '@/components/MessageBubble'
import { Skeleton } from '@/components/ui/skeleton'
import { mapearBotoes } from '@/lib/botoesDaConversa'
import type { Message } from '@/lib/conversationTypes'
import { formatSectionDate } from '@/lib/format'
import { agruparPorData, localizarNaoLidas } from '@/lib/timeline'
import type { DeliveryStatus, Template } from '@/mock/types'

type Props = {
  /** Muda ao trocar de conversa: é o gatilho de rolar para o fim. */
  conversaKey: string | null
  mensagens: Message[]
  statusDe: (id: string) => DeliveryStatus | null
  /** Não lidas no instante em que a conversa foi aberta — o divisor da thread. */
  naoLidasAoAbrir: number
  templates: Template[]
  carregando: boolean
  onResponder: (m: Message) => void
}

/**
 * Marcador "lido até aqui" derivado da contagem de não lidas do card: a
 * n-ésima mensagem recebida contando do fim é a primeira não lida. Reconstruir
 * o marcador é o que permite reusar `localizarNaoLidas` em vez de recontar.
 */
function marcadorDeLeitura(mensagens: Message[], naoLidas: number): string | null {
  if (naoLidas <= 0) return null
  const recebidas = mensagens.filter((m) => m.direction === 'inbound')
  const primeira = recebidas[recebidas.length - naoLidas]
  if (!primeira) return null
  return new Date(new Date(primeira.created_at).getTime() - 1).toISOString()
}

export default function MessageTimeline({
  conversaKey,
  mensagens,
  statusDe,
  naoLidasAoAbrir,
  templates,
  carregando,
  onResponder,
}: Props) {
  const fim = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'end' })
  }, [conversaKey, mensagens.length])

  const grupos = useMemo(() => agruparPorData(mensagens), [mensagens])
  const botoes = useMemo(() => mapearBotoes(mensagens, templates), [mensagens, templates])
  const porId = useMemo(() => new Map(mensagens.map((m) => [m.id, m])), [mensagens])

  const { primeiraNaoLidaId, quantidade } = useMemo(() => {
    const marcador = marcadorDeLeitura(mensagens, naoLidasAoAbrir)
    if (!marcador) return { primeiraNaoLidaId: null, quantidade: 0 }
    return localizarNaoLidas(mensagens, marcador)
  }, [mensagens, naoLidasAoAbrir])

  if (carregando) {
    return (
      <div className="flex flex-1 flex-col gap-4 overflow-hidden px-6 py-6">
        <Skeleton className="h-16 w-80 rounded-xl" />
        <Skeleton className="h-16 w-96 self-end rounded-xl" />
        <Skeleton className="h-24 w-80 rounded-xl" />
      </div>
    )
  }

  if (mensagens.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <MessageSquareText className="size-8 text-body" aria-hidden />
        <p className="t-body-md text-body">Nenhuma mensagem nesta conversa ainda.</p>
      </div>
    )
  }

  return (
    <div className="scroll-soft flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-2">
        {grupos.map((grupo) => (
          <section key={grupo.date} className="flex flex-col gap-2">
            <h3 className="my-4 self-center rounded-pill bg-canvas-soft px-3 py-1 t-caption text-body">
              {formatSectionDate(grupo.msgs[0].created_at)}
            </h3>

            {grupo.msgs.map((msg) => {
              const daBolha = botoes.get(msg.id)
              return (
                <div key={msg.id} className="flex flex-col gap-2">
                  {msg.id === primeiraNaoLidaId && quantidade > 0 && (
                    <div className="my-2 flex items-center gap-3" role="separator">
                      <span className="h-px flex-1 bg-hairline" />
                      <span className="t-caption text-body">
                        {quantidade === 1 ? '1 mensagem não lida' : `${quantidade} mensagens não lidas`}
                      </span>
                      <span className="h-px flex-1 bg-hairline" />
                    </div>
                  )}
                  <MessageBubble
                    mensagem={msg}
                    status={statusDe(msg.id)}
                    botoes={daBolha?.rotulos}
                    nomeTemplate={daBolha?.nomeTemplate ?? null}
                    botaoClicado={daBolha?.clicado ?? null}
                    citada={msg.reply_to_message_id ? porId.get(msg.reply_to_message_id) ?? null : null}
                    onResponder={onResponder}
                  />
                </div>
              )
            })}
          </section>
        ))}
        <div ref={fim} aria-hidden />
      </div>
    </div>
  )
}
