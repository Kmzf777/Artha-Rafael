import * as React from "react"

import { cn } from "@/lib/utils"

// `category-button` — a pílula de filtro do DESIGN.md.
// Selecionado é o papel 4 do Ouro Artha (spec §3.2): fundo `--accent-soft`,
// texto `--accent-text`. É o único estado colorido do sistema além do foco, do
// número-herói, da barra de aba ativa e da série primária de gráfico.
function Chip({
  className,
  selected = false,
  ...props
}: React.ComponentProps<"button"> & { selected?: boolean }) {
  return (
    <button
      type="button"
      data-slot="chip"
      data-selected={selected || undefined}
      aria-pressed={selected}
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-2 rounded-pill px-4 t-body-sm-strong transition-colors select-none disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        selected
          ? "bg-accent-soft text-accent-text"
          : "bg-canvas-soft text-ink hover:bg-surface-pressed",
        className
      )}
      {...props}
    />
  )
}

// Variante estática (não clicável) para rotular segmento, etapa e plano dentro
// de linha de tabela. `outlined` distingue etapa do funil de segmento sem cor.
function Tag({
  className,
  variant = "solid",
  ...props
}: React.ComponentProps<"span"> & { variant?: "solid" | "outlined" }) {
  return (
    <span
      data-slot="tag"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-3 py-1 t-body-sm-strong whitespace-nowrap",
        variant === "solid"
          ? "bg-canvas-soft text-ink"
          : "border border-hairline text-body",
        className
      )}
      {...props}
    />
  )
}

export { Chip, Tag }
