'use client'

import { useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { StatusLabel, type StatusKind } from '@/components/ui/status-label'
import { useConta } from '@/hooks/useConta'
import { cn } from '@/lib/utils'

// Configurações — spec §5: conta conectada, número WABA, preferência de tema e
// dados do perfil, todos em `ex-auth-form-card` (card `--canvas-soft`, raio
// `--r-xl`, padding `--s-2xl`), que é exatamente o chrome de `<Card tone="soft">`.
//
// Nenhuma inversão de polaridade aqui: o movimento assinatura do DESIGN.md já é
// gasto uma vez no login e uma vez no Dashboard. Tela de ajuste é tela quieta.

const EMAIL_CONTA = 'operacao@artha.ia.br'

const TEMAS = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'system', label: 'Do sistema', icon: Monitor },
] as const

// Vocabulário da Graph API traduzido. Chave desconhecida cai no valor cru: a
// Meta acrescenta estado novo sem avisar, e mostrar o código é melhor que
// mostrar nada.
const QUALIDADE: Record<string, string> = {
  GREEN: 'Alta',
  YELLOW: 'Média',
  RED: 'Baixa',
  UNKNOWN: 'Sem medição ainda',
}

const VERIFICACAO: Record<string, string> = {
  VERIFIED: 'Verificado',
  NOT_VERIFIED: 'Não verificado',
  EXPIRED: 'Verificação expirada',
}

/**
 * `name_status` no vocabulário de REVISÃO do `status-label` — o mesmo que os
 * templates usam, porque é a mesma fila de revisão da Meta. Cinza + ícone +
 * rótulo, nunca cor.
 */
const STATUS_DO_NOME: Record<string, StatusKind> = {
  APPROVED: 'aprovado',
  AVAILABLE_WITHOUT_REVIEW: 'aprovado',
  DECLINED: 'rejeitado',
  PENDING_REVIEW: 'pendente',
}

const noopSubscribe = () => () => {}

