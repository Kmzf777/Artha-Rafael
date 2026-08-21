'use client'

import { Send, TriangleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatScheduledAt } from '@/lib/scheduling'
import type { Template } from '@/mock/types'

// Última porta antes de a campanha virar fila. O passo 3 do wizard já resume o
// disparo; este diálogo existe porque enfileirar centenas de mensagens é
// irreversível em bloco — a partir daqui só dá para cancelar um a um.

export type SendDisparoDialogProps = {
  open: boolean
  onOpenChange: (aberto: boolean) => void
  template: Template
  nomeCampanha: string
  destinatarios: number
  /** ISO do primeiro envio da fila. */
  primeiroDisparoEm: string
  /** Já formatada ("2 h 15 min") — a mesma conta que o passo 3 exibe. */
  duracaoEstimada: string
  enfileirando: boolean
  onConfirmar: () => void
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="t-body-sm text-body">{rotulo}</dt>
      <dd className="min-w-0 truncate text-right t-body-sm-strong text-ink">{children}</dd>
    </div>
  )
}

export default function SendDisparoDialog({
  open,
  onOpenChange,
  template,
  nomeCampanha,
  destinatarios,
  primeiroDisparoEm,
  duracaoEstimada,
  enfileirando,
  onConfirmar,
}: SendDisparoDialogProps) {
  const contatos = destinatarios.toLocaleString('pt-BR')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar disparo</DialogTitle>
          <DialogDescription>
            A campanha entra na fila agora e os envios saem espaçados, um a cada 45 segundos.
          </DialogDescription>
        </DialogHeader>

        <dl className="divide-y divide-hairline border-y border-hairline">
          <Linha rotulo="Campanha">{nomeCampanha}</Linha>
          <Linha rotulo="Template">
            <span className="font-mono">{template.nome}</span>
          </Linha>
          <Linha rotulo="Destinatários">{contatos} contatos</Linha>
          <Linha rotulo="Primeiro disparo">{formatScheduledAt(primeiroDisparoEm)}</Linha>
          <Linha rotulo="Duração estimada">{duracaoEstimada}</Linha>
        </dl>

        <div className="flex gap-3 rounded-md bg-canvas-soft p-4">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden />
          <p className="t-body-sm text-body">
            Cada envio consome um template de marketing na cota da conta. Depois de enfileirada, a
            campanha só é interrompida cancelando os agendamentos ainda pendentes, um a um.
          </p>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="secondary" disabled={enfileirando} />}>
            Voltar
          </DialogClose>
          {/* O CTA de conversão é a pílula preta (branca no escuro). Nunca ouro. */}
          <Button onClick={onConfirmar} disabled={enfileirando}>
            <Send aria-hidden />
            {enfileirando ? 'Enfileirando…' : `Disparar para ${contatos} contatos`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
