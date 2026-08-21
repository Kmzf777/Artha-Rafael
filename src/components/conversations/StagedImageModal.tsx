'use client'

import { useEffect, useMemo, useState } from 'react'
import { SendHorizontal } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Props = {
  file: File
  sending: boolean
  onCancel: () => void
  onSend: (file: File, caption?: string) => void
}

/**
 * Prévia da imagem com legenda opcional, antes do envio.
 *
 * Vive no `Dialog` do sistema (portal + backdrop + Esc) em vez de um overlay
 * absoluto: o composer é uma faixa de ~100px no rodapé do painel, e um
 * `inset-0` ali cobriria só a faixa.
 */
export default function StagedImageModal({ file, sending, onCancel, onSend }: Props) {
  const [caption, setCaption] = useState('')

  // Derivada do arquivo, não guardada em state: um setState dentro do effect
  // renderizaria duas vezes e ainda mostraria um frame vazio.
  const previewUrl = useMemo(() => URL.createObjectURL(file), [file])

  // A object URL morre junto com o modal — vazá-la seguraria o arquivo inteiro
  // em memória.
  useEffect(() => () => URL.revokeObjectURL(previewUrl), [previewUrl])

  const enviar = () => onSend(file, caption.trim() || undefined)

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar imagem</DialogTitle>
          <DialogDescription>{file.name}</DialogDescription>
        </DialogHeader>

        <div className="flex max-h-80 items-center justify-center overflow-hidden rounded-xl bg-canvas-soft">
          {/* eslint-disable-next-line @next/next/no-img-element -- object URL local, next/image não se aplica */}
          <img src={previewUrl} alt="Prévia da imagem" className="max-h-80 max-w-full object-contain" />
        </div>

        <Input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') enviar()
          }}
          placeholder="Adicionar legenda (opcional)"
          aria-label="Legenda da imagem"
          autoFocus
        />

        <div className="flex justify-end gap-3">
          <Button variant="subtle" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={sending}>
            <SendHorizontal aria-hidden />
            Enviar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