/**
 * `false` no servidor, `true` depois da hidratação — mesmo guarda da Sidebar. O
 * tema resolvido só existe no cliente; marcar a opção ativa no HTML do servidor
 * produziria o salto visual que o script do next-themes evita.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  )
}

function Dado({ rotulo, valor, mono }: { rotulo: string; valor: string; mono?: boolean }) {
  return (
    <div>
      <dt className="t-caption text-body">{rotulo}</dt>
      <dd className={cn('t-body-sm-strong text-ink', mono && 'font-mono')}>{valor}</dd>
    </div>
  )
}

export default function AccountInfo() {
  const router = useRouter()
  // O alternador da Sidebar e este seletor leem e escrevem o mesmo estado do
  // next-themes — nenhuma lógica de tema é duplicada, só a apresentação muda.
  const { theme, setTheme } = useTheme()
  const hidratado = useHydrated()
  const { conta, carregando } = useConta()

  const [nome, setNome] = useState('Equipe Artha')
  const [email, setEmail] = useState(EMAIL_CONTA)

  return (
    <div className="h-full overflow-y-auto px-8 py-8">
      <h1 className="t-display-xl text-ink">Configurações</h1>
      <p className="mt-3 max-w-prose t-body-md text-body">
        Conta conectada, número de WhatsApp Business, preferência de tema e dados do perfil.
      </p>

      <div className="mt-8 grid max-w-4xl gap-6">
        <Card tone="soft" className="reveal-rise">
          <CardHeader>
            <CardTitle>Conexão do WhatsApp</CardTitle>
            <CardDescription>
              Número oficial que envia e recebe as mensagens do painel.
            </CardDescription>
          </CardHeader>
          {/* Esta é a tela em que o operador CONFERE qual número está no ar.
              Nada aqui é digitado nem tem valor de reserva: ou é o que a Graph
              API devolveu, ou é o aviso de que a consulta não voltou. Número
              errado aqui é pior que campo vazio. */}
          <CardContent>
            {carregando ? (
              <p className="t-body-md text-body">Consultando o número na Meta…</p>
            ) : conta === null ? (
              <p className="max-w-prose t-body-md text-body">
                Não foi possível consultar o número na Meta agora. Os dados só aparecem quando a
                resposta chegar — nesta tela, um número desatualizado seria pior que um campo
                vazio.
              </p>
            ) : (
              <>
                <p className="t-display-md text-ink">{conta.telefone}</p>
                <dl className="mt-4 grid grid-cols-2 gap-4">
                  <Dado rotulo="ID do número" valor={conta.id} mono />
                  <Dado rotulo="Provedor" valor="API oficial da Meta" />
                  <Dado
                    rotulo="Qualidade do número"
                    valor={QUALIDADE[conta.qualidade] ?? conta.qualidade}
                  />
                  <Dado
                    rotulo="Verificação"
                    valor={VERIFICACAO[conta.verificacao] ?? conta.verificacao}
                  />
                </dl>

                {/* Nome de exibição: separado do resto porque não é dado de
                    cadastro, é estado de revisão — e `DECLINED` significa que
                    quem recebe a mensagem vê o número, não o nome. */}
                <div className="mt-6 border-t border-hairline pt-4">
                  <p className="t-caption text-body">Nome de exibição na Meta</p>
                  <p className="t-body-sm-strong text-ink">{conta.nomeExibicao}</p>
                  <StatusLabel
                    status={STATUS_DO_NOME[conta.statusDoNome] ?? 'pendente'}
                    className="mt-2"
                  />
                  {conta.statusDoNome === 'DECLINED' && (
                    <p className="mt-2 max-w-prose t-body-sm text-body">
                      A Meta recusou este nome de exibição. As mensagens continuam saindo
                      normalmente, mas quem recebe vê o número, não o nome. O reenvio para
                      revisão é feito na Business Manager, em Configurações da conta do WhatsApp.
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            toast.success('Perfil atualizado.')
          }}
        >
          <Card tone="soft" className="reveal-rise" style={{ animationDelay: '60ms' }}>
            <CardHeader>
              <CardTitle>Perfil</CardTitle>
              <CardDescription>Como a conta aparece para quem atende.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block space-y-2">
                  <span className="block t-body-sm-strong text-body">Nome de exibição</span>
                  <Input
                    tone="soft"
                    value={nome}
                    onChange={(event) => setNome(event.target.value)}
                  />
                </label>
                <label className="block space-y-2">
                  <span className="block t-body-sm-strong text-body">E-mail</span>
                  <Input
                    type="email"
                    tone="soft"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit">Salvar alterações</Button>
            </CardFooter>
          </Card>
        </form>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card tone="soft" className="reveal-rise" style={{ animationDelay: '120ms' }}>
            <CardHeader>
              <CardTitle>Aparência</CardTitle>
              <CardDescription>Vale para este navegador.</CardDescription>
            </CardHeader>
            <CardContent>
              <div role="group" aria-label="Preferência de tema" className="flex flex-wrap gap-2">
                {TEMAS.map(({ value, label, icon: Icon }) => {
                  const ativo = hidratado && theme === value
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTheme(value)}
                      aria-pressed={ativo}
                      className={cn(
                        'inline-flex h-11 items-center gap-2 rounded-pill px-4 t-body-sm-strong transition-colors',
                        ativo
                          ? 'bg-canvas text-ink elev-3'
                          : 'text-body hover:bg-surface-pressed hover:text-ink'
                      )}
                    >
                      <Icon className="size-4 shrink-0" strokeWidth={2} aria-hidden />
                      {label}
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Não existe tabela de usuários: autenticação por pessoa é o recorte
              B5. Antes daqui morava uma lista de três nomes fixos no código —
              mockup que sobreviveu à migração e dizia ao operador algo que não
              era verdade. O painel hoje tem UMA credencial compartilhada, e é
              isso que a tela passa a informar. */}
          <Card tone="soft" className="reveal-rise" style={{ animationDelay: '180ms' }}>
            <CardHeader>
              <CardTitle>Acesso ao painel</CardTitle>
              <CardDescription>Credencial única, compartilhada pela equipe.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <StatusLabel status="pendente" />
              <p className="t-body-sm text-body">
                Ainda não há conta por pessoa. Quem tem a credencial do painel entra, e as
                ações não ficam atribuídas a um nome — inclusive as mensagens enviadas.
              </p>
              <p className="t-body-sm text-body">
                Contas individuais, papéis e registro de quem fez o quê entram junto com a
                autenticação.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-hairline pt-6">
          <p className="t-body-sm text-body">Encerrar a sessão devolve você à tela de entrada.</p>
          <Button variant="subtle" onClick={() => router.push('/login')}>
            <LogOut aria-hidden />
            Encerrar sessão
          </Button>
        </div>
      </div>
    </div>
  )
}
