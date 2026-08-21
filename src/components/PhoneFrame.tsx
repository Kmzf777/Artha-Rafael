'use client'

import type { ReactNode } from 'react'

import { useConta } from '@/hooks/useConta'

// Moldura de aparelho para prévia de mensagem: bisel em `--canvas-soft`, tela em
// `--canvas`, raio 16px por fora e 8px na tela. Extraída de Disparos quando a aba
// Templates passou a precisar da mesma prévia — duas telas desenhando o mesmo
// aparelho de jeitos diferentes é como a demo perde credibilidade.

function iniciais(nome: string): string {
  return nome
    .split(' ')
    .map((parte) => parte[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export default function PhoneFrame({
  contato,
  children,
}: {
  contato: string
  children: ReactNode
}) {
  // O remetente da prévia é o número real que envia. Enquanto a Meta não
  // responde, a linha simplesmente não aparece — a prévia não inventa remetente.
  const { conta } = useConta()

  return (
    <div className="elev-1 rounded-xl bg-canvas-soft p-3">
      <div aria-hidden className="mx-auto mb-3 h-1 w-16 rounded-pill bg-mute" />
      <div className="overflow-hidden rounded-md bg-canvas">
        <div className="flex items-center gap-3 border-b border-hairline px-4 py-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink t-body-sm-strong text-on-ink">
            {iniciais(contato)}
          </span>
          <span className="min-w-0">
            <span className="block truncate t-body-sm-strong text-ink">{contato}</span>
            {conta && (
              <span className="block truncate font-mono t-caption text-body">{conta.telefone}</span>
            )}
          </span>
        </div>

        <div className="space-y-3 px-4 py-4">{children}</div>
      </div>
    </div>
  )
}
