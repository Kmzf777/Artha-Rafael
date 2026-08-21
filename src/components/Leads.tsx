'use client'

// Leads — spec §5. Tabela `ex-data-table-cell` sobre os 760 registros da base,
// paginada de 25 em 25, com recorte por segmento, etapa e status de plano.
//
// O ouro aparece UMA vez aqui: no chip de filtro selecionado (papel 4 da spec
// §3.2), que já vem de `ui/chip.tsx`. Não há CTA nesta tela, e nenhum número
// desta tela é herói — a contagem do recorte fica em tinta, não em acento.
//
// Estado de plano e etapa são rótulo textual em cinza, nunca matiz (spec §3.5).

import { useState, type ReactNode } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Chip, Tag } from '@/components/ui/chip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAgora } from '@/hooks/useAgora'
import { TAMANHO_PAGINA, useLeads, useMudarEtapaLead } from '@/hooks/useLeads'
import { normalizePhone } from '@/lib/phoneUtils'
import type { FunnelStage, PlanoStatus, Segmento } from '@/mock/types'
import { ROTULO_SEGMENTO } from '@/lib/segmentos'

// ── Vocabulário ────────────────────────────────────────────────────────────
// Segmento é o produto de origem do lead, não persona de atendimento.


const ROTULO_ETAPA: Record<FunnelStage, string> = {
  novo: 'Novo',
  contatado: 'Contatado',
  qualificado: 'Qualificado',
  convertido: 'Convertido',
  perdido: 'Perdido',
}

const ROTULO_PLANO: Record<PlanoStatus, string> = {
  ativo: 'Ativo',
  cancelado: 'Cancelado',
  trial_expirado: 'Trial expirado',
  inadimplente: 'Inadimplente',
}

const SEGMENTOS = Object.keys(ROTULO_SEGMENTO) as Segmento[]
const ETAPAS = Object.keys(ROTULO_ETAPA) as FunnelStage[]
const PLANOS = Object.keys(ROTULO_PLANO) as PlanoStatus[]

// ── Apresentação ───────────────────────────────────────────────────────────

const DIA = 86_400_000

/** `5534991000100` → `(34) 99100-0100`. */
function formatarTelefone(telefone: string): string {
  const digitos = normalizePhone(telefone)
  const nacional = digitos.startsWith('55') ? digitos.slice(2) : digitos
  if (nacional.length === 11) {
    return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 7)}-${nacional.slice(7)}`
  }
  if (nacional.length === 10) {
    return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 6)}-${nacional.slice(6)}`
  }
  return telefone
}

/**
 * `null` é o lead que nunca entrou na plataforma.
 *
 * O "agora" vem de fora, do relógio real: o servidor recorta os inativos contra
 * `new Date()`, e uma âncora fixa aqui erraria um dia na fronteira da régua.
 */
function textoUltimoAcesso(iso: string | null, agora: number): string {
  if (iso === null) return 'Nunca acessou'
  const dias = Math.floor((agora - new Date(iso).getTime()) / DIA)
  if (dias <= 0) return 'Hoje'
  if (dias === 1) return 'Ontem'
  return `Há ${dias} dias`
}

function dataCurta(iso: string): string {
  return format(new Date(iso), 'dd/MM/yy', { locale: ptBR })
}

/** O número vem do dado (97 | 997), nunca digitado na tela. */
function valorDoPlano(valor: number): string {
  return valor >= 997 ? `R$ ${valor}/ano` : `R$ ${valor}/mês`
}

