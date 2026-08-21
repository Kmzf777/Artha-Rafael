import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// A pílula 999px é a assinatura geométrica do sistema: todo botão a usa, sem
// exceção. Altura mínima de 44px em qualquer tamanho (alvo de toque, spec §3.4).
// O anel de foco vem do `:focus-visible` global em `--accent` — nenhum botão
// declara o seu, para o acento ter um único dono.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-pill border border-transparent whitespace-nowrap transition-colors duration-150 select-none disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // button-primary — o alvo de conversão. Preto no claro, branco no
        // escuro (inversão de polaridade do DESIGN.md). Nunca ouro.
        default:
          "bg-primary text-on-primary hover:bg-[color-mix(in_srgb,var(--primary)_86%,var(--canvas))]",
        // button-secondary — a pílula branca pareada com a preta.
        secondary:
          "bg-canvas text-ink border-hairline hover:bg-canvas-soft active:bg-surface-pressed",
        // button-subtle — a pílula cinza para ação terciária dentro de card.
        subtle:
          "bg-canvas-soft text-ink hover:bg-surface-pressed active:bg-surface-pressed",
        outline:
          "bg-canvas text-ink border-hairline hover:bg-canvas-soft active:bg-surface-pressed",
        ghost: "text-ink hover:bg-canvas-soft active:bg-surface-pressed",
        // Estado não é cor (spec §3.5): a ação de risco se distingue por peso,
        // não por vermelho. O ícone de alerta acompanha no chamador.
        destructive:
          "bg-canvas-soft text-ink font-medium hover:bg-surface-pressed",
        link: "text-link underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 gap-2 px-5 t-button-md",
        xs: "h-11 gap-1.5 px-4 t-body-sm-strong",
        sm: "h-11 gap-1.5 px-4 t-body-sm-strong",
        lg: "h-14 gap-2 px-6 t-button-lg",
        icon: "size-11",
        "icon-xs": "size-11",
        "icon-sm": "size-11",
        "icon-lg": "size-14",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
