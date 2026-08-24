'use client'

// Relatórios — atendimento e qualificação.
//
// REGRA DURA DESTE ARQUIVO: nenhum número é digitado. Tudo sai de `useMetrics()`,
// a mesma agregação derivada que alimenta o Dashboard — assim as duas telas não
// têm como divergir uma da outra.
//
// GRÁFICO: SVG inline, no máximo 3 séries, série primária em `--accent`, rótulo
// direto na série. O funil desta tela tem UMA série, e a trilha atrás dela é
// cromo recessivo — não é uma segunda série, é o papel de uma linha de grade.

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useMetrics } from '@/hooks/useMetrics'
import { ROTULO_SEGMENTO } from '@/lib/segmentos'
import type { Segmento } from '@/mock/types'

const inteiro = new Intl.NumberFormat('pt-BR')
const porcento = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 })
/** Coluna de tabela: casa decimal fixa, senão "36%" e "38,7%" desalinham na pilha. */
const porcentoFixo = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

// ── Geometria ───────────────────────────────────────────────────────────────
// Unidades de usuário do SVG, não pixels de CSS: o `viewBox` escala junto com o
// card. O que está fixo aqui é proporção, não medida de design.

const FUNIL_W = 1000
const FUNIL_LINHA = 64
const FUNIL_BARRA = 20
const FUNIL_X = 208
const FUNIL_TRILHA = 700

const TAXA_TRILHA = 160
const TAXA_BARRA = 8

/** Ponta de dado arredondada em 4px, base reta — a barra cresce de uma linha só. */
function barra(x: number, y: number, w: number, h: number): string {
  const r = Math.max(0, Math.min(4, w / 2, h / 2))
  return `M${x},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h - r}A${r},${r} 0 0 1 ${x + w - r},${y + h}H${x}Z`
}

type Etapa = { rotulo: string; valor: number; nota: string }

/**
 * Funil de leads. Uma série (o volume que sobra em cada etapa) em ouro,
 * sobre a trilha do total de leads — a trilha vazia É quem ainda não chegou
 * naquela etapa. Todo valor tem rótulo direto na ponta da barra: não existe
 * número que só o tooltip conte.
 */