function LinhaDeFiltro({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div
      role="group"
      aria-label={`Filtrar por ${rotulo.toLowerCase()}`}
      className="flex items-center gap-3"
    >
      <span className="w-20 shrink-0 t-caption text-body">{rotulo}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

// ── Tela ───────────────────────────────────────────────────────────────────

export default function Leads() {
  const agora = useAgora().getTime()
  const [segmento, setSegmento] = useState<Segmento | 'todos'>('todos')
  const [etapa, setEtapa] = useState<FunnelStage | 'todos'>('todos')
  const [plano, setPlano] = useState<PlanoStatus | 'todos'>('todos')
  const [busca, setBusca] = useState('')
  const [paginaPedida, setPaginaPedida] = useState(1)

  const { leads, total, totalGeral, pagina, paginas } = useLeads({
    segmento,
    stage: etapa,
    planoStatus: plano,
    busca,
    pagina: paginaPedida,
  })
  const mudarEtapa = useMudarEtapaLead()

  // Todo recorte novo volta para a primeira página: a 12ª página do recorte
  // anterior não quer dizer nada no recorte novo.
  function trocarSegmento(valor: Segmento | 'todos') {
    setSegmento(valor)
    setPaginaPedida(1)
  }
  function trocarEtapa(valor: FunnelStage | 'todos') {
    setEtapa(valor)
    setPaginaPedida(1)
  }
  function trocarPlano(valor: PlanoStatus | 'todos') {
    setPlano(valor)
    setPaginaPedida(1)
  }
  function trocarBusca(valor: string) {
    setBusca(valor)
    setPaginaPedida(1)
  }
  function limparRecorte() {
    setSegmento('todos')
    setEtapa('todos')
    setPlano('todos')
    setBusca('')
    setPaginaPedida(1)
  }

  const temRecorte =
    segmento !== 'todos' || etapa !== 'todos' || plano !== 'todos' || busca.trim() !== ''

  // A página exibida é a que o hook devolveu (já grampeada), não a pedida.
  const primeiro = total === 0 ? 0 : (pagina - 1) * TAMANHO_PAGINA + 1
  const ultimo = Math.min(pagina * TAMANHO_PAGINA, total)

  return (
    <div className="flex h-full flex-col bg-canvas">
      <header className="reveal-rise shrink-0 px-8 pt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="t-display-xl text-ink">Leads</h1>
            <p aria-live="polite" className="mt-2 t-body-sm text-body">
              {temRecorte ? (
                <>
                  <span className="tabular text-ink">{total}</span> de{' '}
                  <span className="tabular">{totalGeral}</span> leads no recorte atual
                </>
              ) : (
                <>
                  <span className="tabular text-ink">{totalGeral}</span> leads na base
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-body"
              />
              <Input
                value={busca}
                onChange={(evento) => trocarBusca(evento.target.value)}
                aria-label="Buscar por nome ou telefone"
                placeholder="Buscar por nome ou telefone"
                className="w-72 pl-11"
              />
            </div>
            {temRecorte && (
              <Button variant="ghost" size="sm" onClick={limparRecorte}>
                <X aria-hidden />
                Limpar filtros
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="shrink-0 space-y-3 border-b border-hairline px-8 pt-6 pb-6">
        <LinhaDeFiltro rotulo="Segmento">
          <Chip selected={segmento === 'todos'} onClick={() => trocarSegmento('todos')}>
            Todos
          </Chip>
          {SEGMENTOS.map((valor) => (
            <Chip
              key={valor}
              selected={segmento === valor}
              onClick={() => trocarSegmento(valor)}
            >
              {ROTULO_SEGMENTO[valor]}
            </Chip>
          ))}
        </LinhaDeFiltro>

        <LinhaDeFiltro rotulo="Etapa">
          <Chip selected={etapa === 'todos'} onClick={() => trocarEtapa('todos')}>
            Todas
          </Chip>
          {ETAPAS.map((valor) => (
            <Chip key={valor} selected={etapa === valor} onClick={() => trocarEtapa(valor)}>
              {ROTULO_ETAPA[valor]}
            </Chip>
          ))}
        </LinhaDeFiltro>

        <LinhaDeFiltro rotulo="Plano">
          <Chip selected={plano === 'todos'} onClick={() => trocarPlano('todos')}>
            Todos
          </Chip>
          {PLANOS.map((valor) => (
            <Chip key={valor} selected={plano === valor} onClick={() => trocarPlano(valor)}>
              {ROTULO_PLANO[valor]}
            </Chip>
          ))}
        </LinhaDeFiltro>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        {total === 0 ? (
          <div className="rounded-xl bg-canvas-soft p-8 text-center">
            <p className="t-body-md text-ink">Nenhum lead neste recorte</p>
            <p className="mx-auto mt-2 max-w-prose t-body-sm text-body">
              A base tem <span className="tabular">{totalGeral}</span> contatos. Ajuste os
              filtros ou refaça a busca por nome ou telefone.
            </p>
            <Button variant="subtle" className="mt-6" onClick={limparRecorte}>
              Limpar filtros
            </Button>
          </div>
        ) : (
          <Table>
            <TableCaption className="sr-only">
              {`Leads da base, ${TAMANHO_PAGINA} por página, ordenados da última interação mais recente para a mais antiga.`}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Último acesso</TableHead>
                <TableHead>Última interação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id} className="group/linha">
                  <TableCell>
                    <span
                      title={lead.nome}
                      className="block max-w-56 truncate t-body-sm-strong text-ink"
                    >
                      {lead.nome}
                    </span>
                  </TableCell>

                  <TableCell className="font-mono tabular text-body">
                    {formatarTelefone(lead.telefone)}
                  </TableCell>

                  <TableCell>
                    {/* A linha inteira acende em `--canvas-soft` no hover; o chip
                        sólido subiria de tom junto e sumiria. */}
                    <Tag className="group-hover/linha:bg-surface-pressed">
                      {ROTULO_SEGMENTO[lead.segmento]}
                    </Tag>
                  </TableCell>

                  {/* A etapa é o único campo editável da linha, então ela própria é o
                      gatilho. `py-0` deixa o alvo de 44px caber inteiro na linha de
                      48px, sem inchar a tabela. */}
                  <TableCell className="py-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label={`Etapa de ${lead.nome}: ${ROTULO_ETAPA[lead.stage]}. Mudar etapa`}
                        className="inline-flex h-11 items-center gap-1.5 rounded-pill px-1 transition-colors hover:bg-surface-pressed data-popup-open:bg-surface-pressed"
                      >
                        <Tag variant="outlined">{ROTULO_ETAPA[lead.stage]}</Tag>
                        <ChevronDown aria-hidden className="size-3.5 text-body" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="min-w-48">
                        <DropdownMenuLabel>Mudar etapa</DropdownMenuLabel>
                        <DropdownMenuRadioGroup
                          value={lead.stage}
                          onValueChange={(valor: FunnelStage) =>
                            mudarEtapa.mutate({ leadId: lead.id, stage: valor })
                          }
                        >
                          {ETAPAS.map((valor) => (
                            <DropdownMenuRadioItem key={valor} value={valor} closeOnClick>
                              {ROTULO_ETAPA[valor]}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>

                  <TableCell>
                    <span className="text-ink">{ROTULO_PLANO[lead.planoStatus]}</span>
                    {lead.planoValor !== null && (
                      <span className="tabular text-body">
                        {' · '}
                        {valorDoPlano(lead.planoValor)}
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="tabular text-body">
                    {textoUltimoAcesso(lead.ultimoAcessoEm, agora)}
                  </TableCell>

                  <TableCell className="tabular text-body">
                    {dataCurta(lead.ultimaInteracaoEm)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {total > 0 && (
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-t border-hairline px-8 py-3">
          <p className="t-body-sm text-body">
            Mostrando{' '}
            <span className="tabular text-ink">
              {primeiro}–{ultimo}
            </span>{' '}
            de <span className="tabular">{total}</span>
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              aria-label="Primeira página"
              disabled={pagina <= 1}
              onClick={() => setPaginaPedida(1)}
            >
              <ChevronsLeft aria-hidden />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Página anterior"
              disabled={pagina <= 1}
              onClick={() => setPaginaPedida(pagina - 1)}
            >
              <ChevronLeft aria-hidden />
            </Button>

            <span className="tabular px-2 t-body-sm-strong text-ink">
              Página {pagina} de {paginas}
            </span>

            <Button
              variant="secondary"
              size="icon"
              aria-label="Próxima página"
              disabled={pagina >= paginas}
              onClick={() => setPaginaPedida(pagina + 1)}
            >
              <ChevronRight aria-hidden />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Última página"
              disabled={pagina >= paginas}
              onClick={() => setPaginaPedida(paginas)}
            >
              <ChevronsRight aria-hidden />
            </Button>
          </div>
        </footer>
      )}
    </div>
  )
}
