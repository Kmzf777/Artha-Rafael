'use client'

import { useState } from 'react'
import { Check, ListPlus } from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tag } from '@/components/ui/chip'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useEnfileirarCampanha } from '@/hooks/useCampanhas'
import type { FiltroRecorte } from '@/hooks/useReativacaoRecorte'
import { useTemplates } from '@/hooks/useTemplates'
import {
  SEGUNDOS_ENTRE_ENVIOS,
  descreverVariaveis,
  motivoNaoPreenchivel,
} from '@/lib/disparos'
import { contarVariaveis } from '@/lib/templates'
import type { Segmento, Template } from '@/mock/types'

// Confirmação do recorte da Reativação. Não envia nada daqui: cria a campanha e
// um agendamento `pendente` por lead, que aparece no topo de Agendamentos.
// O recorte chega pronto da tela — este diálogo só escolhe template e nome.

const ROTULO_CATEGORIA = { MARKETING: 'Marketing', UTILITY: 'Utilidade' } as const

/** `null` quando a tela consegue preencher todas as {{n}} do corpo. */
function impedimentoDe(t: Template): string | null {
  return motivoNaoPreenchivel(contarVariaveis(t.corpo))
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Tamanho do recorte, vindo de `useReativacaoRecorte`. Nunca digitado. */
  total: number
  /**
   * Quantos do recorte o motor de disparo aceita. Menor que `total` quando há
   * lead de semente: telefone fictício não recebe mensagem. O botão e a
   * validação usam ESTE número — prometer `total` e enfileirar `disparaveis`
   * é o defeito que faz o toast dizer "0 disparos na fila" na frente do
   * cliente.
   */
  disparaveis: number
  leadIds: string[]
  segmentoAlvo: Segmento | 'todos'
  /**
   * O recorte como a tela o montou. Quem resolve os leads é o servidor, então
   * é o FILTRO que precisa viajar — mandar só o segmento faria a fila sair
   * maior que o total anunciado aqui, e número divergente entre telas é o
   * defeito mais grave possível.
   */
  filtro: FiltroRecorte
  /** Ex.: "90+ dias sem acesso · Cancelado · Artha". */
  resumoDoRecorte: string
  nomeSugerido: string
}

export default function EnqueueReativacaoDialog({
  open,
  onOpenChange,
  total,
  disparaveis,
  leadIds,
  segmentoAlvo,
  filtro,
  resumoDoRecorte,
  nomeSugerido,
}: Props) {
  const { aprovados } = useTemplates()
  const { mutate, isPending } = useEnfileirarCampanha()

  // `null` = o usuário ainda não editou; o campo mostra o nome sugerido pelo
  // recorte. Derivar em vez de sincronizar por efeito evita render em cascata.
  const [nome, setNome] = useState<string | null>(null)
  const [template, setTemplate] = useState('')

  // A escolha padrão sai dos PREENCHÍVEIS: cair no primeiro aprovado poderia
  // pré-selecionar um modelo que a tela não consegue preencher.
  const preenchiveis = aprovados.filter((t) => impedimentoDe(t) === null)
  const escolhido = preenchiveis.find((t) => t.nome === template) ?? preenchiveis[0]
  // Qual campo do lead preenche cada {{n}} do modelo escolhido — a ordem não
  // pode ser adivinhada pelo operador. Vazia quando o corpo não tem variável.
  const ordemDasVariaveis = escolhido ? descreverVariaveis(contarVariaveis(escolhido.corpo)) : ''
  const explicacaoDasVariaveis = ordemDasVariaveis
    ? `As variáveis do corpo são preenchidas com dados do lead, nesta ordem: ${ordemDasVariaveis}.`
    : ''
  const nomeFinal = (nome ?? nomeSugerido).trim() || nomeSugerido
  const podeEnfileirar = escolhido !== undefined && disparaveis > 0 && !isPending

  // Abrir de novo com outro recorte tem de trazer o nome do recorte novo.
  function alternar(aberto: boolean) {
    if (!aberto) {
      setNome(null)
      setTemplate('')
    }
    onOpenChange(aberto)
  }

  function enfileirar() {
    if (!escolhido || !podeEnfileirar) return
    mutate(
      { nome: nomeFinal, template: escolhido.nome, segmentoAlvo, leadIds, filtro },
      {
        onSuccess: ({ campanha, agendamentos }) => {
          toast.success(`${agendamentos.length} disparos na fila`, {
            description: `A campanha "${campanha.nome}" já aparece no topo de Agendamentos.`,
          })
          alternar(false)
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={alternar}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Enfileirar campanha de reativação</DialogTitle>
          <DialogDescription>
            {total} {total === 1 ? 'pessoa' : 'pessoas'} no recorte · {resumoDoRecorte}.
            {disparaveis < total && (
              <>
                {' '}
                {disparaveis === 0
                  ? 'Todas são leads de demonstração — nenhum disparo sai deste recorte.'
                  : `${total - disparaveis} são leads de demonstração e não recebem disparo.`}
              </>
            )}
            Nada é enviado agora: os disparos entram como pendentes em Agendamentos,
            espaçados em {SEGUNDOS_ENTRE_ENVIOS} segundos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="nome-campanha" className="t-body-sm-strong text-body">
              Nome da campanha
            </label>
            <Input
              id="nome-campanha"
              value={nome ?? nomeSugerido}
              onChange={(e) => setNome(e.target.value)}
              placeholder={nomeSugerido}
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="t-body-sm-strong text-body">Template aprovado pela Meta</p>
            <div
              role="group"
              aria-label="Template aprovado pela Meta"
              className="scroll-soft flex max-h-96 flex-col gap-2 overflow-y-auto"
            >
              {aprovados.map((t) => {
                const selecionado = escolhido?.nome === t.nome
                const impedimento = impedimentoDe(t)
                return (
                  <button
                    key={t.nome}
                    type="button"
                    disabled={impedimento !== null}
                    aria-pressed={selecionado}
                    onClick={() => setTemplate(t.nome)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-md border p-4 text-left transition-colors',
                      selecionado ? 'border-ink bg-canvas-soft' : 'border-hairline bg-canvas',
                      impedimento === null
                        ? 'hover:bg-canvas-soft'
                        : 'cursor-not-allowed opacity-60'
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border',
                        selecionado
                          ? 'border-ink bg-ink text-on-ink'
                          : 'border-hairline'
                      )}
                    >
                      {selecionado && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    <span className="flex min-w-0 flex-col gap-2">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-mono t-body-sm-strong text-ink">{t.nome}</span>
                        <Tag variant="outlined">{ROTULO_CATEGORIA[t.categoria]}</Tag>
                      </span>
                      <span
                        className={cn(
                          't-body-sm text-body',
                          !selecionado && 'line-clamp-2'
                        )}
                      >
                        {t.corpo}
                      </span>
                      {impedimento !== null && (
                        <span className="t-caption text-body">{impedimento}</span>
                      )}
                      {selecionado && t.botoes.length > 0 && (
                        <span className="flex flex-wrap gap-2">
                          {t.botoes.map((botao) => (
                            <Tag key={botao}>{botao}</Tag>
                          ))}
                        </span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="t-caption text-body">
              {explicacaoDasVariaveis}
              A assinatura é institucional — quem fala é a Artha.
            </p>
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="secondary" disabled={isPending} />}>
            Cancelar
          </DialogClose>
          <Button onClick={enfileirar} disabled={!podeEnfileirar}>
            <ListPlus aria-hidden />
            {isPending
              ? 'Enfileirando…'
              : `Enfileirar ${disparaveis} ${disparaveis === 1 ? 'disparo' : 'disparos'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