function Funil({ etapas, base }: { etapas: Etapa[]; base: number }) {
  const altura = etapas.length * FUNIL_LINHA

  return (
    <svg
      viewBox={`0 0 ${FUNIL_W} ${altura}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Funil de leads: ${etapas
        .map((e) => `${e.rotulo}, ${inteiro.format(e.valor)}`)
        .join('; ')}.`}
    >
      {etapas.map((etapa, i) => {
        const y = i * FUNIL_LINHA
        const largura = base > 0 ? (FUNIL_TRILHA * etapa.valor) / base : 0
        return (
          <g key={etapa.rotulo}>
            <text x={0} y={y + 28} className="t-body-sm-strong" fill="var(--ink)">
              {etapa.rotulo}
            </text>
            <text x={0} y={y + 46} className="t-caption" fill="var(--body)">
              {etapa.nota}
            </text>
            <path
              d={barra(FUNIL_X, y + 22, FUNIL_TRILHA, FUNIL_BARRA)}
              fill="var(--ink)"
              fillOpacity={0.08}
            />
            <path d={barra(FUNIL_X, y + 22, largura, FUNIL_BARRA)} fill="var(--accent)" />
            <text
              x={FUNIL_X + largura + 12}
              y={y + 37}
              className="t-body-sm-strong tabular"
              fill="var(--ink)"
            >
              {inteiro.format(etapa.valor)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/**
 * Barra da taxa de resposta dentro da linha da tabela. Escala fixa de 0 a 100%
 * — barra de percentual com base truncada mente sobre a diferença entre linhas.
 * `aria-hidden` porque o valor está escrito ao lado: o gráfico nunca é o único
 * portador do número.
 */
function BarraTaxa({ taxa }: { taxa: number }) {
  const largura = TAXA_TRILHA * Math.min(1, Math.max(0, taxa))
  return (
    <svg
      viewBox={`0 0 ${TAXA_TRILHA} ${TAXA_BARRA}`}
      width={TAXA_TRILHA}
      height={TAXA_BARRA}
      className="block shrink-0"
      aria-hidden
      focusable="false"
    >
      <path
        d={barra(0, 0, TAXA_TRILHA, TAXA_BARRA)}
        fill="var(--ink)"
        fillOpacity={0.08}
      />
      <path d={barra(0, 0, largura, TAXA_BARRA)} fill="var(--accent)" />
    </svg>
  )
}

function Tile({ rotulo, valor, nota }: { rotulo: string; valor: string; nota: string }) {
  return (
    <Card tone="soft" className="gap-0 py-5">
      <CardContent>
        <p className="t-body-sm text-body">{rotulo}</p>
        <p className="mt-1 t-display-lg text-ink">{valor}</p>
        <p className="mt-1 t-caption text-body">{nota}</p>
      </CardContent>
    </Card>
  )
}

export default function Reports() {
  const { metrics } = useMetrics()

  const semLeads = metrics.totalLeads === 0

  const etapas: Etapa[] = [
    { rotulo: 'Novos', valor: metrics.porEtapa.novo, nota: 'Ainda sem contato' },
    { rotulo: 'Contatados', valor: metrics.porEtapa.contatado, nota: 'Conversa iniciada' },
    {
      rotulo: 'Qualificados',
      valor: metrics.porEtapa.qualificado,
      nota: 'Produto e momento identificados',
    },
    { rotulo: 'Convertidos', valor: metrics.porEtapa.convertido, nota: 'Assinatura fechada' },
    { rotulo: 'Perdidos', valor: metrics.porEtapa.perdido, nota: 'Sem interesse' },
  ]

  const segmentos = (Object.keys(ROTULO_SEGMENTO) as Segmento[])
    .map((s) => ({
      segmento: s,
      total: metrics.porSegmento[s],
      fatia: metrics.totalLeads > 0 ? metrics.porSegmento[s] / metrics.totalLeads : 0,
    }))
    .sort((a, b) => b.total - a.total)

  return (
    <div className="h-full overflow-y-auto px-8 py-8">
      <header className="reveal-rise">
        <h1 className="t-display-xl text-ink">Relatórios</h1>
        <p className="mt-3 max-w-prose t-body-md text-body">
          Como os leads entram, onde eles param e quanto a operação conversa.
        </p>
      </header>

      <section
        aria-label="Resumo da operação"
        className="reveal-rise mt-8 grid grid-cols-2 gap-4 xl:grid-cols-4"
        style={{ animationDelay: '60ms' }}
      >
        <Tile
          rotulo="Leads na base"
          valor={inteiro.format(metrics.totalLeads)}
          nota="Cadastro completo"
        />
        <Tile
          rotulo="Qualificados"
          valor={inteiro.format(metrics.porEtapa.qualificado)}
          nota={`${porcento.format(
            metrics.totalLeads > 0 ? metrics.porEtapa.qualificado / metrics.totalLeads : 0
          )} da base`}
        />
        <Tile
          rotulo="Conversas"
          valor={inteiro.format(metrics.conversas.total)}
          nota={`${inteiro.format(metrics.conversas.filaAtendimento)} na fila`}
        />
        <Tile
          rotulo="Mensagens"
          valor={inteiro.format(metrics.mensagens.total)}
          nota={`${inteiro.format(metrics.mensagens.recebidas)} recebidas`}
        />
      </section>

      <Card className="reveal-rise mt-6" style={{ animationDelay: '120ms' }}>
        <CardHeader>
          <CardTitle>Funil de leads</CardTitle>
          <CardDescription>
            Onde a base está parada. A trilha clara atrás de cada barra é o total de leads —
            o vazio é quem ainda não chegou naquela etapa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {semLeads ? (
            <p className="py-6 t-body-sm text-mute">
              Nenhum lead cadastrado ainda. O funil aparece assim que a primeira conversa
              chegar.
            </p>
          ) : (
            <Funil etapas={etapas} base={metrics.totalLeads} />
          )}
        </CardContent>
      </Card>

      <Card className="reveal-rise mt-6" style={{ animationDelay: '180ms' }}>
        <CardHeader>
          <CardTitle>Leads por produto</CardTitle>
          <CardDescription>
            A separação que o bot faz na entrada: quem procura a Artha, quem é planejador
            financeiro e quem chegou por outro assunto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {semLeads ? (
            <p className="py-6 t-body-sm text-mute">
              Nenhum lead cadastrado ainda.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead>Fatia da base</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {segmentos.map((linha) => (
                  <TableRow key={linha.segmento}>
                    <TableCell className="t-body-sm-strong">
                      {ROTULO_SEGMENTO[linha.segmento]}
                    </TableCell>
                    <TableCell className="text-right tabular">
                      {inteiro.format(linha.total)}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-3">
                        <BarraTaxa taxa={linha.fatia} />
                        <span className="tabular">{porcentoFixo.format(linha.fatia)}</span>
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Toda a base</TableCell>
                  <TableCell className="text-right tabular">
                    {inteiro.format(metrics.totalLeads)}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-3">
                      <BarraTaxa taxa={1} />
                      <span className="tabular">{porcentoFixo.format(1)}</span>
                    </span>
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
