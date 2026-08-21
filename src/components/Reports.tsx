'use client'

// Relatórios — desempenho das campanhas de reativação (spec §5).
//
// REGRA DURA DESTE ARQUIVO: nenhum número é digitado. Tudo sai de `useMetrics()`
// e `useCampanhas()`. Os totais do rodapé da tabela vêm de `metrics.campanhas`
// (a mesma agregação derivada que alimenta o funil), e não de uma soma refeita
// aqui — assim o funil e a tabela não têm como divergir um do outro.
//
// GRÁFICO, spec §5: SVG inline, no máximo 3 séries, série primária em `--accent`,
// demais em rampa de opacidade de `--ink`, rótulo direto na série. Os dois
// gráficos desta tela têm UMA série cada (o funil e a taxa de resposta), então o
// ouro é a série e a trilha atrás dela é cromo recessivo — não é uma segunda
// série, é o mesmo papel de uma linha de grade.

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tag } from '@/components/ui/chip'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useCampanhas } from '@/hooks/useCampanhas'
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

/** Público-alvo da campanha. Rótulo de produto vem de `@/lib/segmentos`. */
const ALVO: Record<Segmento | 'todos', string> = {
  ...ROTULO_SEGMENTO,
  todos: 'Toda a base',
}

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
 * Funil das campanhas. Uma série (o volume que sobra em cada etapa) em ouro,
 * sobre a trilha do total disparado — a trilha vazia É a perda da etapa.
 * Todo valor tem rótulo direto na ponta da barra: não existe número que só o
 * tooltip conte.
 */
function Funil({ etapas, base }: { etapas: Etapa[]; base: number }) {
  const altura = etapas.length * FUNIL_LINHA

  return (
    <svg
      viewBox={`0 0 ${FUNIL_W} ${altura}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Funil das campanhas: ${etapas
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
  const { campanhas } = useCampanhas()

  const c = metrics.campanhas

  const etapas: Etapa[] = [
    { rotulo: 'Enviados', valor: c.enviados, nota: `${inteiro.format(c.total)} campanhas` },
    {
      rotulo: 'Entregues',
      valor: c.entregues,
      nota: `${porcento.format(c.taxaEntrega)} dos enviados`,
    },
    {
      rotulo: 'Respondidos',
      valor: c.respondidos,
      nota: `${porcento.format(c.taxaResposta)} dos entregues`,
    },
    {
      rotulo: 'Qualificados',
      valor: c.qualificados,
      nota: `${porcento.format(c.taxaQualificacao)} dos respondidos`,
    },
    {
      rotulo: 'Convertidos',
      valor: c.convertidos,
      nota: `${porcento.format(c.taxaConversao)} dos qualificados`,
    },
  ]

  // Ordenar por desempenho é ordenação, não recoloração: toda campanha usa o
  // mesmo ouro, então mudar a ordem não repinta ninguém.
  const linhas = campanhas
    .map((campanha) => ({
      ...campanha,
      taxa: campanha.entregues > 0 ? campanha.respondidos / campanha.entregues : 0,
    }))
    .sort((a, b) => b.taxa - a.taxa)

  return (
    <div className="h-full overflow-y-auto px-8 py-8">
      <header className="reveal-rise">
        <h1 className="t-display-xl text-ink">Relatórios</h1>
        <p className="mt-3 max-w-prose t-body-md text-body">
          Desempenho das {inteiro.format(c.total)} campanhas de reativação, do disparo à
          assinatura fechada.
        </p>
      </header>

      <section
        aria-label="Resumo das campanhas"
        className="reveal-rise mt-8 grid grid-cols-2 gap-4 xl:grid-cols-4"
        style={{ animationDelay: '60ms' }}
      >
        <Tile
          rotulo="Mensagens enviadas"
          valor={inteiro.format(c.enviados)}
          nota={`em ${inteiro.format(c.total)} campanhas`}
        />
        <Tile
          rotulo="Taxa de entrega"
          valor={porcento.format(c.taxaEntrega)}
          nota={`${inteiro.format(c.entregues)} chegaram ao destino`}
        />
        <Tile
          rotulo="Taxa de resposta"
          valor={porcento.format(c.taxaResposta)}
          nota={`${inteiro.format(c.respondidos)} responderam`}
        />
        <Tile
          rotulo="Assinaturas fechadas"
          valor={inteiro.format(c.convertidos)}
          nota={`${porcento.format(c.enviados > 0 ? c.convertidos / c.enviados : 0)} dos enviados`}
        />
      </section>

      <Card className="reveal-rise mt-6" style={{ animationDelay: '120ms' }}>
        <CardHeader>
          <CardTitle>Funil das campanhas</CardTitle>
          <CardDescription>
            De {inteiro.format(c.enviados)} disparos a {inteiro.format(c.convertidos)}{' '}
            assinaturas. A trilha clara atrás de cada barra é o total disparado — o vazio é
            a perda da etapa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Funil etapas={etapas} base={c.enviados} />
        </CardContent>
      </Card>

      <Card className="reveal-rise mt-6" style={{ animationDelay: '180ms' }}>
        <CardHeader>
          <CardTitle>Desempenho por campanha</CardTitle>
          <CardDescription>
            Ordenado pela taxa de resposta — respondidos sobre entregues. A última linha é o
            agregado das {inteiro.format(c.total)} campanhas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campanha</TableHead>
                <TableHead className="text-right">Enviados</TableHead>
                <TableHead className="text-right">Entregues</TableHead>
                <TableHead className="text-right">Respondidos</TableHead>
                <TableHead>Taxa de resposta</TableHead>
                <TableHead className="text-right">Convertidos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((linha) => (
                <TableRow key={linha.id}>
                  <TableCell className="whitespace-normal">
                    <span className="block t-body-sm-strong">{linha.nome}</span>
                    <Tag variant="outlined" className="mt-1.5">
                      {ALVO[linha.segmentoAlvo]}
                    </Tag>
                  </TableCell>
                  <TableCell className="text-right tabular">
                    {inteiro.format(linha.enviados)}
                  </TableCell>
                  <TableCell className="text-right tabular">
                    {inteiro.format(linha.entregues)}
                  </TableCell>
                  <TableCell className="text-right tabular">
                    {inteiro.format(linha.respondidos)}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-3">
                      <BarraTaxa taxa={linha.taxa} />
                      <span className="tabular">{porcentoFixo.format(linha.taxa)}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular">
                    {inteiro.format(linha.convertidos)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Todas as campanhas</TableCell>
                <TableCell className="text-right tabular">
                  {inteiro.format(c.enviados)}
                </TableCell>
                <TableCell className="text-right tabular">
                  {inteiro.format(c.entregues)}
                </TableCell>
                <TableCell className="text-right tabular">
                  {inteiro.format(c.respondidos)}
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-3">
                    <BarraTaxa taxa={c.taxaResposta} />
                    <span className="tabular">{porcentoFixo.format(c.taxaResposta)}</span>
                  </span>
                </TableCell>
                <TableCell className="text-right tabular">
                  {inteiro.format(c.convertidos)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
