'use client'

import { useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Braces,
  Check,
  CornerUpLeft,
  ExternalLink,
  Link2,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { toast } from 'sonner'

import PhoneFrame from '@/components/PhoneFrame'
import { Button } from '@/components/ui/button'
import { Chip, Tag } from '@/components/ui/chip'
import { Input } from '@/components/ui/input'
import { StatusLabel } from '@/components/ui/status-label'
import { useAgora } from '@/hooks/useAgora'
import { CHAVE_TEMPLATES, useSincronizarTemplates, useTemplates } from '@/hooks/useTemplates'
import {
  contarVariaveis,
  validarTemplate,
  type BotaoTemplate,
  type RascunhoTemplate,
} from '@/lib/templates'
import type { Template } from '@/mock/types'

// Templates — a décima superfície. Duas partes: o que já existe na conta e o
// formulário que manda um novo para revisão da Meta.
//
// A validação NÃO mora aqui: `validarTemplate` é regra pura e testada em
// `src/lib/templates.ts`. Esta tela só a chama a cada render e trava o CTA
// enquanto sobrar erro — pegar localmente o que a Meta recusaria (o 132018 é o
// caso-canário) é o motivo de a tela existir.
//
// Ouro Artha aparece em dois papéis, ambos da lista fechada: chip de filtro
// selecionado (categoria) e anel de foco (global). O CTA é a pílula preta — no
// escuro, branca. Nunca ouro.

const CATEGORIA: Record<RascunhoTemplate['categoria'], string> = {
  MARKETING: 'Marketing',
  UTILITY: 'Utilidade',
}

const HORA_BR = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  minute: '2-digit',
})

const VARIAVEL = /\{\{(\d+)\}\}/g

/** Troca cada `{{n}}` pelo exemplo correspondente. Sem exemplo, mantém o `{{n}}`. */
function preencher(corpo: string, exemplos: string[]): string {
  return corpo.replace(VARIAVEL, (marca, n: string) => {
    const valor = exemplos[Number(n) - 1]
    return valor && valor.trim() !== '' ? valor : marca
  })
}

// ---------------------------------------------------------------------------
// Estado do template — cinza + ícone + rótulo, nunca cor (DESIGN.md).
//
// `pendente` (em revisão na Meta) é literalmente o mesmo estado que
// `status-label.tsx` define, e vem de lá — sem cópia. Aprovado, rejeitado e
// pausado são vocabulário de revisão de template, que aquele arquivo não tem;
// aqui eles repetem a gramática dele (mesmos tons, mesmo tamanho de ícone,
// rótulo sempre visível) até que a fonte única ganhe esses três estados.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------------

