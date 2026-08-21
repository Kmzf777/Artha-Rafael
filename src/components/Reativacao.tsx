'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ListPlus } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Chip, Tag } from '@/components/ui/chip'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import EnqueueReativacaoDialog from '@/components/EnqueueReativacaoDialog'
import {
  DIAS_SEM_ACESSO_INATIVO,
  FAIXAS_SEM_ACESSO,
  TAMANHO_PREVIA,
  useReativacaoRecorte,
  type FaixaSemAcesso,
} from '@/hooks/useReativacaoRecorte'
import { useMetrics } from '@/hooks/useMetrics'
import { useAgora } from '@/hooks/useAgora'
import type { PlanoStatus, Segmento } from '@/mock/types'
import { ROTULO_SEGMENTO } from '@/lib/segmentos'

// A tela que vende o projeto. O produto de entrada da Artha é recuperar a base
// que parou de usar o planejamento — e esta tela é esse produto.
//
// Regra dura: NENHUM número é digitado aqui. O total do recorte vem de
// `useReativacaoRecorte`, que roda a MESMA função `ehInativo` que alimenta o
// Dashboard. Se as duas telas divergirem na frente do cliente, a demo morre.


const ROTULO_PLANO: Record<PlanoStatus, string> = {
  ativo: 'Ativo',
  cancelado: 'Cancelado',
  trial_expirado: 'Trial expirado',
  inadimplente: 'Inadimplente',
}

const PLANOS_INATIVOS: PlanoStatus[] = ['cancelado', 'trial_expirado', 'inadimplente']
const SEGMENTOS: Segmento[] = ['artha', 'dhana', 'lucia']

