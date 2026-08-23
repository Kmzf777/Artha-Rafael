'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LoaderCircle, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// `ex-auth-form-card` — card `--canvas-soft`, raio `--r-xl`, padding `--s-2xl`,
// inputs `--r-md` no preenchimento aninhado `--canvas-softer`, CTA pílula preta
// (branca no escuro, pela inversão de `--primary`). O ouro não entra aqui: a
// história de conversão do DESIGN.md é o preto, e o único papel do acento nesta
// tela é o anel de foco, que já é global.
//
// O formulário autentica de verdade contra `POST /api/login`, que troca a
// credencial da equipe por um cookie de sessão assinado. Antes daqui isto era
// basic auth, com o diálogo nativo do navegador — sem marca e sem logout.

/** Só caminho interno: `de=https://outro.site` viraria redirecionamento aberto. */
function destinoSeguro(de: string | null): string {
  if (!de || !de.startsWith('/') || de.startsWith('//')) return '/'
  return de
}

function FormularioDeLogin() {
  const router = useRouter()
  const de = destinoSeguro(useSearchParams().get('de'))

  const [entrando, setEntrando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function entrar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (entrando) return

    const dados = new FormData(event.currentTarget)
    setEntrando(true)
    setErro(null)

    try {
      const resposta = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario: String(dados.get('usuario') ?? ''),
          senha: String(dados.get('senha') ?? ''),
        }),
      })

      if (!resposta.ok) {
        const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string }
        setErro(corpo.erro ?? 'Não foi possível entrar agora. Tente de novo.')
        setEntrando(false)
        return
      }

      // `refresh` antes de navegar: o middleware precisa reavaliar a sessão com
      // o cookie novo, senão o painel volta para cá em seguida.
      router.refresh()
      router.replace(de)
    } catch {
      setErro('Sem conexão com o servidor.')
      setEntrando(false)
    }
  }

  return (
    <form
      onSubmit={entrar}
      className="reveal-rise w-full max-w-sm rounded-xl bg-canvas-soft p-6"
      style={{ animationDelay: '90ms' }}
    >
      <h1 className="t-display-sm text-ink">Entrar no painel</h1>
      <p className="mt-2 t-body-sm text-body">Acesso da equipe Artha.</p>

      <div className="mt-6 space-y-4">
        {/* Rótulo visível acima de cada campo: em um sistema sem borda de input,
            é o rótulo que identifica o controle, não o contraste do
            preenchimento. O `label` envolve o campo — associação implícita. */}
        <label className="block space-y-2">
          <span className="block t-body-sm-strong text-body">Usuário</span>
          <Input
            name="usuario"
            tone="soft"
            autoComplete="username"
            autoFocus
            required
            disabled={entrando}
            aria-invalid={erro !== null}
          />
        </label>

        <label className="block space-y-2">
          <span className="block t-body-sm-strong text-body">Senha</span>
          <Input
            type="password"
            name="senha"
            tone="soft"
            autoComplete="current-password"
            required
            disabled={entrando}
            aria-invalid={erro !== null}
          />
        </label>
      </div>

      {/* Erro em cinza + ícone + texto, como todo estado deste sistema. A
          mensagem do servidor não distingue usuário de senha errados: dizer qual
          falhou entrega metade da credencial a quem está tentando adivinhar. */}
      {erro && (
        <p
          role="alert"
          aria-live="polite"
          className="reveal-rise mt-4 flex items-start gap-2 rounded-md bg-canvas-softer p-3 t-body-sm text-ink"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden />
          {erro}
        </p>
      )}

      <Button type="submit" disabled={entrando} className="mt-6 w-full">
        {entrando ? (
          <>
            <LoaderCircle className="animate-spin" aria-hidden />
            Entrando…
          </>
        ) : (
          'Entrar'
        )}
      </Button>

      <p className="mt-4 t-caption text-body">
        A equipe compartilha uma credencial. Contas por pessoa entram com a próxima
        etapa.
      </p>
    </form>
  )
}

export default function LoginPage() {
  // `useSearchParams` exige Suspense na fronteira: sem ele a rota inteira vira
  // dinâmica no build.
  return (
    <Suspense fallback={<div className="w-full max-w-sm rounded-xl bg-canvas-soft p-6" />}>
      <FormularioDeLogin />
    </Suspense>
  )
}
