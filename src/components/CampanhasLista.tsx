'use client'

import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useCampanhas } from '@/hooks/useCampanhas'
import { numeroComPercentual } from '@/lib/funilCampanha'
import { formatScheduledAt } from '@/lib/scheduling'

/** Funil de entrega de cada campanha. Dados de `GET /api/campanhas`. */
export default function CampanhasLista() {
  const { campanhas, carregando } = useCampanhas()

  return (
    <section className="mt-12" aria-labelledby="titulo-campanhas">
      <h2 id="titulo-campanhas" className="t-display-md text-ink">Campanhas</h2>

      {carregando ? (
        <Skeleton className="mt-4 h-32 w-full rounded-xl" />
      ) : campanhas.length === 0 ? (
        <p className="mt-4 rounded-xl bg-canvas-soft p-8 text-center t-body-md text-body">
          Nenhuma campanha ainda
        </p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-hairline">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Enviados</TableHead>
                <TableHead>Entregues</TableHead>
                <TableHead>Lidos</TableHead>
                <TableHead>Respondidos</TableHead>
                <TableHead>Qualificados</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campanhas.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="t-body-sm-strong text-ink">{c.nome}</TableCell>
                  <TableCell className="font-mono text-body">{c.template}</TableCell>
                  <TableCell className="font-mono text-body">{formatScheduledAt(c.criadaEm)}</TableCell>
                  <TableCell className="tabular text-body">{c.enviados}</TableCell>
                  <TableCell className="tabular text-body">{numeroComPercentual(c.entregues, c.enviados)}</TableCell>
                  <TableCell className="tabular text-body">{numeroComPercentual(c.lidos, c.enviados)}</TableCell>
                  <TableCell className="tabular text-body">{numeroComPercentual(c.respondidos, c.enviados)}</TableCell>
                  <TableCell className="tabular text-body">{numeroComPercentual(c.qualificados, c.enviados)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}
