'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Play } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { StatusLabel } from '@/components/ui/status-label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CHAVE_AGENDAMENTOS, podeCancelar, useAgendamentos } from '@/hooks/useAgendamentos'
import { CHAVE_METRICS } from '@/hooks/useMetrics'
import { useAgora } from '@/hooks/useAgora'
import { api } from '@/lib/api'
import { formatScheduledAt } from '@/lib/scheduling'
import type { AgendamentoStatus } from '@/mock/types'
// Só o tipo: `@/server/fila` é `server-only` e `import type` é apagado na
// compilação, então nada do worker entra no bundle do browser.
import type { ResultadoFila } from '@/server/fila'

// Agendamentos — a fila de disparos programados (spec §5). Tabela mais resumo,
// estado pelo `status-label` (cinza + ícone + rótulo, nunca cor) e cancelamento
// restrito a `pendente`: em `enviando` o POST já saiu e cancelar seria mentira.
//
// O "agora" vem de `useAgora()` e tica: "em 12 min" contra um relógio parado no
// load da página vira contagem regressiva que não regride.
//
// "Processar fila agora" é o gatilho manual do worker. Em produção quem drena a
// fila é o cron de `vercel.json`; em desenvolvimento não há cron nenhum, e sem
// este botão uma campanha enfileirada nunca sairia da tela.

type Filtro = AgendamentoStatus | 'todos'

const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'pendente', rotulo: 'Pendentes' },
  { valor: 'enviando', rotulo: 'Enviando' },
  { valor: 'enviado', rotulo: 'Enviados' },
  { valor: 'falhou', rotulo: 'Falhas' },
  { valor: 'cancelado', rotulo: 'Cancelados' },
]

const HORA_BR = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  minute: '2-digit',
})

/** "5534991234567" → "(34) 99123-4567". O DDI fica implícito na operação. */
function telefoneCurto(telefone: string): string {
  const nacional = telefone.replace(/^55/, '')
  if (nacional.length < 10) return telefone
  return `(${nacional.slice(0, 2)}) ${nacional.slice(2, -4)}-${nacional.slice(-4)}`
}

function distanciaAte(iso: string, agora: Date): string {
  const minutos = Math.round((new Date(iso).getTime() - agora.getTime()) / 60_000)
  if (minutos <= 0) return 'saindo agora'
  if (minutos < 60) return `em ${minutos} min`
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return resto === 0 ? `em ${horas} h` : `em ${horas} h ${resto} min`
}

function Estatistica({
  rotulo,
  valor,
  nota,
}: {
  rotulo: string
  valor: string
  nota: string
}) {
  return (
    <div>
      <p className="t-body-sm-strong text-body">{rotulo}</p>
      <p className="tabular t-display-lg text-ink">{valor}</p>
      <p className="t-body-sm text-body">{nota}</p>
    </div>
  )
}

/** Uma campanha enfileirada na aba Disparos pode somar centenas de linhas. */
const LOTE = 100

/** O que o ciclo fez, em uma frase. Usa os campos nomeados do worker — traduzir
 *  "teto_diario" para "nada saiu" esconderia do operador por que nada saiu. */
function resumoDoCiclo(r: ResultadoFila): string {
  if (r.motivo === 'teto_diario') {
    return `Teto diário atingido: ${r.jaIniciadas} de ${r.teto} conversas iniciadas nas últimas 24 h.`
  }
  if (r.motivo === 'teto_da_meta') {
    return `A Meta travou o disparo (código ${r.codigo}). ${r.devolvidos} voltaram para a fila em 1 h.`
  }
  if (r.reservados === 0) return 'Nenhum agendamento vencido para agora.'
  const falhas = `${r.falhas} ${r.falhas === 1 ? 'falha' : 'falhas'}`
  return `${falhas} no lote de ${r.reservados}.`
}

