import * as React from "react"

import { cn } from "@/lib/utils"

// Raio canônico de card: 16px (`--r-xl`). Padding 24px (`--s-2xl`).
// Level 0 flat é o padrão — o card se apoia em contraste de superfície, não em
// sombra. Quem precisa de elevação aplica `.elev-1` / `.elev-2` (que no tema
// escuro já viram hairline em vez de sombra).
function Card({
  className,
  tone = "default",
  ...props
}: React.ComponentProps<"div"> & {
  /**
   * `default` = card-content · `soft` = card-soft-tinted ·
   * `dark` = promo-card-on-dark (inversão de polaridade — o movimento
   * assinatura do DESIGN.md; usar no máximo uma vez por tela).
   */
  tone?: "default" | "soft" | "dark"
}) {
  return (
    <div
      data-slot="card"
      data-tone={tone}
      className={cn(
        "group/card flex flex-col gap-4 overflow-hidden rounded-xl py-6 t-body-md",
        tone === "default" && "bg-canvas text-ink",
        tone === "soft" && "bg-canvas-soft text-ink",
        tone === "dark" && "bg-ink text-on-ink",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto]",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("t-display-sm", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn(
        "t-body-sm text-body group-data-[tone=dark]/card:text-on-ink group-data-[tone=dark]/card:opacity-75",
        className
      )}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-content" className={cn("px-6", className)} {...props} />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center gap-3 px-6 pt-2", className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
