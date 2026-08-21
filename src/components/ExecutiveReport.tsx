'use client'

// Painel executivo — a tela que conta a história do negócio (spec §5).
//
// REGRA DURA DESTE ARQUIVO: nenhum número é digitado. Tudo sai de `useMetrics()`,
// inclusive a série de 8 meses, os totais dos tiles e o texto das legendas. O
// último ponto da série e o tile de inativos são o MESMO número porque saem da
// mesma função — divergir entre telas é o defeito mais grave da demo (spec §4.3).
//
// GRAMÁTICA DE COR DESTA TELA: o Ouro Artha significa sempre "inativo /
// recuperável" — a linha de inativos, a fatia de churn, o MRR recuperável. O
// preto é a base ativa. Duas séries por gráfico, no máximo três; nenhuma
// distinção por matiz (spec §5).
//
// ARMADILHA REGISTRADA: `Card tone="dark"` é INVERSÃO DE POLARIDADE, não uma
// superfície escura — no tema escuro `--ink` vale branco e a banda fica branca.
// O ouro dá 2,08:1 sobre branco. Por isso a banda não usa acento nenhum: o
// número-herói dela é `--on-ink`, que dá 21:1 nos dois temas.

import { ChevronRight } from 'lucide-react'

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
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useMetrics, type Metrics } from '@/hooks/useMetrics'
import { PUBLICO_SEGMENTO, ROTULO_SEGMENTO, SEGMENTOS } from '@/lib/segmentos'
import type { Segmento } from '@/mock/types'

const inteiro = new Intl.NumberFormat('pt-BR')
const porcento = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 })
const moeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})
const vezes = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

/**
 * Os três produtos. O terceiro é nomeado pelo público que atende: há três nomes
 * de persona em circulação e a escolha é do cliente (spec §1), então nenhuma
 * tela os estampa.
 */
const PRODUTOS: { chave: Segmento; nome: string; publico: string }[] = SEGMENTOS.map(
  (chave) => ({ chave, nome: ROTULO_SEGMENTO[chave], publico: PUBLICO_SEGMENTO[chave] })
)

// ── Geometria ───────────────────────────────────────────────────────────────
// Unidades de usuário do SVG, não pixels de CSS: o `viewBox` escala junto com o
// card. O que está fixo aqui é proporção, não medida de design.

const SERIE_W = 1000
const SERIE_H = 300
const SERIE_ESQ = 56
const SERIE_DIR = 868
const SERIE_TOPO = 16
const SERIE_BASE = 260

const DIST_W = 960
const DIST_H = 108
const DIST_X0 = 20
const DIST_X1 = 940
const DIST_BARRA_Y = 62
const DIST_BARRA_H = 44

const CHURN_W = 900
const CHURN_LINHA = 68
const CHURN_TOPO = 24
const CHURN_X = 176
const CHURN_TRILHA = 640
const CHURN_BARRA = 18

/** Vão de 2px em cor de superfície entre preenchimentos que se tocam. */
const VAO = 2

/** Ponta de dado arredondada em 4px, base reta — a barra cresce de uma linha só. */
function barra(x: number, y: number, w: number, h: number): string {
  const r = Math.max(0, Math.min(4, w / 2, h / 2))
  return `M${x},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h - r}A${r},${r} 0 0 1 ${x + w - r},${y + h}H${x}Z`
}

const PASSOS = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000]

/** Topo do eixo em número redondo, com no máximo quatro faixas de grade. */
function escala(max: number): { topo: number; passo: number } {
  const passo = PASSOS.find((p) => max / p <= 4) ?? PASSOS[PASSOS.length - 1]
  return { passo, topo: Math.max(passo, Math.ceil(max / passo) * passo) }
}

/** Fatias de uma barra empilhada, já com o vão de superfície descontado. */
function fatias(valores: number[], x0: number, x1: number) {
  const total = valores.reduce((s, v) => s + v, 0)
  const util = x1 - x0 - VAO * Math.max(0, valores.length - 1)
  let cursor = x0
  return valores.map((valor) => {
    const largura = total > 0 ? (util * valor) / total : 0
    const x = cursor
    cursor += largura + VAO
    return { x, largura }
  })
}