export default function Agendamentos() {
  const agora = useAgora()
  const { agendamentos, resumo, cancelar, cancelando } = useAgendamentos()
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [limite, setLimite] = useState(LOTE)

  const queryClient = useQueryClient()
  const processar = useMutation({
    mutationFn: () => api<ResultadoFila>('/api/fila/disparar-agora', { method: 'POST' }),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: CHAVE_AGENDAMENTOS })
      void queryClient.invalidateQueries({ queryKey: CHAVE_METRICS })
      toast.success(
        r.enviados === 1 ? '1 disparo enviado' : `${r.enviados} disparos enviados`,
        { description: resumoDoCiclo(r) }
      )
    },
    onError: (erro: Error) => {
      toast.error('Não foi possível processar a fila', { description: erro.message })
    },
  })

  const visiveis = filtro === 'todos' ? agendamentos : agendamentos.filter((a) => a.status === filtro)
  const mostrados = visiveis.slice(0, limite)
  // A lista já vem ordenada com a fila real primeiro: o próximo pendente é o
  // primeiro que aparece.
  const proximo = agendamentos.find((a) => a.status === 'pendente') ?? null
  const naFila = resumo.pendente + resumo.enviando

  return (
    <div className="h-full overflow-y-auto px-8 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="reveal-rise flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="t-display-xl text-ink">Agendamentos</h1>
            <p className="mt-3 max-w-prose t-body-md text-body">
              Fila de disparos programados, com o estado de cada envio. Só o que ainda está pendente
              pode ser cancelado. O worker drena um lote de 20 a cada dez minutos.
            </p>
          </div>
          {/* Manda mensagem de verdade. Pílula branca, não a preta de conversão:
              o alvo desta tela é acompanhar a fila, não empurrar o disparo. */}
          <Button
            variant="secondary"
            disabled={processar.isPending}
            onClick={() => processar.mutate()}
          >
            <Play aria-hidden />
            {processar.isPending ? 'Processando…' : 'Processar fila agora'}
          </Button>
        </header>

        <section className="reveal-rise mt-6 grid gap-6 rounded-xl bg-canvas-soft p-6 sm:grid-cols-2 lg:grid-cols-4">
          <Estatistica
            rotulo="Na fila agora"
            valor={naFila.toLocaleString('pt-BR')}
            nota={`${resumo.enviando} em envio · ${resumo.pendente} aguardando`}
          />
          <Estatistica
            rotulo="Próximo disparo"
            valor={proximo ? HORA_BR.format(new Date(proximo.agendadoPara)) : '—'}
            nota={proximo ? distanciaAte(proximo.agendadoPara, agora) : 'Nenhum envio pendente'}
          />
          <Estatistica
            rotulo="Já enviados"
            valor={resumo.enviado.toLocaleString('pt-BR')}
            nota={`de ${resumo.total.toLocaleString('pt-BR')} agendamentos`}
          />
          <Estatistica
            rotulo="Falhas"
            valor={resumo.falhou.toLocaleString('pt-BR')}
            nota={`${resumo.cancelado} cancelados antes de sair`}
          />
        </section>

        <div className="mt-6 flex flex-wrap gap-2">
          {FILTROS.map(({ valor, rotulo }) => (
            <Chip
              key={valor}
              selected={filtro === valor}
              onClick={() => {
                setFiltro(valor)
                setLimite(LOTE)
              }}
            >
              {rotulo}
              {/* Sem classe de cor: a contagem herda a do chip, inclusive o
                  `--accent-text` do estado selecionado. */}
              <span className="tabular">{valor === 'todos' ? resumo.total : resumo[valor]}</span>
            </Chip>
          ))}
        </div>

        {visiveis.length === 0 ? (
          <p className="mt-6 rounded-xl bg-canvas-soft p-8 text-center t-body-md text-body">
            Nenhum agendamento nesta situação.
          </p>
        ) : (
          <div className="mt-6 overflow-hidden rounded-xl border border-hairline">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Destinatário</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Agendado para</TableHead>
                  <TableHead>Tentativas</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mostrados.map((agendamento) => (
                  <TableRow key={agendamento.id}>
                    <TableCell>
                      <span className="block t-body-sm-strong text-ink">
                        {agendamento.lead?.nome ?? 'Contato removido'}
                      </span>
                      <span className="block font-mono t-caption text-body">
                        {agendamento.lead ? telefoneCurto(agendamento.lead.telefone) : agendamento.leadId}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-body">{agendamento.template}</TableCell>
                    <TableCell className="font-mono text-body">
                      {formatScheduledAt(agendamento.agendadoPara)}
                    </TableCell>
                    <TableCell className="tabular text-body">{agendamento.tentativas}</TableCell>
                    <TableCell className="whitespace-normal">
                      <StatusLabel status={agendamento.status} />
                      {agendamento.erro && (
                        <span className="mt-1 block max-w-64 t-caption text-body">
                          {agendamento.erro}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {podeCancelar(agendamento) && (
                        <Button
                          variant="subtle"
                          size="sm"
                          disabled={cancelando}
                          onClick={() => cancelar(agendamento.id)}
                        >
                          Cancelar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {visiveis.length > mostrados.length && (
          <div className="mt-4 flex items-center gap-4">
            <Button variant="subtle" onClick={() => setLimite((n) => n + LOTE)}>
              Mostrar mais {LOTE}
            </Button>
            <p className="t-body-sm text-body">
              {mostrados.length.toLocaleString('pt-BR')} de{' '}
              {visiveis.length.toLocaleString('pt-BR')} agendamentos
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
