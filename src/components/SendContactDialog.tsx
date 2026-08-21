'use client'

import { useState } from 'react'
import { Check, Search, Send } from 'lucide-react'

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
import { Input } from '@/components/ui/input'
import { useLeads } from '@/hooks/useLeads'
import { cn } from '@/lib/utils'
import type { Lead } from '@/mock/types'

// Envio de cartão de contato dentro de uma conversa: busca na base, escolhe um
// contato e manda. Superfície secundária — o mesmo vocabulário do resto do
// sistema (input 8px, linha selecionada por contraste de superfície, CTA em
// pílula preta), sem inventar chrome novo.

export type SendContactDialogProps = {
  open: boolean
  onOpenChange: (aberto: boolean) => void
  onEnviar: (lead: Lead) => void
}

/** "5534991234567" → "(34) 99123-4567". Só apresentação. */
function telefoneCurto(telefone: string): string {
  const nacional = telefone.replace(/^55/, '')
  if (nacional.length < 10) return telefone
  return `(${nacional.slice(0, 2)}) ${nacional.slice(2, -4)}-${nacional.slice(-4)}`
}

function iniciais(nome: string): string {
  return nome
    .split(' ')
    .map((parte) => parte[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export default function SendContactDialog({
  open,
  onOpenChange,
  onEnviar,
}: SendContactDialogProps) {
  const [busca, setBusca] = useState('')
  const [escolhido, setEscolhido] = useState<Lead | null>(null)
  const { leads, total } = useLeads({ busca, pagina: 1 })

  function fechar(aberto: boolean) {
    if (!aberto) {
      setBusca('')
      setEscolhido(null)
    }
    onOpenChange(aberto)
  }

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar contato</DialogTitle>
          <DialogDescription>
            O cartão vai como mensagem na conversa aberta, com nome e telefone do contato.
          </DialogDescription>
        </DialogHeader>

        <div>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-body"
              aria-hidden
            />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou telefone"
              aria-label="Buscar contato"
              className="pl-11"
            />
          </div>

          <p className="mt-2 t-caption text-body">
            {total.toLocaleString('pt-BR')} contatos encontrados
            {total > leads.length && ` · mostrando os ${leads.length} primeiros`}
          </p>

          <div className="scroll-soft mt-3 max-h-72 overflow-y-auto">
            {leads.length === 0 ? (
              <p className="rounded-md bg-canvas-soft p-6 text-center t-body-sm text-body">
                Nenhum contato com esse nome ou telefone.
              </p>
            ) : (
              <ul className="space-y-1">
                {leads.map((lead) => {
                  const selecionado = escolhido?.id === lead.id
                  return (
                    <li key={lead.id}>
                      <button
                        type="button"
                        aria-pressed={selecionado}
                        onClick={() => setEscolhido(lead)}
                        className={cn(
                          'flex h-14 w-full items-center gap-3 rounded-md px-3 text-left transition-colors',
                          selecionado ? 'bg-canvas-soft' : 'hover:bg-canvas-soft'
                        )}
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink t-body-sm-strong text-on-ink">
                          {iniciais(lead.nome)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate t-body-sm-strong text-ink">
                            {lead.nome}
                          </span>
                          <span className="block truncate font-mono t-caption text-body">
                            {telefoneCurto(lead.telefone)} · {lead.cidade}
                          </span>
                        </span>
                        {selecionado && (
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-ink text-on-ink">
                            <Check className="size-3" strokeWidth={3} aria-hidden />
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="secondary" />}>Cancelar</DialogClose>
          {/* Pílula preta no claro, branca no escuro — o CTA nunca é ouro. */}
          <Button
            disabled={escolhido === null}
            onClick={() => {
              if (!escolhido) return
              onEnviar(escolhido)
              fechar(false)
            }}
          >
            <Send aria-hidden />
            Enviar contato
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
