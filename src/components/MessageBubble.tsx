'use client'

import { format } from 'date-fns'
import { Check, CornerUpLeft, Megaphone, Reply } from 'lucide-react'
import { MediaLabel } from '@/components/MediaLabel'
import { StatusLabel } from '@/components/ui/status-label'
import type { Message } from '@/lib/conversationTypes'
import { cn } from '@/lib/utils'
import type { DeliveryStatus } from '@/mock/types'

/**
 * Bolha de mensagem — spec §5.
 *
 * Recebida em `--canvas-soft`; enviada com INVERSÃO DE POLARIDADE (fundo
 * `--ink`, texto `--on-ink`). É o mesmo movimento do `promo-card-on-dark` do
 * DESIGN.md, na menor escala do sistema. Ambas em `--r-xl` (16px).
 *
 * Estado de entrega vem de `status-label` (cinza + ícone + rótulo, nunca cor).
 * Sobre a bolha enviada o tom do rótulo é sobrescrito para `--on-ink`: preto
 * sobre preto não se lê, e a distinção de estado nunca dependeu de matiz.
 */
export type MessageBubbleProps = {
  mensagem: Message
  status: DeliveryStatus | null
  /** Rótulos dos botões que esta bolha ofereceu, do template ou do roteiro. */
  botoes?: readonly string[]
  /** Nome do template cadastrado na Meta, para o sobrescrito da bolha. */
  nomeTemplate?: string | null
  /** Qual dos botões o lead clicou, quando clicou. */
  botaoClicado?: string | null
  /** Mensagem citada, quando esta é uma resposta a outra. */
  citada?: Message | null
  onResponder?: (m: Message) => void
}

export default function MessageBubble({
  mensagem,
  status,
  botoes,
  nomeTemplate,
  botaoClicado,
  citada,
  onResponder,
}: MessageBubbleProps) {
  const enviada = mensagem.direction === 'outbound'
  const hora = format(new Date(mensagem.created_at), 'HH:mm')
  const ehTemplate = mensagem.message_type === 'template'
  const ehCliqueDeBotao = mensagem.message_type === 'button'

  // Uma única variável de polaridade: tudo dentro da bolha herda dela.
  const tinta = enviada ? 'text-on-ink' : 'text-ink'
  const tintaFraca = enviada ? 'text-on-ink opacity-70' : 'text-body'
  const risco = enviada ? 'border-mute' : 'border-hairline'

  return (
    <div
      data-slot="message-bubble"
      data-direction={mensagem.direction}
      className={cn('group/bubble flex w-full items-end gap-2', enviada ? 'justify-end' : 'justify-start')}
    >
      {enviada && onResponder && <BotaoResponder mensagem={mensagem} onResponder={onResponder} />}

      <div
        className={cn(
          'flex w-fit max-w-lg min-w-0 flex-col overflow-hidden rounded-xl',
          enviada ? 'bg-ink text-on-ink' : 'bg-canvas-soft text-ink'
        )}
      >
        <div className="flex flex-col gap-1 px-4 py-3">
          {ehTemplate && (
            <span className={cn('inline-flex items-center gap-1.5 t-caption', tintaFraca)}>
              <Megaphone className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">
                {nomeTemplate ? `Template · ${nomeTemplate}` : 'Template de campanha'}
              </span>
            </span>
          )}

          {ehCliqueDeBotao && (
            <span className={cn('inline-flex items-center gap-1.5 t-caption', tintaFraca)}>
              <CornerUpLeft className="size-3.5 shrink-0" aria-hidden />
              Resposta ao botão do template
            </span>
          )}

          {citada && (
            <blockquote
              className={cn('mb-1 border-l-2 pl-3 t-caption', risco, tintaFraca)}
            >
              <span className="line-clamp-2">
                <MediaLabel type={citada.message_type} content={citada.content} />
              </span>
            </blockquote>
          )}

          <p className={cn('break-words whitespace-pre-wrap', ehCliqueDeBotao ? 't-body-md-strong' : 't-body-md', tinta)}>
            <MediaLabel type={mensagem.message_type} content={mensagem.content} />
          </p>

          <span className="mt-1 inline-flex items-center justify-end gap-2">
            <time className={cn('tabular t-caption', tintaFraca)} dateTime={mensagem.created_at}>
              {hora}
            </time>
            {enviada && status && <StatusLabel status={status} className="text-on-ink" />}
          </span>
        </div>

        {/* Os botões que a bolha ofereceu — quick reply de template ou botão do
            roteiro. O que o lead tocou aparece marcado; os demais recuam por
            opacidade, não por cor — a régua de estado sem matiz vale aqui. */}
        {botoes && botoes.length > 0 && (
          <ul className="flex flex-col">
            {botoes.map((rotulo) => {
              const clicado = rotulo === botaoClicado
              return (
                <li key={rotulo} className={cn('border-t', risco)}>
                  <span
                    className={cn(
                      'flex h-11 items-center justify-center gap-2 px-4 t-body-sm-strong',
                      tinta,
                      clicado ? 'opacity-100' : 'opacity-55'
                    )}
                  >
                    {clicado ? (
                      <Check className="size-3.5 shrink-0" aria-hidden />
                    ) : (
                      <Reply className="size-3.5 shrink-0" aria-hidden />
                    )}
                    <span className="truncate">{rotulo}</span>
                    {clicado && <span className="sr-only">— botão escolhido pelo lead</span>}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {!enviada && onResponder && <BotaoResponder mensagem={mensagem} onResponder={onResponder} />}
    </div>
  )
}

/** Aparece no hover da bolha. Alvo de 44px, como todo interativo do sistema. */
function BotaoResponder({
  mensagem,
  onResponder,
}: {
  mensagem: Message
  onResponder: (m: Message) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onResponder(mensagem)}
      title="Responder a esta mensagem"
      className="flex size-11 shrink-0 items-center justify-center rounded-full text-body opacity-0 transition-opacity hover:bg-canvas-soft hover:text-ink group-hover/bubble:opacity-100 focus-visible:opacity-100"
    >
      <Reply className="size-4" aria-hidden />
      <span className="sr-only">Responder</span>
    </button>
  )
}
