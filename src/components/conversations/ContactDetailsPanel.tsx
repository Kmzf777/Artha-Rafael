'use client'

import { useState } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Tag } from '@/components/ui/chip'
import { Input } from '@/components/ui/input'
import { useAgora } from '@/hooks/useAgora'
import { getInitials } from '@/lib/format'
import { ROTULO_SEGMENTO as SEGMENTO } from '@/lib/segmentos'
import type { FunnelStage, Lead, PlanoStatus } from '@/mock/types'
import { formatarTelefone } from './telefone'

const ETAPA: Record<FunnelStage, string> = {
  novo: 'Novo',
  contatado: 'Contatado',
  qualificado: 'Qualificado',
  convertido: 'Convertido',
  perdido: 'Perdido',
}

const PLANO: Record<PlanoStatus, string> = {
  ativo: 'Plano ativo',
  cancelado: 'Plano cancelado',
  trial_expirado: 'Teste expirado',
  inadimplente: 'Inadimplente',
}

const VALOR: Record<string, string> = {
  '97': 'R$ 97 por mês',
  '997': 'R$ 997 por ano',
}

const DIA = 24 * 60 * 60 * 1000

/** "há 214 dias" contra o relógio real — o mesmo que o servidor usa ao recortar. */
function haQuantoTempo(iso: string, agora: Date): string {
  const dias = Math.floor((agora.getTime() - new Date(iso).getTime()) / DIA)
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'ontem'
  if (dias < 30) return `há ${dias} dias`
  const meses = Math.floor(dias / 30)
  return meses === 1 ? 'há 1 mês' : `há ${meses} meses`
}

type Props = {
  lead: Lead | null
  onRenomear: (nome: string) => void
}

export default function ContactDetailsPanel({ lead, onRenomear }: Props) {
  const agora = useAgora()
  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState('')

  if (!lead) {
    return (
      <aside className="hidden h-full w-72 shrink-0 flex-col border-l border-hairline bg-canvas xl:flex">
        <div className="px-5 py-8 t-body-sm text-body">
          Abra uma conversa para ver os dados do contato.
        </div>
      </aside>
    )
  }

  function salvar() {
    const nome = rascunho.trim()
    if (nome) onRenomear(nome)
    setEditando(false)
  }

  return (
    <aside className="scroll-soft hidden h-full w-72 shrink-0 flex-col overflow-y-auto border-l border-hairline bg-canvas xl:flex">
      <div className="flex flex-col items-center gap-3 px-5 pt-8 pb-6 text-center">
        <Avatar size="lg">
          <AvatarFallback>{getInitials(lead.nome, lead.telefone)}</AvatarFallback>
        </Avatar>

        {editando ? (
          <div className="flex w-full items-center gap-2">
            <Input
              value={rascunho}
              onChange={(e) => setRascunho(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') salvar()
                if (e.key === 'Escape') setEditando(false)
              }}
              aria-label="Nome do contato"
              autoFocus
            />
            <Button variant="ghost" size="icon-sm" onClick={salvar} title="Salvar nome">
              <Check aria-hidden />
              <span className="sr-only">Salvar</span>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setEditando(false)}
              title="Cancelar"
            >
              <X aria-hidden />
              <span className="sr-only">Cancelar</span>
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <h2 className="t-display-sm text-ink">{lead.nome}</h2>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setRascunho(lead.nome)
                setEditando(true)
              }}
              title="Renomear contato"
            >
              <Pencil aria-hidden />
              <span className="sr-only">Renomear contato</span>
            </Button>
          </div>
        )}

        <p className="font-mono t-body-sm text-body">{formatarTelefone(lead.telefone)}</p>
        <p className="w-full truncate t-caption text-body">{lead.email}</p>

        <div className="flex flex-wrap justify-center gap-2 pt-1">
          <Tag>{SEGMENTO[lead.segmento]}</Tag>
          <Tag variant="outlined">{ETAPA[lead.stage]}</Tag>
        </div>
      </div>

      <dl className="flex flex-col gap-4 border-t border-hairline px-5 py-6">
        <Linha rotulo="Plano">
          {PLANO[lead.planoStatus]}
          {lead.planoValor !== null && (
            <span className="block t-caption text-body">{VALOR[String(lead.planoValor)]}</span>
          )}
        </Linha>
        <Linha rotulo="Cidade">{lead.cidade}</Linha>
        <Linha rotulo="Último acesso à plataforma">
          {lead.ultimoAcessoEm ? haQuantoTempo(lead.ultimoAcessoEm, agora) : 'Nunca acessou'}
        </Linha>
        <Linha rotulo="Primeiro contato">{haQuantoTempo(lead.primeiroContatoEm, agora)}</Linha>
        <Linha rotulo="Última interação">{haQuantoTempo(lead.ultimaInteracaoEm, agora)}</Linha>
      </dl>

      {lead.tags.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-hairline px-5 py-6">
          <h3 className="t-body-sm-strong text-ink">Marcadores</h3>
          <div className="flex flex-wrap gap-2">
            {lead.tags.map((tag) => (
              <Tag key={tag} variant="outlined">
                {tag}
              </Tag>
            ))}
          </div>
        </div>
      )}

      {lead.notas && (
        <div className="flex flex-col gap-3 border-t border-hairline px-5 py-6">
          <h3 className="t-body-sm-strong text-ink">Notas</h3>
          <p className="t-body-sm text-body">{lead.notas}</p>
        </div>
      )}
    </aside>
  )
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="t-caption text-body">{rotulo}</dt>
      <dd className="t-body-sm text-ink">{children}</dd>
    </div>
  )
}
