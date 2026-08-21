import { FileText, Image as ImageIcon, MapPin, Mic, Sticker, UserRound, Video } from 'lucide-react'

/**
 * Prévia compacta de uma mensagem — ícone + rótulo curto — para os lugares onde
 * só o metadado aparece: card da lista de conversas e barra de resposta.
 *
 * O tamanho do ícone vem de classe utilitária, não de literal: o sistema não
 * admite número solto de tamanho no JSX (spec §5).
 */
export function MediaLabel({
  type,
  content,
  className = 'inline-flex items-center gap-1.5 align-middle',
}: {
  type: string | null
  content: string | null
  className?: string
}) {
  const legenda = content?.trim() || ''
  const icone = 'size-3.5 shrink-0 opacity-80'

  switch (type) {
    case 'audio':
      return (
        <span className={className}>
          <Mic className={icone} aria-hidden />
          Áudio
        </span>
      )
    case 'image':
    case 'sticker': {
      const Icon = type === 'sticker' ? Sticker : ImageIcon
      return (
        <span className={className}>
          <Icon className={icone} aria-hidden />
          <span className="truncate">{legenda || (type === 'sticker' ? 'Figurinha' : 'Foto')}</span>
        </span>
      )
    }
    case 'document':
      return (
        <span className={className}>
          <FileText className={icone} aria-hidden />
          <span className="truncate">{legenda || 'Documento'}</span>
        </span>
      )
    case 'video':
      return (
        <span className={className}>
          <Video className={icone} aria-hidden />
          <span className="truncate">{legenda || 'Vídeo'}</span>
        </span>
      )
    case 'location':
      return (
        <span className={className}>
          <MapPin className={icone} aria-hidden />
          Localização
        </span>
      )
    case 'contacts':
      return (
        <span className={className}>
          <UserRound className={icone} aria-hidden />
          Contato
        </span>
      )
    default:
      // text, template, button (ou desconhecido) — o próprio conteúdo.
      return <>{legenda || 'Mensagem'}</>
  }
}
