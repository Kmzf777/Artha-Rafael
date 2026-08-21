import { Check, CheckCheck, CirclePause, Clock, TriangleAlert, X, Send } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Semântica sem cor — spec §3.5.
 *
 * Estado operacional é cinza + ícone + rótulo, nunca matiz. O rótulo textual é
 * SEMPRE visível: nunca só o ícone, nunca só cor. "Falhou" se destaca por peso
 * de fonte e por ser o único com ícone de alerta.
 *
 * Fonte única para Conversas, Disparos, Agendamentos e Templates — telas
 * escritas por agentes diferentes precisam mostrar o mesmo estado do mesmo jeito.
 *
 * Dois vocabulários convivem aqui: ENTREGA de mensagem (enviado…falhou) e
 * REVISÃO de template pela Meta (aprovado, rejeitado, pausado). `pendente`
 * serve aos dois. Não se traduz um no outro — mapear "aprovado" para "enviado"
 * mostraria o rótulo errado, e num sistema sem cor o rótulo é a única pista.
 */
export type StatusKind =
  | "enviado"
  | "entregue"
  | "lido"
  | "falhou"
  | "pendente"
  | "cancelado"
  | "enviando"
  | "aprovado"
  | "rejeitado"
  | "pausado"

// Hierarquia em três degraus, todos legíveis: --body (6,48:1 no claro, 9,57:1 no
// escuro) para o estado neutro, --ink para o que mudou, --ink + peso 500 + ícone de
// alerta para a falha. `--mute` NÃO entra aqui: 2,32:1 sobre branco é placeholder,
// não é dado. Num sistema sem cor semântica, o rótulo é a única pista que existe —
// se ele não for legível, a decisão de não usar cor não se sustenta.
const STATUS = {
  enviado: { icon: Check, label: "Enviado", tone: "text-body" },
  entregue: { icon: CheckCheck, label: "Entregue", tone: "text-body" },
  lido: { icon: CheckCheck, label: "Lido", tone: "text-ink" },
  falhou: { icon: TriangleAlert, label: "Falhou", tone: "text-ink font-medium" },
  pendente: { icon: Clock, label: "Pendente", tone: "text-body" },
  cancelado: { icon: X, label: "Cancelado", tone: "text-body" },
  enviando: { icon: Send, label: "Enviando", tone: "text-body" },
  aprovado: { icon: CheckCheck, label: "Aprovado", tone: "text-ink" },
  rejeitado: { icon: TriangleAlert, label: "Rejeitado", tone: "text-ink font-medium" },
  pausado: { icon: CirclePause, label: "Pausado", tone: "text-body" },
} as const satisfies Record<
  StatusKind,
  { icon: React.ElementType; label: string; tone: string }
>

export function statusLabel(status: StatusKind): string {
  return STATUS[status].label
}

function StatusLabel({
  status,
  className,
  iconOnly = false,
}: {
  status: StatusKind
  className?: string
  /** Só para o rodapé de bolha de mensagem, onde o rótulo vai no `title`. */
  iconOnly?: boolean
}) {
  const { icon: Icon, label, tone } = STATUS[status]
  return (
    <span
      data-slot="status-label"
      data-status={status}
      title={iconOnly ? label : undefined}
      className={cn("inline-flex items-center gap-1.5 t-caption", tone, className)}
    >
      <Icon className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
      {iconOnly ? <span className="sr-only">{label}</span> : label}
    </span>
  )
}

export { StatusLabel }
