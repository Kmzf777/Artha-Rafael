'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { MessageSquare } from 'lucide-react'
import ChatHeader from '@/components/conversations/ChatHeader'
import ContactDetailsPanel from '@/components/conversations/ContactDetailsPanel'
import ConversationList from '@/components/conversations/ConversationList'
import MessageComposer from '@/components/conversations/MessageComposer'
import MessageTimeline from '@/components/conversations/MessageTimeline'
import { useAgora } from '@/hooks/useAgora'
import { useBuscaConversas, useContactLead, useQuickReplies } from '@/hooks/useConversationData'
import { useConversationMessages } from '@/hooks/useConversationMessages'
import { useAtualizarNomeNoCache, useConversations, useMarcarLida } from '@/hooks/useConversations'
import { useMessageSender } from '@/hooks/useMessageSender'
import { useTemplates } from '@/hooks/useTemplates'
import type { Conversation, Message } from '@/lib/conversationTypes'
import { getWindowStatus } from '@/lib/janela24h'

// `onUpdateUnread` é contrato de fronteira com `page.tsx`: alimenta o contador
// de não lidas da Sidebar. O nome e a forma não podem mudar.
type ConversationsProps = { onUpdateUnread?: (counts: Record<string, number>) => void }

/**
 * Conversas — três colunas: lista / thread / detalhes do contato (spec §5).
 *
 * A tela é só orquestração: quem sabe filtrar, agrupar por data, medir a janela
 * de 24h e recortar trecho de busca são os módulos puros de `src/lib`, que já
 * existiam testados. Aqui só se liga hook a coluna.
 */
export default function Conversations({ onUpdateUnread }: ConversationsProps) {
  const agora = useAgora()
  const { conversas, naoLidas, carregando } = useConversations()
  const { mutate: marcarLida } = useMarcarLida()
  const atualizarNomeNoCache = useAtualizarNomeNoCache()
  const respostas = useQuickReplies()
  const { templates } = useTemplates()

  const [selecionada, setSelecionada] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [respondendoA, setRespondendoA] = useState<Message | null>(null)
  const [detalhesAbertos, setDetalhesAbertos] = useState(true)

  const { resultados, buscando } = useBuscaConversas(busca)

  // A conversa mais recente já vem aberta — um painel de atendimento vazio no
  // primeiro frame não diz nada sobre o produto. É DERIVADO, não estado: abrir
  // por efeito seria uma renderização em cascata.
  const chaveAtiva = selecionada ?? conversas[0]?.key ?? null

  const conv = useMemo(
    () => conversas.find((c) => c.key === chaveAtiva) ?? null,
    [conversas, chaveAtiva]
  )

  const {
    mensagens,
    carregando: carregandoMensagens,
    acrescentar,
    statusDe,
    renomearContato,
  } = useConversationMessages(conv)
  const { sending, sendError, setSendError, enviarTexto, enviarMidia } = useMessageSender({
    conv,
    acrescentar,
  })
  const lead = useContactLead(conv)

  // Contrato de fronteira: a Sidebar soma este mapa no badge da aba.
  useEffect(() => {
    onUpdateUnread?.(naoLidas)
  }, [naoLidas, onUpdateUnread])

  // Abrir a conversa NÃO marca como lida (2026-10-16). A não lida só some
  // quando alguém da equipe responde (a rota de envio grava a leitura) ou pelo
  // "Marcar como lida" do botão direito no card.
  const selecionar = useCallback(
    (conversa: Conversation) => {
      if (conversa.key === selecionada) return
      setSelecionada(conversa.key)
      setRespondendoA(null)
    },
    [selecionada]
  )

  const marcarComoLida = useCallback(
    (conversa: Conversation) =>
      // `new Date()` e não o tique: isto é manipulador de evento, não render.
      // Quem decide de fato é o servidor — a rota ignora este valor.
      marcarLida({ key: conversa.key, lidoEm: new Date().toISOString() }),
    [marcarLida]
  )

  // Como abrir não zera mais a contagem, o divisor segue a contagem viva do
  // card aberto: some quando a equipe responde ou marca como lida.
  const pendentesNaThread = chaveAtiva ? naoLidas[chaveAtiva] ?? 0 : 0

  // Relógio que tica, nunca uma âncora fixa: é esta linha que decide se o
  // composer aceita texto livre. Com o relógio parado, uma aba deixada aberta
  // mostraria janela aberta e contador falso, e o envio só falharia com 409 na
  // Meta, depois do operador já ter digitado a resposta.
  const janela = useMemo(() => getWindowStatus(mensagens, agora), [mensagens, agora])

  function aoRenomear(nome: string) {
    if (!conv) return
    atualizarNomeNoCache({ bsuid: conv.bsuid, phone: conv.phone }, nome)
    renomearContato(nome)
  }

  return (
    <div className="flex h-full overflow-hidden bg-canvas">
      <ConversationList
        conversas={conversas}
        naoLidas={naoLidas}
        selecionada={chaveAtiva}
        onSelecionar={selecionar}
        onMarcarLida={marcarComoLida}
        busca={busca}
        onBuscaChange={setBusca}
        resultados={resultados}
        buscando={buscando}
        carregando={carregando}
      />

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-canvas">
        {conv ? (
          <div key={conv.key} className="reveal-rise flex min-h-0 flex-1 flex-col">
            <ChatHeader
              nome={conv.contact_name}
              telefone={conv.phone}
              windowStatus={janela}
              janelaDesconhecida={carregandoMensagens}
              detalhesAbertos={detalhesAbertos}
              onAlternarDetalhes={() => setDetalhesAbertos((v) => !v)}
            />

            <MessageTimeline
              conversaKey={conv.key}
              mensagens={mensagens}
              statusDe={statusDe}
              naoLidasAoAbrir={pendentesNaThread}
              templates={templates}
              carregando={carregandoMensagens}
              onResponder={setRespondendoA}
            />

            <MessageComposer
              conversa={conv}
              respostas={respostas}
              janelaAberta={janela.isOpen}
              enviando={sending}
              erro={sendError}
              onLimparErro={() => setSendError(null)}
              respondendoA={respondendoA}
              onCancelarResposta={() => setRespondendoA(null)}
              onEnviarTexto={(texto, citada) => {
                // `enviarTexto` só usa o id da citada; o status vem do mapa da
                // thread porque a forma de fio agrupada não o carrega.
                void enviarTexto(
                  texto,
                  citada ? { ...citada, status: statusDe(citada.id) } : null
                )
                setRespondendoA(null)
              }}
              onEnviarMidia={(arquivo, notaDeVoz, legenda) => {
                void enviarMidia(arquivo, notaDeVoz, legenda)
              }}
            />
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <MessageSquare className="size-8 text-body" aria-hidden />
            <p className="t-body-lg text-ink">Escolha uma conversa</p>
            <p className="max-w-prose t-body-sm text-body">
              As conversas da esquerda vêm do número oficial da Artha, ordenadas pela mensagem mais
              recente.
            </p>
          </div>
        )}
      </section>

      {detalhesAbertos && <ContactDetailsPanel lead={lead} onRenomear={aoRenomear} />}
    </div>
  )
}
