'use client'

import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, CornerUpLeft, Send } from 'lucide-react'

import PhoneFrame from '@/components/PhoneFrame'
import SendDisparoDialog from '@/components/SendDisparoDialog'
import { Button } from '@/components/ui/button'
import { Chip, Tag } from '@/components/ui/chip'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusLabel } from '@/components/ui/status-label'
import { useAgora } from '@/hooks/useAgora'
import { useEnfileirarCampanha } from '@/hooks/useCampanhas'
import {
  FAIXAS_SEM_ACESSO,
  useReativacaoRecorte,
  type FaixaSemAcesso,
} from '@/hooks/useReativacaoRecorte'
import { useTemplates } from '@/hooks/useTemplates'
import {
  ATRASO_PRIMEIRO_ENVIO_MS,
  MAX_VARIAVEIS,
  SEGUNDOS_ENTRE_ENVIOS,
  descreverVariaveis,
  motivoNaoPreenchivel,
  previaDoCorpo,
  valoresDoLead,
} from '@/lib/disparos'
import { formatScheduledAt } from '@/lib/scheduling'
import { contarVariaveis } from '@/lib/templates'
import { cn } from '@/lib/utils'
import type { Lead, PlanoStatus, Template } from '@/mock/types'

// Disparos — wizard de 3 passos (spec §5). Template → destinatários → confirmação.
// O passo 3 chama `useEnfileirarCampanha`, que cria a campanha e um agendamento
// pendente por lead: a aba Agendamentos é populada de verdade.
//
// Ouro Artha aparece em dois papéis aqui, os dois da lista fechada da spec §3.2:
// chip de filtro selecionado e anel de foco (global). O CTA de disparo é a
// pílula preta — no escuro, branca. Nunca ouro.

const PASSOS = [
  { n: 1, rotulo: 'Template' },
  { n: 2, rotulo: 'Destinatários' },
  { n: 3, rotulo: 'Confirmação' },
] as const

type Passo = (typeof PASSOS)[number]['n']

const CATEGORIA: Record<Template['categoria'], string> = {
  MARKETING: 'Marketing',
  UTILITY: 'Utilidade',
}

const PLANOS: { valor: PlanoStatus | 'todos'; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todas' },
  { valor: 'cancelado', rotulo: 'Cancelado' },
  { valor: 'trial_expirado', rotulo: 'Trial expirado' },
  { valor: 'inadimplente', rotulo: 'Inadimplente' },
]

const PLANO_ROTULO: Record<PlanoStatus, string> = {
  ativo: 'Ativo',
  cancelado: 'Cancelado',
  trial_expirado: 'Trial expirado',
  inadimplente: 'Inadimplente',
}

/** Qual campo do lead preenche cada {{n}}. A ordem vem de `@/lib/disparos`. */
const ORDEM_DAS_VARIAVEIS = descreverVariaveis(MAX_VARIAVEIS)

const HORA_BR = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  minute: '2-digit',
})

