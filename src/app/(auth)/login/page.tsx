'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// `ex-auth-form-card` — card `--canvas-soft`, raio `--r-xl`, padding `--s-2xl`,
// inputs `--r-md` no preenchimento aninhado `--canvas-softer`, CTA pílula preta
// (branca no escuro, pela inversão de `--primary`). O ouro não entra aqui: a
// história de conversão do DESIGN.md é o preto, e o único papel do acento nesta
// tela é o anel de foco, que já é global.
//
// Não há autenticação nesta fase (spec §2): o submit navega para o painel.

const EMAIL_DEMO = 'operacao@artha.ia.br'

export default function LoginPage() {
  const router = useRouter()
  const [entrando, setEntrando] = useState(false)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (entrando) return
        setEntrando(true)
        // A espera não valida nada — existe para a transição ter um batimento
        // em vez de um corte seco na demonstração.
        setTimeout(() => router.push('/'), 600)
      }}
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
          <span className="block t-body-sm-strong text-body">E-mail</span>
          <Input
            type="email"
            name="email"
            tone="soft"
            autoComplete="email"
            defaultValue={EMAIL_DEMO}
          />
        </label>

        <label className="block space-y-2">
          <span className="block t-body-sm-strong text-body">Senha</span>
          <Input type="password" name="senha" tone="soft" autoComplete="current-password" />
        </label>
      </div>

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
        Ambiente de demonstração — o acesso não valida credenciais.
      </p>
    </form>
  )
}