// ── Ativos e inativos no tempo ──────────────────────────────────────────────

/**
 * Duas séries: inativos em ouro (com lavagem de área a 10%) e ativos em tinta
 * cheia. O rótulo de cada série fica na ponta da própria linha, e o ponto final
 * carrega o anel de superfície de 2px. O texto do rótulo usa cor de TEXTO, não
 * cor de série — quem carrega a identidade é o ponto ao lado.
 */
function SerieMensal({ serie }: { serie: Metrics['serieMensal'] }) {
  const max = Math.max(...serie.flatMap((p) => [p.ativos, p.inativos]))
  const { topo, passo } = escala(max)
  const marcas = Array.from({ length: topo / passo + 1 }, (_, i) => i * passo)
  const faixa = (SERIE_DIR - SERIE_ESQ) / Math.max(1, serie.length - 1)

  const x = (i: number) => SERIE_ESQ + i * faixa
  const y = (v: number) => SERIE_BASE - (v / topo) * (SERIE_BASE - SERIE_TOPO)

  const linha = (chave: 'ativos' | 'inativos') =>
    serie.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p[chave])}`).join('')
  const area = `${linha('inativos')}L${x(serie.length - 1)},${SERIE_BASE}L${x(0)},${SERIE_BASE}Z`

  const ultimo = serie[serie.length - 1]

  return (
    <svg
      viewBox={`0 0 ${SERIE_W} ${SERIE_H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Ativos e inativos por mês: ${serie
        .map((p) => `${p.rotulo}, ${inteiro.format(p.ativos)} ativos e ${inteiro.format(p.inativos)} inativos`)
        .join('; ')}.`}
    >
      {marcas.map((marca) => (
        <g key={marca}>
          <line
            x1={SERIE_ESQ}
            y1={y(marca)}
            x2={SERIE_DIR}
            y2={y(marca)}
            stroke="var(--ink)"
            strokeOpacity={0.1}
          />
          <text
            x={SERIE_ESQ - 12}
            y={y(marca) + 4}
            textAnchor="end"
            className="t-caption tabular"
            fill="var(--body)"
          >
            {inteiro.format(marca)}
          </text>
        </g>
      ))}

      <path d={area} fill="var(--accent)" fillOpacity={0.1} />
      <path
        d={linha('inativos')}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={linha('ativos')}
        fill="none"
        stroke="var(--ink)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {serie.map((ponto, i) => (
        <text
          key={ponto.mes}
          x={x(i)}
          y={SERIE_BASE + 22}
          textAnchor="middle"
          className="t-caption"
          fill="var(--body)"
        >
          {ponto.rotulo}
        </text>
      ))}

      {(
        [
          { rotulo: 'Inativos', valor: ultimo.inativos, cor: 'var(--accent)' },
          { rotulo: 'Ativos', valor: ultimo.ativos, cor: 'var(--ink)' },
        ] as const
      ).map((serieFinal) => (
        <g key={serieFinal.rotulo}>
          <circle
            cx={x(serie.length - 1)}
            cy={y(serieFinal.valor)}
            r={4}
            fill={serieFinal.cor}
            stroke="var(--canvas)"
            strokeWidth={2}
          />
          <text
            x={SERIE_DIR + 16}
            y={y(serieFinal.valor) - 3}
            className="t-body-sm-strong"
            fill="var(--ink)"
          >
            {serieFinal.rotulo}
          </text>
          <text
            x={SERIE_DIR + 16}
            y={y(serieFinal.valor) + 16}
            className="t-body-sm-strong tabular"
            fill="var(--body)"
          >
            {inteiro.format(serieFinal.valor)}
          </text>
        </g>
      ))}

      {/* Alvo de leitura por mês, bem maior que a marca — o valor de cada ponto
          fica alcançável sem depender de acertar 4px de raio. */}
      {serie.map((ponto, i) => (
        <rect
          key={`alvo-${ponto.mes}`}
          x={x(i) - faixa / 2}
          y={SERIE_TOPO}
          width={faixa}
          height={SERIE_BASE - SERIE_TOPO}
          fill="transparent"
        >
          <title>
            {`${ponto.rotulo}: ${inteiro.format(ponto.ativos)} ativos · ${inteiro.format(ponto.inativos)} inativos`}
          </title>
        </rect>
      ))}
    </svg>
  )
}

// ── Distribuição por produto ────────────────────────────────────────────────

/**
 * Uma barra empilhada de três fatias. As duas fatias de tinta ficam a um passo
 * de opacidade uma da outra, então a distinção adicional vem de PADRÃO — 45° e
 * o espelho em 135° —, nunca de matiz (spec §5). O rótulo de cada fatia fica
 * acima dela, ligado por um fio guia.
 */
function Distribuicao({ metrics }: { metrics: Metrics }) {
  const partes = PRODUTOS.map((produto) => ({
    ...produto,
    valor: metrics.porSegmento[produto.chave],
  }))
  const pedacos = fatias(
    partes.map((p) => p.valor),
    DIST_X0,
    DIST_X1
  )
  const preenchimento = ['var(--accent)', 'url(#pe-tex-a)', 'url(#pe-tex-b)']

  return (
    <svg
      viewBox={`0 0 ${DIST_W} ${DIST_H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Distribuição da base por produto: ${partes
        .map(
          (p) =>
            `${p.nome}, ${inteiro.format(p.valor)} de ${inteiro.format(metrics.totalLeads)}`
        )
        .join('; ')}.`}
    >
      <defs>
        <pattern
          id="pe-tex-a"
          width={8}
          height={8}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width={8} height={8} fill="var(--ink)" fillOpacity={0.62} />
          <rect width={2} height={8} fill="var(--canvas)" />
        </pattern>
        <pattern
          id="pe-tex-b"
          width={8}
          height={8}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-45)"
        >
          <rect width={8} height={8} fill="var(--ink)" fillOpacity={0.45} />
          <rect width={2} height={8} fill="var(--canvas)" />
        </pattern>
      </defs>

      {partes.map((parte, i) => {
        const { x, largura } = pedacos[i]
        const ultimo = i === partes.length - 1
        const ancora = ultimo ? x + largura : x
        return (
          <g key={parte.chave}>
            <path
              d={barra(x, DIST_BARRA_Y, largura, DIST_BARRA_H)}
              fill={preenchimento[i]}
            />
            <line
              x1={ancora}
              y1={52}
              x2={ancora}
              y2={DIST_BARRA_Y}
              stroke="var(--ink)"
              strokeOpacity={0.3}
            />
            <text
              x={ancora}
              y={26}
              textAnchor={ultimo ? 'end' : 'start'}
              className="t-body-sm-strong"
              fill="var(--ink)"
            >
              {parte.nome}
            </text>
            <text
              x={ancora}
              y={46}
              textAnchor={ultimo ? 'end' : 'start'}
              className="t-caption tabular"
              fill="var(--body)"
            >
              {`${inteiro.format(parte.valor)} · ${porcento.format(
                metrics.totalLeads > 0 ? parte.valor / metrics.totalLeads : 0
              )}`}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Churn por produto ───────────────────────────────────────────────────────

/**
 * Barras normalizadas em 100%: o comprimento da fatia de ouro É a taxa de
 * churn, então os três produtos ficam comparáveis apesar dos tamanhos de base
 * muito diferentes. Duas séries; a taxa vai escrita FORA da barra — texto
 * dentro do ouro reprovaria contraste no tema claro.
 */
function Churn({ metrics }: { metrics: Metrics }) {
  const altura = CHURN_TOPO + PRODUTOS.length * CHURN_LINHA

  return (
    <svg
      viewBox={`0 0 ${CHURN_W} ${altura}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Churn por produto: ${PRODUTOS.map((produto) => {
        const dados = metrics.churnPorSegmento[produto.chave]
        return `${produto.nome}, ${porcento.format(dados.churn)} de ${inteiro.format(dados.total)}`
      }).join('; ')}.`}
    >
      <text x={CHURN_X} y={14} className="t-caption" fill="var(--body)">
        Ativos
      </text>
      <text
        x={CHURN_X + CHURN_TRILHA}
        y={14}
        textAnchor="end"
        className="t-caption"
        fill="var(--body)"
      >
        Inativos
      </text>

      {PRODUTOS.map((produto, i) => {
        const dados = metrics.churnPorSegmento[produto.chave]
        const y = CHURN_TOPO + i * CHURN_LINHA
        const [ativos, inativos] = fatias(
          [dados.ativos, dados.inativos],
          CHURN_X,
          CHURN_X + CHURN_TRILHA
        )
        return (
          <g key={produto.chave}>
            <text x={0} y={y + 28} className="t-body-sm-strong" fill="var(--ink)">
              {produto.nome}
            </text>
            <text x={0} y={y + 46} className="t-caption" fill="var(--body)">
              {`${inteiro.format(dados.ativos)} de ${inteiro.format(dados.total)} ativos`}
            </text>
            <rect
              x={ativos.x}
              y={y + 22}
              width={ativos.largura}
              height={CHURN_BARRA}
              fill="var(--ink)"
              fillOpacity={0.62}
            />
            <path
              d={barra(inativos.x, y + 22, inativos.largura, CHURN_BARRA)}
              fill="var(--accent)"
            />
            <text
              x={CHURN_X + CHURN_TRILHA + 16}
              y={y + 37}
              className="t-body-sm-strong tabular"
              fill="var(--ink)"
            >
              {porcento.format(dados.churn)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Receita recorrente ──────────────────────────────────────────────────────

/** Duas fatias: o que entra hoje, em tinta, e o que dá para recuperar, em ouro. */
function Receita({ receita }: { receita: Metrics['receita'] }) {
  const partes = [
    { rotulo: 'MRR atual', valor: receita.mrrAtual, preenchimento: 'ink' as const },
    {
      rotulo: 'MRR recuperável',
      valor: receita.mrrRecuperavel,
      preenchimento: 'accent' as const,
    },
  ]
  const pedacos = fatias(
    partes.map((p) => p.valor),
    DIST_X0,
    DIST_X1
  )

  return (
    <svg
      viewBox={`0 0 ${DIST_W} ${DIST_H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Receita recorrente mensal: ${partes
        .map((p) => `${p.rotulo}, ${moeda.format(p.valor)}`)
        .join('; ')}.`}
    >
      {partes.map((parte, i) => {
        const { x, largura } = pedacos[i]
        const ouro = parte.preenchimento === 'accent'
        return (
          <g key={parte.rotulo}>
            {ouro ? (
              <path
                d={barra(x, DIST_BARRA_Y, largura, DIST_BARRA_H)}
                fill="var(--accent)"
              />
            ) : (
              <rect
                x={x}
                y={DIST_BARRA_Y}
                width={largura}
                height={DIST_BARRA_H}
                fill="var(--ink)"
                fillOpacity={0.62}
              />
            )}
            <line
              x1={x}
              y1={52}
              x2={x}
              y2={DIST_BARRA_Y}
              stroke="var(--ink)"
              strokeOpacity={0.3}
            />
            <text x={x} y={26} className="t-body-sm-strong" fill="var(--ink)">
              {parte.rotulo}
            </text>
            <text x={x} y={46} className="t-caption tabular" fill="var(--body)">
              {moeda.format(parte.valor)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Tiles ───────────────────────────────────────────────────────────────────

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

// ── Tela ────────────────────────────────────────────────────────────────────

export default function ExecutiveReport() {
  const { metrics } = useMetrics()

  const serie = metrics.serieMensal
  const primeiro = serie[0]
  const ultimo = serie[serie.length - 1]
  const cruzamento = serie.find((ponto) => ponto.inativos > ponto.ativos)
  const receita = metrics.receita
  const potencial = receita.mrrAtual + receita.mrrRecuperavel
  const razao = receita.mrrAtual > 0 ? receita.mrrRecuperavel / receita.mrrAtual : 0

  return (
    <div className="h-full overflow-y-auto px-8 py-8">
      <header className="reveal-rise">
        <h1 className="t-display-xl text-ink">Painel executivo</h1>
        <p className="mt-3 max-w-prose t-body-md text-body">
          Como a base evoluiu nos últimos {inteiro.format(serie.length)} meses, quanto ela
          rende hoje e quanto ainda dá para recuperar.
        </p>
      </header>

      <section
        aria-label="Resumo da base"
        className="reveal-rise mt-8 grid grid-cols-2 gap-4 xl:grid-cols-4"
        style={{ animationDelay: '60ms' }}
      >
        <Tile
          rotulo="Base total"
          valor={inteiro.format(metrics.totalLeads)}
          nota="usuários cadastrados"
        />
        <Tile
          rotulo="Ativos"
          valor={inteiro.format(metrics.ativos)}
          nota="assinatura em dia"
        />
        <Tile
          rotulo="Inativos"
          valor={inteiro.format(metrics.inativos)}
          nota="cancelados, inadimplentes e trials"
        />
        <Tile
          rotulo="Churn da base"
          valor={porcento.format(
            metrics.totalLeads > 0 ? metrics.inativos / metrics.totalLeads : 0
          )}
          nota="sem assinatura ativa"
        />
      </section>

      <Card className="reveal-rise mt-6" style={{ animationDelay: '120ms' }}>
        <CardHeader>
          <CardTitle>Ativos e inativos no tempo</CardTitle>
          <CardDescription>
            De {primeiro.rotulo} a {ultimo.rotulo}, os ativos caíram de{' '}
            {inteiro.format(primeiro.ativos)} para {inteiro.format(ultimo.ativos)} e os
            inativos subiram de {inteiro.format(primeiro.inativos)} para{' '}
            {inteiro.format(ultimo.inativos)}.
            {cruzamento ? ` As curvas se cruzam em ${cruzamento.rotulo}.` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SerieMensal serie={serie} />

          <details className="group/serie mt-2">
            <summary className="flex h-11 cursor-pointer list-none items-center gap-2 t-body-sm-strong text-body [&::-webkit-details-marker]:hidden">
              <ChevronRight
                className="size-4 transition-transform group-open/serie:rotate-90"
                aria-hidden
              />
              Ver os números mês a mês
            </summary>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Ativos</TableHead>
                  <TableHead className="text-right">Inativos</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {serie.map((ponto) => (
                  <TableRow key={ponto.mes}>
                    <TableCell>{ponto.rotulo}</TableCell>
                    <TableCell className="text-right tabular">
                      {inteiro.format(ponto.ativos)}
                    </TableCell>
                    <TableCell className="text-right tabular">
                      {inteiro.format(ponto.inativos)}
                    </TableCell>
                    <TableCell className="text-right tabular">
                      {inteiro.format(ponto.ativos + ponto.inativos)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </details>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="reveal-rise" style={{ animationDelay: '180ms' }}>
          <CardHeader>
            <CardTitle>Distribuição por produto</CardTitle>
            <CardDescription>
              Os {inteiro.format(metrics.totalLeads)} usuários da base, repartidos entre os
              três produtos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Distribuicao metrics={metrics} />
          </CardContent>
        </Card>

        <Card className="reveal-rise" style={{ animationDelay: '240ms' }}>
          <CardHeader>
            <CardTitle>Churn por produto</CardTitle>
            <CardDescription>
              Cada barra vale 100% da base do produto. O trecho em ouro é quem está sem
              assinatura ativa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Churn metrics={metrics} />
          </CardContent>
        </Card>
      </div>

      <Card className="reveal-rise mt-6" style={{ animationDelay: '300ms' }}>
        <CardHeader>
          <CardTitle>Receita recorrente estimada</CardTitle>
          <CardDescription>
            {moeda.format(potencial)} por mês se a base inteira estivesse em dia — o plano
            anual entra pelo equivalente mensal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Receita receita={receita} />
          <p className="mt-2 t-body-sm text-body">
            Ticket médio de {moeda.format(receita.ticketMedio)} por assinante ativo.
          </p>
        </CardContent>
      </Card>

      <Card
        tone="dark"
        className="reveal-rise mt-6 py-10"
        style={{ animationDelay: '360ms' }}
      >
        <CardContent>
          <p className="t-body-sm-strong opacity-70">A oportunidade</p>
          <p className="mt-2 t-display-xxl">{moeda.format(receita.mrrRecuperavel)}</p>
          <p className="mt-3 max-w-prose t-body-lg">
            por mês em assinaturas canceladas, inadimplentes e trials expirados —{' '}
            {vezes.format(razao)}× o que a base ativa gera hoje. São{' '}
            {inteiro.format(metrics.inativos)} usuários aguardando reativação.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