function formatarDuracao(segundos: number): string {
  const minutos = Math.max(1, Math.round(segundos / 60))
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`
}

function primeiroNome(nome: string): string {
  return nome.split(' ')[0]
}

function nomePadrao(dias: FaixaSemAcesso, plano: PlanoStatus | 'todos'): string {
  const base = `Sem acesso há ${dias} dias ou mais`
  return plano === 'todos' ? base : `${base} — ${PLANO_ROTULO[plano].toLowerCase()}`
}

// ---------------------------------------------------------------------------
// Indicador de passo — `button-tab-translucent`, raio 36px (`--r-pill-tab`).
// É a única forma fora-do-padrão que o DESIGN.md permite: o toggle de aba não
// usa a pílula de 999px.
// ---------------------------------------------------------------------------

function IndicadorDePasso({
  passo,
  maximo,
  onIr,
}: {
  passo: Passo
  maximo: Passo
  onIr: (destino: Passo) => void
}) {
  return (
    <div
      role="group"
      aria-label="Passos do disparo"
      className="inline-flex items-center gap-1 rounded-pill-tab bg-canvas-soft p-1"
    >
      {PASSOS.map(({ n, rotulo }) => {
        const ativo = n === passo
        const concluido = n < maximo
        return (
          <button
            key={n}
            type="button"
            disabled={n > maximo}
            aria-current={ativo ? 'step' : undefined}
            onClick={() => onIr(n)}
            className={cn(
              'flex h-11 items-center gap-2 rounded-pill-tab px-5 t-body-md-strong transition-colors disabled:pointer-events-none disabled:opacity-40',
              ativo ? 'elev-3 bg-canvas text-ink' : 'text-body hover:text-ink'
            )}
          >
            <span
              aria-hidden
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-full t-caption',
                ativo || concluido ? 'bg-ink text-on-ink' : 'bg-surface-pressed text-body'
              )}
            >
              {concluido ? <Check className="size-3" strokeWidth={3} /> : n}
            </span>
            {rotulo}
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Prévia — bolhas do padrão de Conversas dentro do `PhoneFrame`: recebida em
// `--canvas-soft`, enviada com inversão de polaridade, ambas raio 16px.
// ---------------------------------------------------------------------------

function PreviaNoTelefone({
  template,
  lead,
}: {
  template: Template | null
  lead: Lead | null
}) {
  const nome = lead?.nome ?? 'Contato da base'
  const agora = useAgora()
  const hora = HORA_BR.format(agora)
  // Os mesmos valores que o servidor resolveria para este lead, na mesma ordem
  // de campos: a prévia mostra {{2}} virando cidade em vez de deixar o operador
  // adivinhar.
  const valores = lead ? valoresDoLead(lead, MAX_VARIAVEIS, agora) : [primeiroNome(nome)]
  const corpo = template ? previaDoCorpo(template.corpo, valores) : null
  const resposta = template?.botoes[0] ?? null

  return (
    <aside className="w-80 shrink-0">
      <p className="t-body-sm-strong text-body">Prévia da mensagem</p>

      <div className="mt-3">
        <PhoneFrame contato={nome}>
          {corpo === null || template === null ? (
            <p className="py-8 text-center t-body-sm text-body">
              Escolha um template para ver a mensagem.
            </p>
          ) : (
            <>
              {/* Enviada — inversão de polaridade. */}
              <div className="pl-8">
                <div className="overflow-hidden rounded-xl bg-ink px-4 py-3 text-on-ink">
                  <p className="whitespace-pre-line t-body-sm">{corpo}</p>
                  <p className="mt-1 text-right t-caption text-on-ink opacity-60">{hora}</p>
                  {template.botoes.length > 0 && (
                    <div className="-mx-4 -mb-3 mt-3 border-t border-on-ink/25">
                      {template.botoes.map((botao) => (
                        <span
                          key={botao}
                          className="flex h-11 items-center justify-center gap-2 border-b border-on-ink/25 t-body-sm-strong text-on-ink last:border-b-0"
                        >
                          <CornerUpLeft className="size-3.5 shrink-0" aria-hidden />
                          {botao}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Recebida — o clique no botão volta como mensagem do lead. */}
              {resposta && (
                <div className="pr-8">
                  <div className="inline-block rounded-xl bg-canvas-soft px-4 py-3">
                    <p className="t-body-sm text-ink">{resposta}</p>
                    <p className="mt-1 text-right t-caption text-body">{hora}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </PhoneFrame>
      </div>

      <p className="mt-3 t-caption text-body">
        A segunda bolha é ilustrativa: mostra como o clique em um botão do template volta como
        resposta do lead e abre a janela de 24 horas.
      </p>
    </aside>
  )
}

// ---------------------------------------------------------------------------
// Passo 1 — template
// ---------------------------------------------------------------------------

function CartaoDeTemplate({
  template,
  selecionado,
  onSelecionar,
}: {
  template: Template
  selecionado: boolean
  onSelecionar: () => void
}) {
  // Aprovado pela Meta E dentro do que a tela preenche: {{n}} além dos campos
  // disponíveis viraria erro de parâmetro em cada lead da campanha.
  const impedimento = motivoNaoPreenchivel(contarVariaveis(template.corpo))
  const disponivel = template.status === 'aprovado' && impedimento === null

  return (
    <button
      type="button"
      disabled={!disponivel}
      aria-pressed={selecionado}
      onClick={onSelecionar}
      className={cn(
        'flex h-full flex-col items-start gap-3 rounded-xl border p-6 text-left transition-colors',
        selecionado ? 'border-ink bg-canvas-soft' : 'border-hairline bg-canvas',
        disponivel ? 'hover:bg-canvas-soft' : 'cursor-not-allowed opacity-60'
      )}
    >
      <span className="flex w-full items-start justify-between gap-3">
        <span className="min-w-0 font-mono t-body-sm-strong break-all text-ink">
          {template.nome}
        </span>
        {selecionado && (
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-ink text-on-ink">
            <Check className="size-3" strokeWidth={3} aria-hidden />
          </span>
        )}
      </span>

      <span className="line-clamp-3 t-body-sm text-body">{template.corpo}</span>

      {impedimento !== null && <span className="t-caption text-body">{impedimento}</span>}

      <span className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <Tag variant="outlined">{CATEGORIA[template.categoria]}</Tag>
        <Tag variant="outlined">
          {template.botoes.length} {template.botoes.length === 1 ? 'botão' : 'botões'}
        </Tag>
        {!disponivel && <StatusLabel status="pendente" />}
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Passo 2 — destinatários
// ---------------------------------------------------------------------------

function LinhaDeFiltro({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="t-body-sm-strong text-body">{titulo}</p>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------

export default function Disparos() {
  const { templates } = useTemplates()
  const enfileirar = useEnfileirarCampanha()

  const [passo, setPasso] = useState<Passo>(1)
  const [templateNome, setTemplateNome] = useState<string | null>(null)
  const [dias, setDias] = useState<FaixaSemAcesso>(FAIXAS_SEM_ACESSO[0])
  const [plano, setPlano] = useState<PlanoStatus | 'todos'>('todos')
  const [nomeEditado, setNomeEditado] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)

  const agora = useAgora()
  const baseInativa = useReativacaoRecorte()
  const recorte = useReativacaoRecorte({ diasSemAcesso: dias, planoStatus: plano })

  const template = templates.find((t) => t.nome === templateNome) ?? null
  const nomeCampanha = nomeEditado ?? nomePadrao(dias, plano)
  // Relógio real: o servidor carimba a fila com `new Date()`. Com a âncora do
  // mock, abrir a tela às 18h estimava o primeiro disparo para 12:05 enquanto a
  // fila nascia às 18:05 — a tela mentia sobre quando a mensagem sai.
  const primeiroDisparoEm = new Date(agora.getTime() + ATRASO_PRIMEIRO_ENVIO_MS).toISOString()
  // Duração e habilitação seguem `disparaveis`, não `total`: o recorte conta a
  // base, mas quem entra na fila é só quem o motor de disparo aceita.
  const duracao = formatarDuracao(Math.max(0, recorte.disparaveis - 1) * SEGUNDOS_ENTRE_ENVIOS)
  const resultado = enfileirar.data ?? null

  const maximo: Passo = template === null ? 1 : recorte.disparaveis === 0 ? 2 : 3
  const podeAvancar = passo < maximo

  function recomecar() {
    enfileirar.reset()
    setPasso(1)
    setTemplateNome(null)
    setNomeEditado(null)
  }

  function disparar() {
    if (!template) return
    enfileirar.mutate(
      {
        nome: nomeCampanha,
        template: template.nome,
        segmentoAlvo: 'todos',
        leadIds: recorte.leadIds,
        // Mesmo filtro da linha do `useReativacaoRecorte` acima.
        filtro: { diasSemAcesso: dias, planoStatus: plano },
      },
      { onSuccess: () => setConfirmando(false) }
    )
  }

  return (
    <div className="h-full overflow-y-auto px-8 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="reveal-rise">
          <h1 className="t-display-xl text-ink">Disparos</h1>
          <p className="mt-3 max-w-prose t-body-md text-body">
            Envio de template aprovado para um recorte da base, em três passos.
          </p>
        </header>

        {!resultado && (
          <div className="mt-6">
            <IndicadorDePasso
              passo={passo}
              maximo={maximo}
              onIr={(destino) => setPasso(destino)}
            />
          </div>
        )}

        <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            {resultado ? (
              <section className="reveal-rise rounded-xl bg-canvas-soft p-8">
                <span className="flex size-11 items-center justify-center rounded-full bg-ink text-on-ink">
                  <Check className="size-5" strokeWidth={2.5} aria-hidden />
                </span>
                <h2 className="mt-4 t-display-md text-ink">Campanha enfileirada</h2>
                <p className="mt-2 max-w-prose t-body-md text-body">
                  {resultado.agendamentos.length.toLocaleString('pt-BR')} agendamentos criados para
                  “{resultado.campanha.nome}”. O primeiro sai às{' '}
                  {HORA_BR.format(
                    new Date(resultado.agendamentos[0]?.agendadoPara ?? primeiroDisparoEm)
                  )}
                  ; os seguintes, a cada {SEGUNDOS_ENTRE_ENVIOS} segundos.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button onClick={recomecar}>Novo disparo</Button>
                </div>
              </section>
            ) : (
              <>
                {passo === 1 && (
                  <section className="reveal-rise">
                    <h2 className="t-display-md text-ink">Escolha o template</h2>
                    <p className="mt-2 max-w-prose t-body-md text-body">
                      Só templates aprovados pela Meta podem iniciar conversa fora da janela de 24
                      horas. As variáveis do corpo são preenchidas com dados do lead, nesta ordem:{' '}
                      {ORDEM_DAS_VARIAVEIS}.
                    </p>
                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                      {templates.map((t) => (
                        <CartaoDeTemplate
                          key={t.nome}
                          template={t}
                          selecionado={t.nome === templateNome}
                          onSelecionar={() => setTemplateNome(t.nome)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {passo === 2 && (
                  <section className="reveal-rise space-y-6">
                    <div>
                      <h2 className="t-display-md text-ink">Quem recebe</h2>
                      <p className="mt-2 max-w-prose t-body-md text-body">
                        O recorte parte da base inativa: quem está com a assinatura em dia não entra
                        em campanha de reativação.
                      </p>
                    </div>

                    <LinhaDeFiltro titulo="Dias sem acesso">
                      {FAIXAS_SEM_ACESSO.map((faixa) => (
                        <Chip
                          key={faixa}
                          selected={dias === faixa}
                          onClick={() => {
                            setDias(faixa)
                            setNomeEditado(null)
                          }}
                        >
                          {faixa} dias ou mais
                        </Chip>
                      ))}
                    </LinhaDeFiltro>

                    <LinhaDeFiltro titulo="Situação do plano">
                      {PLANOS.map(({ valor, rotulo }) => (
                        <Chip
                          key={valor}
                          selected={plano === valor}
                          onClick={() => {
                            setPlano(valor)
                            setNomeEditado(null)
                          }}
                        >
                          {rotulo}
                        </Chip>
                      ))}
                    </LinhaDeFiltro>

                    <div className="rounded-xl bg-canvas-soft p-6">
                      <p className="t-body-sm-strong text-body">Contatos no recorte</p>
                      <p className="tabular t-display-lg text-ink">
                        {recorte.total.toLocaleString('pt-BR')}
                      </p>
                      <p className="t-body-sm text-body">
                        de {baseInativa.total.toLocaleString('pt-BR')} inativos na base
                      </p>
                      {recorte.disparaveis < recorte.total && (
                        <p className="mt-2 t-caption text-body">
                          {(recorte.total - recorte.disparaveis).toLocaleString('pt-BR')} são leads
                          de demonstração e não recebem disparo.
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="t-body-sm-strong text-body">
                        Primeiros {recorte.previa.length} do recorte, do mais parado para o menos
                      </p>
                      <div className="mt-3 overflow-hidden rounded-xl border border-hairline">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Contato</TableHead>
                              <TableHead>Telefone</TableHead>
                              <TableHead>Plano</TableHead>
                              <TableHead>Sem acesso</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {recorte.previa.map((lead, i) => (
                              <TableRow key={lead.id}>
                                <TableCell>
                                  <span className="block t-body-sm-strong text-ink">
                                    {lead.nome}
                                  </span>
                                  <span className="block t-caption text-body">{lead.cidade}</span>
                                </TableCell>
                                <TableCell className="font-mono text-body">
                                  {lead.telefone}
                                </TableCell>
                                <TableCell className="text-body">
                                  {PLANO_ROTULO[lead.planoStatus]}
                                </TableCell>
                                <TableCell className="tabular text-body">
                                  {Number.isFinite(recorte.diasDaPrevia[i])
                                    ? `${recorte.diasDaPrevia[i]} dias`
                                    : 'Nunca acessou'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </section>
                )}

                {passo === 3 && template && (
                  <section className="reveal-rise space-y-6">
                    <div>
                      <h2 className="t-display-md text-ink">Confirme o disparo</h2>
                      <p className="mt-2 max-w-prose t-body-md text-body">
                        A campanha nasce zerada e cada destinatário vira um agendamento pendente.
                      </p>
                    </div>

                    <div>
                      <label htmlFor="nome-campanha" className="t-body-sm-strong text-body">
                        Nome da campanha
                      </label>
                      <Input
                        id="nome-campanha"
                        className="mt-2"
                        value={nomeCampanha}
                        onChange={(e) => setNomeEditado(e.target.value)}
                      />
                    </div>

                    <dl className="divide-y divide-hairline rounded-xl bg-canvas-soft px-6">
                      <div className="flex items-baseline justify-between gap-4 py-4">
                        <dt className="t-body-sm text-body">Template</dt>
                        <dd className="font-mono t-body-sm-strong break-all text-ink">
                          {template.nome}
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-4 py-4">
                        <dt className="t-body-sm text-body">Variáveis do corpo</dt>
                        <dd className="t-body-sm-strong text-ink">
                          {descreverVariaveis(contarVariaveis(template.corpo)) || 'Nenhuma'}
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-4 py-4">
                        <dt className="t-body-sm text-body">Recorte</dt>
                        <dd className="t-body-sm-strong text-ink">
                          {dias} dias ou mais sem acesso
                          {plano !== 'todos' && ` · ${PLANO_ROTULO[plano].toLowerCase()}`}
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-4 py-4">
                        <dt className="t-body-sm text-body">Destinatários</dt>
                        <dd className="tabular t-body-sm-strong text-ink">
                          {recorte.disparaveis.toLocaleString('pt-BR')} contatos
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-4 py-4">
                        <dt className="t-body-sm text-body">Primeiro disparo</dt>
                        <dd className="tabular t-body-sm-strong text-ink">
                          {formatScheduledAt(primeiroDisparoEm)}
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-4 py-4">
                        <dt className="t-body-sm text-body">Duração estimada</dt>
                        <dd className="tabular t-body-sm-strong text-ink">{duracao}</dd>
                      </div>
                    </dl>

                    {/* CTA de conversão: pílula preta no claro, branca no escuro. */}
                    <Button onClick={() => setConfirmando(true)} disabled={recorte.disparaveis === 0}>
                      <Send aria-hidden />
                      Revisar e disparar
                    </Button>
                  </section>
                )}

                <div className="mt-8 flex items-center gap-3">
                  <Button
                    variant="subtle"
                    disabled={passo === 1}
                    onClick={() => setPasso((p) => (p === 3 ? 2 : 1))}
                  >
                    <ArrowLeft aria-hidden />
                    Voltar
                  </Button>
                  {passo < 3 && (
                    <Button
                      variant="secondary"
                      disabled={!podeAvancar}
                      onClick={() => setPasso((p) => (p === 1 ? 2 : 3))}
                    >
                      Avançar
                      <ArrowRight aria-hidden />
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>

          <PreviaNoTelefone template={template} lead={recorte.previa[0] ?? null} />
        </div>
      </div>

      {template && (
        <SendDisparoDialog
          open={confirmando}
          onOpenChange={setConfirmando}
          template={template}
          nomeCampanha={nomeCampanha}
          destinatarios={recorte.disparaveis}
          primeiroDisparoEm={primeiroDisparoEm}
          duracaoEstimada={duracao}
          enfileirando={enfileirar.isPending}
          onConfirmar={disparar}
        />
      )}
    </div>
  )
}
