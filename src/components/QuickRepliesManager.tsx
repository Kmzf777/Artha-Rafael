'use client'

import { useState } from 'react'
import { Search, Zap } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { filterQuickReplies } from '@/lib/quickReplies'
import type { QuickReply } from '@/mock/types'

type Props = {
  respostas: QuickReply[]
  aberto: boolean
  onAbertoChange: (aberto: boolean) => void
  /** Insere o texto no composer — quem envia é sempre a operadora. */
  onEscolher: (mensagem: string) => void
}

/**
 * Catálogo de respostas rápidas.
 *
 * É consulta e inserção, não CRUD: o store da demo expõe as respostas em
 * leitura (`listarQuickReplies`) e não tem mutação para elas. Criar edição só
 * na tela produziria um dado que não existe na fonte única — pior do que a
 * ausência da função.
 */
export default function QuickRepliesManager({
  respostas,
  aberto,
  onAbertoChange,
  onEscolher,
}: Props) {
  const [busca, setBusca] = useState('')
  const filtradas = filterQuickReplies(respostas, busca)

  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Respostas rápidas</DialogTitle>
          <DialogDescription>
            Digite <span className="font-mono">/</span> no campo de mensagem para chamar uma
            resposta pelo atalho. <span className="font-mono">{'{nome}'}</span> é trocado pelo nome
            do contato no envio.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-body"
            aria-hidden
          />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por atalho"
            aria-label="Buscar resposta rápida"
            className="pl-11"
          />
        </div>

        <ul className="scroll-soft flex max-h-96 flex-col gap-1 overflow-y-auto">
          {filtradas.length === 0 && (
            <li className="px-2 py-6 text-center t-body-sm text-body">
              Nenhuma resposta com esse atalho.
            </li>
          )}
          {filtradas.map((resposta) => (
            <li key={resposta.id}>
              <button
                type="button"
                onClick={() => {
                  onEscolher(resposta.message)
                  onAbertoChange(false)
                }}
                className="flex w-full flex-col gap-1 rounded-md px-3 py-3 text-left transition-colors hover:bg-canvas-soft"
              >
                <span className="inline-flex items-center gap-2 t-body-sm-strong text-ink">
                  <Zap className="size-3.5 shrink-0 text-body" aria-hidden />
                  <span className="font-mono">/{resposta.shortcut}</span>
                </span>
                <span className="line-clamp-2 t-body-sm text-body">{resposta.message}</span>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
