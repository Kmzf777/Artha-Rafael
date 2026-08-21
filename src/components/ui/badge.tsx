import React from 'react'

type BadgeProps = {
  count?: number
  children?: React.ReactNode
  className?: string
}

// Contador de não lidas. Polaridade invertida (`--ink` / `--on-ink`) para
// sobreviver tanto sobre `--canvas` quanto sobre uma linha de nav ativa.
export default function Badge({ count, children, className }: BadgeProps) {
  const show = typeof count === 'number' ? count > 0 : !!children
  if (!show) return null
  return (
    <span
      aria-live="polite"
      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-pill bg-ink px-2 t-caption font-medium text-on-ink tabular ${className ?? ''}`}
    >
      {typeof count === 'number' ? count : children}
    </span>
  )
}
