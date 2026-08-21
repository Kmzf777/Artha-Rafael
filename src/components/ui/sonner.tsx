"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { Check, Info, TriangleAlert, X, LoaderCircle } from "lucide-react"

// `ex-toast` — chrome de card-content com Level 2. Sem `richColors`: o sistema
// não tem paleta semântica; o toast distingue por ícone e rótulo (spec §3.5).
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <Check className="size-4" />,
        info: <Info className="size-4" />,
        warning: <TriangleAlert className="size-4" />,
        error: <TriangleAlert className="size-4" />,
        loading: <LoaderCircle className="size-4 animate-spin" />,
        close: <X className="size-4" />,
      }}
      style={
        {
          "--normal-bg": "var(--canvas)",
          "--normal-text": "var(--ink)",
          "--normal-border": "var(--hairline)",
          "--border-radius": "var(--r-xl)",
          boxShadow: "var(--elev-2)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
