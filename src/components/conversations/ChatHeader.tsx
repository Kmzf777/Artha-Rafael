'use client'

import { PanelRight, Timer, TimerOff } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { getInitials } from '@/lib/format'
import type { WindowStatus } from '@/lib/janela24h'
import { cn } from '@/lib/utils'
import { formatarTelefone } from './telefone'

type Props = {
  nome: string | null
  telefone: string | null
  windowStatus: WindowStatus
  /** Histórico ainda não carregado: sem thread, o estado da janela é
   *  desconhecido e o selo não aparece — ausência de dado não é regra. */
  janelaDesconhecida: boolean
  detalhesAbertos: boolean
  onAlternarDetalhes: () => void
}

/**
 * Cabeçalho da thread.
 *
 * O selo da janela de 24h é MONOCROMÁTICO de propósito: `janela24h.ts` oferece
 * `WINDOW_COLORS` / `WINDOW_DOTS` (verde/amarelo/vermelho), herança do painel
 * anterior, e a spec §3.5 proíbe estado por cor. Aqui o estado é ícone +
 * rótulo + o tempo restante escrito por extenso.
 */
export default function ChatHeader({
  nome,
  telefone,
  windowStatus,
  janelaDesconhecida,
  detalhesAbertos,
  onAlternarDetalhes,
}: Props) {
  const rotulo = nome || formatarTelefone(telefone)

  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-hairline bg-canvas px-5 py-3">
      <Avatar>
        <AvatarFallback>{getInitials(nome, telefone ?? '')}</AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col">
        <p className="truncate t-body-md-strong text-ink">{rotulo}</p>
        <p className="truncate font-mono t-caption text-body">{formatarTelefone(telefone)}</p>
      </div>

      {!janelaDesconhecida && (
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-2 rounded-pill bg-canvas-soft px-3 py-1.5 t-body-sm-strong',
            windowStatus.isOpen ? 'text-body' : 'text-ink'
          )}
          title={
            windowStatus.isOpen
              ? `Restam ${windowStatus.timeLeft} da janela de 24h para responder em texto livre`
              : 'Janela de 24h fechada — só um template aprovado pode sair'
          }
        >
          {windowStatus.isOpen ? (
            <Timer className="size-4 shrink-0" aria-hidden />
          ) : (
            <TimerOff className="size-4 shrink-0" aria-hidden />
          )}
          {windowStatus.isOpen ? `Janela aberta · restam ${windowStatus.timeLeft}` : 'Janela fechada'}
        </span>
      )}

      <Button
        variant="ghost"
        size="icon"
        onClick={onAlternarDetalhes}
        aria-pressed={detalhesAbertos}
        title={detalhesAbertos ? 'Ocultar detalhes do contato' : 'Ver detalhes do contato'}
      >
        <PanelRight aria-hidden />
        <span className="sr-only">Detalhes do contato</span>
      </Button>
    </header>
  )
}