const numero = new Intl.NumberFormat('pt-BR')
const reais = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})
const multiplo = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/** `55DD9XXXXXXXX` → `(DD) 9XXXX-XXXX`. */
function formatarTelefone(telefone: string): string {
  const nacional = telefone.slice(2)
  return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 7)}-${nacional.slice(7)}`
}

function GrupoDeChips({
  rotulo,
  children,
}: {
  rotulo: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="t-body-sm-strong text-body">{rotulo}</p>
      <div role="group" aria-label={rotulo} className="flex flex-wrap gap-2">
        {children}
      </div>
    </div>
  )
}

export default function Reativacao() {
  const [diasSemAcesso, setDiasSemAcesso] = useState<FaixaSemAcesso>(DIAS_SEM_ACESSO_INATIVO)
  const [planoStatus, setPlanoStatus] = useState<PlanoStatus | 'todos'>('todos')
  const [segmento, setSegmento] = useState<Segmento | 'todos'>('todos')
  const [dialogoAberto, setDialogoAberto] = useState(false)

  const { total, disparaveis, previa, leadIds, diasDaPrevia } = useReativacaoRecorte({
    diasSemAcesso,
    planoStatus,
    segmento,
  })
  const { metrics } = useMetrics()

  // A proporção que justifica o projeto: o que está parado contra o que gira.
  // Com a base vazia os dois são zero, e 0/0 renderiza "NaN%" na tela. A guarda
  // não é defensiva por precaução: banco vazio é o estado inicial real do
  // sistema, antes da importação da base.
  const { mrrAtual, mrrRecuperavel } = metrics.receita
  const mrrTotal = mrrRecuperavel + mrrAtual
  const parteParada = mrrTotal > 0 ? (mrrRecuperavel / mrrTotal) * 100 : 0

  const partesDoRecorte = [`${diasSemAcesso}+ dias sem acesso`]
  if (planoStatus !== 'todos') partesDoRecorte.push(ROTULO_PLANO[planoStatus])
  if (segmento !== 'todos') partesDoRecorte.push(ROTULO_SEGMENTO[segmento])
  const agora = useAgora()
  const resumoDoRecorte = partesDoRecorte.join(' · ')

  // Relógio real: `/api/reativacao` recorta com `new Date()`, e a âncora do
  // mock está congelada na carga da página. Divergir aqui faria a tela carimbar
  // um dia diferente do que o servidor de fato aplicou.
  const dataDaRegua = format(agora, "d 'de' MMMM 'de' yyyy", { locale: ptBR })

  return (
    <div className="h-full overflow-y-auto scroll-soft px-8 py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="reveal-rise">
          <h1 className="t-display-xl text-ink">Reativação</h1>
          <p className="mt-2 max-w-prose t-body-md text-body">
            A base que parou de usar o planejamento, recortada por tempo sem acesso,
            situação do plano e produto. O recorte vira fila de disparo em um clique.
          </p>
        </header>

        {/* O instrumento: o número-herói e a régua que o move, lado a lado. */}
        <Card tone="soft" className="reveal-rise gap-0">
          <CardContent className="grid gap-6 lg:grid-cols-5">
            {/* Painel de leitura sobre `--canvas`: é onde `--accent-text` rende o
                melhor contraste (4,89:1 no claro, 13,1:1 no escuro). */}
            <div className="flex flex-col justify-center gap-1 rounded-xl bg-canvas p-6 lg:col-span-2">
              <p className="t-caption text-body">Pessoas neste recorte</p>
              {/* Papel 3 do Ouro Artha: o número-herói. A `key` faz a contagem
                  re-animar a cada chip — é o momento de demonstração da tela. */}
              <p aria-live="polite" className="t-display-xxl tabular text-accent-text">
                <span key={total} className="reveal-rise inline-block">
                  {numero.format(total)}
                </span>
              </p>
              <p className="t-body-md text-body">
                de{' '}
                <span className="tabular t-body-md-strong text-ink">
                  {numero.format(metrics.inativos)}
                </span>{' '}
                que deixaram de acessar a plataforma
              </p>
              {/* O recorte conta a base; o disparo é outra régua. Numa base de
                  demonstração todo lead é de semente e nenhum recebe mensagem.
                  Dizer isso aqui é o que impede o botão de prometer 612 e o
                  servidor entregar 0 — sem zerar a tela que vende o projeto. */}
              {disparaveis < total && (
                <p className="t-caption text-body">
                  <span className="tabular t-body-sm-strong text-ink">
                    {numero.format(total - disparaveis)}
                  </span>{' '}
                  são leads de demonstração e não recebem disparo.{' '}
                  {disparaveis === 0
                    ? 'Nenhum disparo sai deste recorte.'
                    : `${numero.format(disparaveis)} seguem para a fila.`}
                </p>
              )}
            </div>

            <div className="flex flex-col justify-center gap-4 lg:col-span-3">
              <GrupoDeChips rotulo="Dias sem acesso">
                {FAIXAS_SEM_ACESSO.map((faixa) => (
                  <Chip
                    key={faixa}
                    selected={diasSemAcesso === faixa}
                    onClick={() => setDiasSemAcesso(faixa)}
                  >
                    {faixa}+ dias
                  </Chip>
                ))}
              </GrupoDeChips>

              <GrupoDeChips rotulo="Situação do plano">
                <Chip selected={planoStatus === 'todos'} onClick={() => setPlanoStatus('todos')}>
                  Todas
                </Chip>
                {PLANOS_INATIVOS.map((status) => (
                  <Chip
                    key={status}
                    selected={planoStatus === status}
                    onClick={() => setPlanoStatus(status)}
                  >
                    {ROTULO_PLANO[status]}
                  </Chip>
                ))}
              </GrupoDeChips>

              <GrupoDeChips rotulo="Produto">
                <Chip selected={segmento === 'todos'} onClick={() => setSegmento('todos')}>
                  Todos
                </Chip>
                {SEGMENTOS.map((s) => (
                  <Chip key={s} selected={segmento === s} onClick={() => setSegmento(s)}>
                    {ROTULO_SEGMENTO[s]}
                  </Chip>
                ))}
              </GrupoDeChips>
            </div>
          </CardContent>

          {/* A proporção que dá sentido ao recorte. Monocromática de propósito:
              o ouro é do número-herói e do chip selecionado, de mais ninguém. */}
          <CardContent className="mt-6 border-t border-hairline pt-6">
            <p className="t-body-sm text-body">
              A mensalidade parada nesta base vale{' '}
              <span className="tabular t-body-sm-strong text-ink">
                {multiplo.format(mrrRecuperavel / mrrAtual)}×
              </span>{' '}
              a receita recorrente que a base ativa gera hoje.
            </p>
            <div className="mt-3 flex h-2 w-full overflow-hidden rounded-pill">
              {/* Largura vinda do dado, não de um valor de design. */}
              <div className="bg-ink" style={{ width: `${parteParada}%` }} />
              <div className="bg-body" style={{ width: `${100 - parteParada}%` }} />
            </div>
            <div className="mt-2 flex w-full">
              <div className="pr-6" style={{ width: `${parteParada}%` }}>
                <p className="t-caption text-body">Mensalidade parada</p>
                <p className="tabular t-display-sm text-ink">{reais.format(mrrRecuperavel)}</p>
              </div>
              <div style={{ width: `${100 - parteParada}%` }}>
                <p className="t-caption text-body">Recorrente ativa</p>
                <p className="tabular t-display-sm text-body">{reais.format(mrrAtual)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <section className="reveal-rise">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="t-display-sm text-ink">Prévia do recorte</h2>
            <p className="t-body-sm text-body">
              Do mais parado para o menos — quem nunca chegou a acessar encabeça a
              fila. Até {TAMANHO_PREVIA} linhas. Régua aplicada em {dataDaRegua}.
            </p>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-hairline">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead className="text-right">Sem acesso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previa.map((lead, i) => {
                  const dias = diasDaPrevia[i]
                  return (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <span className="block t-body-sm-strong text-ink">{lead.nome}</span>
                        <span className="block t-caption text-body">{lead.cidade}</span>
                      </TableCell>
                      <TableCell className="font-mono t-body-sm text-body">
                        {formatarTelefone(lead.telefone)}
                      </TableCell>
                      <TableCell>
                        <Tag>{ROTULO_SEGMENTO[lead.segmento]}</Tag>
                      </TableCell>
                      <TableCell>
                        <Tag variant="outlined">{ROTULO_PLANO[lead.planoStatus]}</Tag>
                      </TableCell>
                      <TableCell className="text-right">
                        {/* 24 leads têm `ultimoAcessoEm: null` — o hook devolve
                            Infinity e a linha diz o que isso significa. */}
                        {Number.isFinite(dias) ? (
                          <span className="tabular t-body-sm-strong text-ink">
                            {numero.format(dias)} dias
                          </span>
                        ) : (
                          <Tag variant="outlined">Nunca acessou</Tag>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </section>

        {/* `promo-card-on-dark` — a inversão de polaridade do DESIGN.md, uma vez
            só na tela. O CTA aqui é a pílula invertida, nunca ouro. */}
        <Card tone="dark" className="reveal-rise">
          <CardContent className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex flex-col gap-2">
              <h2 className="t-display-md">
                Enfileirar a campanha para {numero.format(total)}{' '}
                {total === 1 ? 'pessoa' : 'pessoas'}
              </h2>
              <p className="max-w-prose t-body-md opacity-75">
                Um agendamento por pessoa, espaçados em 45 segundos. Nada sai agora:
                a fila aparece em Agendamentos na hora e pode ser cancelada linha a
                linha.
              </p>
            </div>
            <Button
              variant="secondary"
              disabled={total === 0}
              onClick={() => setDialogoAberto(true)}
            >
              <ListPlus aria-hidden />
              Enfileirar campanha
            </Button>
          </CardContent>
        </Card>
      </div>

      <EnqueueReativacaoDialog
        open={dialogoAberto}
        onOpenChange={setDialogoAberto}
        total={total}
        disparaveis={disparaveis}
        leadIds={leadIds}
        segmentoAlvo={segmento}
        // O MESMO filtro que alimentou `useReativacaoRecorte` acima: é isso que
        // garante que a fila tenha exatamente o total que a tela mostrou.
        filtro={{ diasSemAcesso, planoStatus, segmento }}
        resumoDoRecorte={resumoDoRecorte}
        nomeSugerido={`Reativação · ${resumoDoRecorte}`}
      />
    </div>
  )
}
