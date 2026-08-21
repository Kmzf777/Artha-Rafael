import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

// `text-input` — preenchimento `--canvas-soft`, raio 8px (`--r-md`).
// A spec §3.1 resolve a contradição do DESIGN.md em favor de 8px: canto reto ao
// lado de pílula 999px briga na tela.
// O input não tem borda: a superfície é o próprio contorno. Foco pelo anel
// global em `--accent`.
function Input({
  className,
  type,
  tone = "default",
  ...props
}: React.ComponentProps<"input"> & {
  /** `soft` = text-input-on-soft, o preenchimento mais claro para input aninhado em card branco. */
  tone?: "default" | "soft"
}) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-md border-0 px-4 t-body-md text-ink transition-colors placeholder:text-mute disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 file:inline-flex file:border-0 file:bg-transparent file:t-body-sm-strong file:text-ink",
        tone === "default" ? "bg-canvas-soft" : "bg-canvas-softer",
        className
      )}
      {...props}
    />
  )
}

export { Input }
