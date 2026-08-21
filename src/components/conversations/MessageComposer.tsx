'use client'

import { useEffect, useRef, useState } from 'react'
import { CornerUpLeft, Paperclip, SendHorizontal, TimerOff, TriangleAlert, X, Zap } from 'lucide-react'
import { MediaLabel } from '@/components/MediaLabel'
import QuickRepliesManager from '@/components/QuickRepliesManager'
import StagedImageModal from '@/components/conversations/StagedImageModal'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import type { Conversation, Message } from '@/lib/conversationTypes'
import { applyLeadVariables, filterQuickReplies, parseSlashCommand } from '@/lib/quickReplies'
import type { QuickReply } from '@/mock/types'

type Props = {
  conversa: Conversation
  respostas: QuickReply[]
  /** Fora da janela de 24h só template sai — o texto livre falharia na Meta. */
  janelaAberta: boolean
  enviando: boolean
  erro: string | null
  onLimparErro: () => void
  respondendoA: Message | null
  onCancelarResposta: () => void
  onEnviarTexto: (texto: string, respondendoA: Message | null) => void
  onEnviarMidia: (arquivo: File, notaDeVoz?: boolean, legenda?: string) => void
}

/** Quantos atalhos cabem na linha de chips sem virar parede de pílula. */
const CHIPS_VISIVEIS = 4

export default function MessageComposer({
  conversa,
  respostas,
  janelaAberta,
  enviando,
  erro,
  onLimparErro,
  respondendoA,
  onCancelarResposta,
  onEnviarTexto,
  onEnviarMidia,
}: Props) {
  const [texto, setTexto] = useState('')
  const [catalogoAberto, setCatalogoAberto] = useState(false)
  const [imagemEmEspera, setImagemEmEspera] = useState<File | null>(null)
  const campo = useRef<HTMLTextAreaElement>(null)
  const seletorArquivo = useRef<HTMLInputElement>(null)

  // Cresce com o conteúdo até o teto do CSS (`max-h-40`), depois rola.
  useEffect(() => {
    const el = campo.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [texto])

  const comando = parseSlashCommand(texto)
  const sugestoes = comando === null ? [] : filterQuickReplies(respostas, comando)

  function inserir(mensagem: string) {
    setTexto(applyLeadVariables(mensagem, { contact_name: conversa.contact_name }))
    campo.current?.focus()
  }

  function enviar() {
    const limpo = texto.trim()
    if (!limpo || enviando || !janelaAberta) return
    onEnviarTexto(limpo, respondendoA)
    setTexto('')
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape' && respondendoA) {
      onCancelarResposta()
      return
    }
    if (e.key !== 'Enter' || e.shiftKey) return
    e.preventDefault()
    // Com o menu de atalhos aberto, Enter escolhe a primeira sugestão.
    if (sugestoes.length > 0) inserir(sugestoes[0].message)
    else enviar()
  }

  function aoEscolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    e.target.value = ''
    if (!arquivo) return
    if (arquivo.type.startsWith('image/')) setImagemEmEspera(arquivo)
    else onEnviarMidia(arquivo)
  }

  return (
    <div className="relative shrink-0 border-t border-hairline bg-canvas px-6 py-4">
      {imagemEmEspera && (
        <StagedImageModal
          file={imagemEmEspera}
          sending={enviando}
          onCancel={() => setImagemEmEspera(null)}
          onSend={(arquivo, legenda) => {
            onEnviarMidia(arquivo, false, legenda)
            setImagemEmEspera(null)
          }}
        />
      )}

      <div className="mx-auto flex max-w-4xl flex-col gap-3">
        {erro && (
          <Alert>
            <TriangleAlert aria-hidden />
            <AlertDescription>{erro}</AlertDescription>
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-1 right-2"
              onClick={onLimparErro}
            >
              <X aria-hidden />
              <span className="sr-only">Dispensar aviso</span>
            </Button>
          </Alert>
        )}

        {!janelaAberta ? (
          <Alert>
            <TimerOff aria-hidden />
            <AlertDescription>
              Janela de 24h fechada. Texto livre não sai para este contato — o próximo contato
              precisa ser um template aprovado, pela tela de Disparos.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {respondendoA && (
              <div className="flex items-center gap-2 rounded-md bg-canvas-soft px-3 py-2">
                <CornerUpLeft className="size-4 shrink-0 text-body" aria-hidden />
                <span className="min-w-0 flex-1 truncate t-body-sm text-body">
                  <MediaLabel type={respondendoA.message_type} content={respondendoA.content} />
                </span>
                <Button variant="ghost" size="icon-sm" onClick={onCancelarResposta}>
                  <X aria-hidden />
                  <span className="sr-only">Cancelar resposta</span>
                </Button>
              </div>
            )}

            <div className="scroll-soft flex items-center gap-2 overflow-x-auto pb-1">
              {respostas.slice(0, CHIPS_VISIVEIS).map((resposta) => (
                <Chip key={resposta.id} onClick={() => inserir(resposta.message)}>
                  <Zap aria-hidden />
                  <span className="font-mono">/{resposta.shortcut}</span>
                </Chip>
              ))}
              <Chip onClick={() => setCatalogoAberto(true)}>Todas as respostas</Chip>
            </div>

            <div className="relative flex items-end gap-2">
              {sugestoes.length > 0 && (
                <ul className="elev-2 absolute bottom-full left-0 z-10 mb-2 flex max-h-64 w-full max-w-md flex-col gap-1 overflow-y-auto rounded-xl bg-canvas p-1.5">
                  {sugestoes.map((resposta) => (
                    <li key={resposta.id}>
                      <button
                        type="button"
                        onClick={() => inserir(resposta.message)}
                        className="flex w-full flex-col gap-1 rounded-md px-3 py-2 text-left transition-colors hover:bg-canvas-soft"
                      >
                        <span className="font-mono t-body-sm-strong text-ink">
                          /{resposta.shortcut}
                        </span>
                        <span className="line-clamp-1 t-body-sm text-body">{resposta.message}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <input
                ref={seletorArquivo}
                type="file"
                className="hidden"
                onChange={aoEscolherArquivo}
                accept="image/*,audio/*,application/pdf"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => seletorArquivo.current?.click()}
                title="Anexar imagem, áudio ou documento"
              >
                <Paperclip aria-hidden />
                <span className="sr-only">Anexar arquivo</span>
              </Button>

              <textarea
                ref={campo}
                rows={1}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={aoTeclar}
                placeholder="Escreva uma mensagem ou digite / para os atalhos"
                aria-label="Mensagem"
                className="scroll-soft max-h-40 min-h-11 flex-1 resize-none rounded-md bg-canvas-soft px-4 py-3 t-body-md text-ink placeholder:text-mute"
              />

              <Button onClick={enviar} disabled={enviando || texto.trim().length === 0}>
                <SendHorizontal aria-hidden />
                Enviar
              </Button>
            </div>
          </>
        )}
      </div>

      <QuickRepliesManager
        respostas={respostas}
        aberto={catalogoAberto}
        onAbertoChange={setCatalogoAberto}
        onEscolher={inserir}
      />
    </div>
  )
}