function LinhaDeTemplate({ template, atraso }: { template: Template; atraso: number }) {
  return (
    <li
      className="reveal-rise rounded-xl border border-hairline p-6"
      style={{ animationDelay: `${atraso}ms` }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 font-mono t-body-sm-strong break-all text-ink">{template.nome}</p>
        <StatusLabel status={template.status} />
      </div>

      <p className="mt-3 whitespace-pre-line t-body-sm text-body">{template.corpo}</p>

      {/* "Rejeitado" sem o motivo é um beco sem saída: o operador não sabe o que
          corrigir para reenviar. Superfície cinza e ícone de alerta, sem cor. */}
      {template.status === 'rejeitado' && template.motivoRejeicao && (
        <p className="mt-3 flex items-start gap-2 rounded-md bg-canvas-soft p-4 t-caption text-body">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden />
          <span>Motivo da recusa informado pela Meta: {template.motivoRejeicao}</span>
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Tag variant="outlined">{CATEGORIA[template.categoria]}</Tag>
        <Tag variant="outlined">Português (BR)</Tag>
        {template.botoes.map((botao) => (
          <Tag key={botao}>
            <CornerUpLeft className="size-3.5 shrink-0" aria-hidden />
            {botao}
          </Tag>
        ))}
      </div>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Campos do formulário
// ---------------------------------------------------------------------------

function Campo({
  id,
  rotulo,
  auxilio,
  children,
}: {
  id: string
  rotulo: string
  auxilio?: ReactNode
  children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="t-body-sm-strong text-body">
        {rotulo}
      </label>
      <div className="mt-2">{children}</div>
      {auxilio && <p className="mt-2 t-caption text-body">{auxilio}</p>}
    </div>
  )
}

function LinhaDeBotao({
  botao,
  onMudar,
  onRemover,
}: {
  botao: BotaoTemplate
  onMudar: (proximo: BotaoTemplate) => void
  onRemover: () => void
}) {
  return (
    <div className="rounded-xl bg-canvas-soft p-4">
      <div className="flex items-center gap-3">
        <Tag variant="outlined">
          {botao.tipo === 'URL' ? (
            <Link2 className="size-3.5 shrink-0" aria-hidden />
          ) : (
            <CornerUpLeft className="size-3.5 shrink-0" aria-hidden />
          )}
          {botao.tipo === 'URL' ? 'Link' : 'Resposta rápida'}
        </Tag>
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto"
          aria-label={`Remover o botão ${botao.texto || 'sem texto'}`}
          onClick={onRemover}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>

      <Input
        tone="soft"
        className="mt-3"
        placeholder="Texto do botão"
        value={botao.texto}
        onChange={(e) => onMudar({ ...botao, texto: e.target.value })}
      />

      {botao.tipo === 'URL' && (
        <Input
          tone="soft"
          className="mt-2"
          placeholder="https://artha.ia.br/planejamento"
          value={botao.url}
          onChange={(e) => onMudar({ ...botao, url: e.target.value })}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

type Formulario = {
  nome: string
  categoria: RascunhoTemplate['categoria']
  cabecalho: string
  corpo: string
  rodape: string
  botoes: BotaoTemplate[]
}

const FORMULARIO_VAZIO: Formulario = {
  nome: '',
  categoria: 'MARKETING',
  cabecalho: '',
  corpo: '',
  rodape: '',
  botoes: [],
}

/** Erro que carrega a lista `erros` devolvida pela rota. */
class ErroDeRevisao extends Error {
  constructor(readonly erros: string[]) {
    super(erros[0])
    this.name = 'ErroDeRevisao'
  }
}

export default function Templates() {
  const { templates } = useTemplates()
  const queryClient = useQueryClient()
  const sincronizar = useSincronizarTemplates()

  const [form, setForm] = useState<Formulario>(FORMULARIO_VAZIO)
  const [exemplos, setExemplos] = useState<string[]>([])

  const variaveis = contarVariaveis(form.corpo)

  // O rascunho é derivado, não é estado: `validarTemplate` roda a cada tecla.
  // Exemplo em branco não entra na lista — é assim que o erro de contagem
  // ("2 variáveis e 1 exemplo") acorda em vez de passar batido.
  const rascunho: RascunhoTemplate = {
    nome: form.nome,
    categoria: form.categoria,
    idioma: 'pt_BR',
    cabecalho: form.cabecalho.trim() || null,
    corpo: form.corpo,
    exemplos: exemplos.slice(0, variaveis).filter((valor) => valor.trim() !== ''),
    rodape: form.rodape.trim() || null,
    botoes: form.botoes,
  }

  const erros = validarTemplate(rascunho)

  const criar = useMutation({
    mutationFn: async (corpoDoPost: RascunhoTemplate) => {
      const resposta = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpoDoPost),
      })
      const dados = (await resposta.json().catch(() => ({}))) as { erros?: string[] }
      if (!resposta.ok) {
        throw new ErroDeRevisao(
          dados.erros ?? ['Não foi possível enviar o template para revisão. Tente de novo.']
        )
      }
      return dados
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHAVE_TEMPLATES }),
  })

  const errosDoEnvio =
    criar.error instanceof ErroDeRevisao
      ? criar.error.erros
      : criar.error
        ? [criar.error.message]
        : []

  function mudarExemplo(indice: number, valor: string) {
    setExemplos((atuais) => {
      const proximos = [...atuais]
      proximos[indice] = valor
      return proximos
    })
  }

  function mudarBotao(indice: number, proximo: BotaoTemplate) {
    setForm((f) => ({ ...f, botoes: f.botoes.map((b, i) => (i === indice ? proximo : b)) }))
  }

  function adicionarBotao(botao: BotaoTemplate) {
    setForm((f) => ({ ...f, botoes: [...f.botoes, botao] }))
  }

  function removerBotao(indice: number) {
    setForm((f) => ({ ...f, botoes: f.botoes.filter((_, i) => i !== indice) }))
  }

  function recomecar() {
    criar.reset()
    setForm(FORMULARIO_VAZIO)
    setExemplos([])
  }

  function sincronizarComAMeta() {
    sincronizar.mutate(undefined, {
      onSuccess: ({ sincronizados }) =>
        toast.success(
          sincronizados === 1 ? '1 template sincronizado' : `${sincronizados} templates sincronizados`,
          { description: 'O estado de revisão veio da Meta, que é a fonte da verdade.' }
        ),
      onError: (erro: Error) =>
        toast.error('Não foi possível sincronizar', { description: erro.message }),
    })
  }

  const corpoDaPrevia = preencher(form.corpo, exemplos)
  // Relógio da prévia: real, para não mostrar um horário parado na carga.
  const hora = HORA_BR.format(useAgora())

  return (
    <div className="h-full overflow-y-auto px-8 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="reveal-rise">
          <h1 className="t-display-xl text-ink">Templates</h1>
          <p className="mt-3 max-w-prose t-body-md text-body">
            Template aprovado pela Meta é o único jeito de iniciar conversa fora da janela de 24
            horas. Aqui você vê o que já existe na conta e manda um novo para revisão.
          </p>
        </header>

        <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1 space-y-10">
            {/* ── Na conta ─────────────────────────────────────────────── */}
            <section>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="t-display-md text-ink">Na conta</h2>
                  <p className="mt-2 max-w-prose t-body-md text-body">
                    {templates.length === 1
                      ? '1 template cadastrado na conta da Artha.'
                      : `${templates.length} templates cadastrados na conta da Artha.`}{' '}
                    A Meta é a fonte da verdade do estado de cada um — o painel só descobre
                    a aprovação quando você sincroniza.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  disabled={sincronizar.isPending}
                  onClick={sincronizarComAMeta}
                >
                  <RefreshCw aria-hidden />
                  {sincronizar.isPending ? 'Sincronizando…' : 'Sincronizar com a Meta'}
                </Button>
              </div>

              {templates.length === 0 ? (
                <div className="mt-6 rounded-xl bg-canvas-soft p-8">
                  <p className="t-body-md text-body">
                    Nenhum template na conta ainda. O primeiro sai do formulário abaixo.
                  </p>
                </div>
              ) : (
                <ul className="mt-6 space-y-3">
                  {templates.map((template, i) => (
                    <LinhaDeTemplate key={template.nome} template={template} atraso={i * 40} />
                  ))}
                </ul>
              )}
            </section>

            {/* ── Criar ────────────────────────────────────────────────── */}
            <section>
              <h2 className="t-display-md text-ink">Criar template</h2>

              {criar.isSuccess ? (
                <div className="reveal-rise mt-6 rounded-xl bg-canvas-soft p-8">
                  <span className="flex size-11 items-center justify-center rounded-full bg-ink text-on-ink">
                    <Check className="size-5" strokeWidth={2.5} aria-hidden />
                  </span>
                  <h3 className="mt-4 t-display-sm text-ink">Enviado para revisão</h3>
                  <p className="mt-2 max-w-prose t-body-md text-body">
                    O template entra na conta como pendente e passa a aprovado quando a Meta
                    responde — em geral, minutos. Use “Sincronizar com a Meta” acima para trazer
                    o estado novo; só como aprovado ele aparece disponível em Disparos.
                  </p>
                  <div className="mt-6">
                    <Button variant="subtle" onClick={recomecar}>
                      <Plus aria-hidden />
                      Criar outro
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mt-2 max-w-prose t-body-md text-body">
                    A Meta revisa antes de liberar. O que ela recusaria por formato já é barrado
                    aqui — o botão de envio só destrava sem nenhum ajuste pendente.
                  </p>

                  <div className="mt-6 space-y-6">
                    <Campo
                      id="template-nome"
                      rotulo="Nome"
                      auxilio="Só letras minúsculas, números e underscore. É o identificador na Meta e não muda depois."
                    >
                      <Input
                        id="template-nome"
                        className="font-mono"
                        placeholder="reativacao_base_inativa"
                        value={form.nome}
                        onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                      />
                    </Campo>

                    <div>
                      <p className="t-body-sm-strong text-body">Categoria</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(
                          Object.keys(CATEGORIA) as RascunhoTemplate['categoria'][]
                        ).map((valor) => (
                          <Chip
                            key={valor}
                            selected={form.categoria === valor}
                            onClick={() => setForm((f) => ({ ...f, categoria: valor }))}
                          >
                            {CATEGORIA[valor]}
                          </Chip>
                        ))}
                      </div>
                      <p className="mt-2 t-caption text-body">
                        Reativação de base é marketing. Utilidade é para aviso transacional de quem
                        já pediu — a Meta cobra menos, mas recusa uso promocional.
                      </p>
                    </div>

                    <Campo id="template-cabecalho" rotulo="Cabeçalho (opcional)">
                      <Input
                        id="template-cabecalho"
                        placeholder="Um retorno da Artha"
                        value={form.cabecalho}
                        onChange={(e) => setForm((f) => ({ ...f, cabecalho: e.target.value }))}
                      />
                    </Campo>

                    <div>
                      <label htmlFor="template-corpo" className="t-body-sm-strong text-body">
                        Corpo
                      </label>
                      <textarea
                        id="template-corpo"
                        rows={6}
                        placeholder="Oi, {{1}}! Aqui é da Artha. Vimos que faz um tempo que você não acompanha o seu planejamento financeiro por aqui."
                        value={form.corpo}
                        onChange={(e) => setForm((f) => ({ ...f, corpo: e.target.value }))}
                        className="mt-2 w-full rounded-md border-0 bg-canvas-soft px-4 py-3 t-body-md text-ink transition-colors placeholder:text-mute"
                      />
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <Button
                          variant="subtle"
                          size="sm"
                          onClick={() =>
                            setForm((f) => ({ ...f, corpo: `${f.corpo}{{${variaveis + 1}}}` }))
                          }
                        >
                          <Braces aria-hidden />
                          {`Inserir {{${variaveis + 1}}}`}
                        </Button>
                        <p className="t-caption text-body">
                          As variáveis precisam ser sequenciais a partir de {'{{1}}'}.
                        </p>
                      </div>
                    </div>

                    {variaveis > 0 && (
                      <div>
                        <p className="t-body-sm-strong text-body">Exemplos das variáveis</p>
                        <p className="mt-2 t-caption text-body">
                          A Meta revisa o template com estes valores. Use algo real da base — nome
                          de contato, não “teste”.
                        </p>
                        <div className="mt-3 space-y-2">
                          {Array.from({ length: variaveis }, (_, i) => (
                            <div key={i} className="flex items-center gap-3">
                              <span className="w-14 shrink-0 font-mono t-caption text-body">
                                {`{{${i + 1}}}`}
                              </span>
                              <Input
                                aria-label={`Exemplo da variável ${i + 1}`}
                                placeholder="Marina"
                                value={exemplos[i] ?? ''}
                                onChange={(e) => mudarExemplo(i, e.target.value)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <Campo
                      id="template-rodape"
                      rotulo="Rodapé (opcional)"
                      auxilio="Linha discreta no fim da mensagem. Sem variável."
                    >
                      <Input
                        id="template-rodape"
                        placeholder="Equipe Artha"
                        value={form.rodape}
                        onChange={(e) => setForm((f) => ({ ...f, rodape: e.target.value }))}
                      />
                    </Campo>

                    <div>
                      <p className="t-body-sm-strong text-body">Botões</p>
                      <p className="mt-2 t-caption text-body">
                        Até 3 respostas rápidas. O clique do contato abre a janela de 24 horas — é o
                        que transforma o disparo em conversa.
                      </p>

                      {form.botoes.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {form.botoes.map((botao, i) => (
                            <LinhaDeBotao
                              key={i}
                              botao={botao}
                              onMudar={(proximo) => mudarBotao(i, proximo)}
                              onRemover={() => removerBotao(i)}
                            />
                          ))}
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          variant="subtle"
                          size="sm"
                          onClick={() => adicionarBotao({ tipo: 'QUICK_REPLY', texto: '' })}
                        >
                          <Plus aria-hidden />
                          Resposta rápida
                        </Button>
                        <Button
                          variant="subtle"
                          size="sm"
                          onClick={() => adicionarBotao({ tipo: 'URL', texto: '', url: '' })}
                        >
                          <Plus aria-hidden />
                          Link
                        </Button>
                      </div>
                    </div>

                    {/* Ajustes pendentes — sem cor semântica: superfície cinza,
                        ícone de alerta e o texto do próprio `validarTemplate`. */}
                    {(erros.length > 0 || errosDoEnvio.length > 0) && (
                      <div className="rounded-xl bg-canvas-soft p-6">
                        <p className="flex items-center gap-2 t-body-sm-strong text-ink">
                          <TriangleAlert className="size-4 shrink-0" strokeWidth={2} aria-hidden />
                          {errosDoEnvio.length > 0 && erros.length === 0
                            ? 'A Meta não aceitou'
                            : 'Ajustes antes de enviar'}
                        </p>
                        <ul className="mt-3 space-y-2">
                          {[...erros, ...errosDoEnvio].map((erro) => (
                            <li key={erro} className="t-body-sm text-body">
                              {erro}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* CTA de conversão: pílula preta no claro, branca no escuro. */}
                    <Button
                      disabled={erros.length > 0 || criar.isPending}
                      onClick={() => criar.mutate(rascunho)}
                    >
                      <Send aria-hidden />
                      {criar.isPending ? 'Enviando…' : 'Enviar para revisão'}
                    </Button>
                  </div>
                </>
              )}
            </section>
          </div>

          {/* ── Prévia ─────────────────────────────────────────────────── */}
          <aside className="w-80 shrink-0 lg:sticky lg:top-8">
            <p className="t-body-sm-strong text-body">Prévia da mensagem</p>

            <div className="mt-3">
              <PhoneFrame contato="Contato da base">
                {form.corpo.trim() === '' ? (
                  <p className="py-8 text-center t-body-sm text-body">
                    Escreva o corpo para ver a mensagem.
                  </p>
                ) : (
                  <div className="pl-8">
                    <div className="overflow-hidden rounded-xl bg-ink px-4 py-3 text-on-ink">
                      {rascunho.cabecalho && (
                        <p className="mb-1 t-body-sm-strong">{rascunho.cabecalho}</p>
                      )}
                      <p className="whitespace-pre-line t-body-sm">{corpoDaPrevia}</p>
                      {rascunho.rodape && (
                        <p className="mt-2 t-caption text-on-ink opacity-60">{rascunho.rodape}</p>
                      )}
                      <p className="mt-1 text-right t-caption text-on-ink opacity-60">{hora}</p>

                      {form.botoes.length > 0 && (
                        <div className="-mx-4 -mb-3 mt-3 border-t border-on-ink/25">
                          {form.botoes.map((botao, i) => (
                            <span
                              key={i}
                              className="flex h-11 items-center justify-center gap-2 border-b border-on-ink/25 t-body-sm-strong text-on-ink last:border-b-0"
                            >
                              {botao.tipo === 'URL' ? (
                                <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                              ) : (
                                <CornerUpLeft className="size-3.5 shrink-0" aria-hidden />
                              )}
                              {botao.texto || 'Botão sem texto'}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </PhoneFrame>
            </div>

            <p className="mt-3 t-caption text-body">
              O corpo aparece com os exemplos aplicados. Variável sem exemplo continua como{' '}
              {'{{n}}'} — é exatamente o que a Meta recusaria.
            </p>
          </aside>
        </div>
      </div>
    </div>
  )
}
