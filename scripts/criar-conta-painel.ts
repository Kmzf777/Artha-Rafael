// Cria uma conta extra de login do painel no Supabase Auth, ou troca a senha
// dela se já existir.
//
// Rodar: IMPORT_CONFIRMO=sim PAINEL_NOVA_SENHA=... npx tsx scripts/criar-conta-painel.ts <usuario>
//
// A senha vem do ambiente, não de argumento, para não ficar no histórico do
// shell. O script nunca a imprime.
//
// O usuário vira e-mail por `emailDaConta` — a mesma regra do login. Sem `@`,
// `rafael` vira `rafael@painel.invalid`, e é `rafael` que se digita no painel.
//
// Remover a conta: Authentication → Users no dashboard do Supabase.
import './env'
import { createClient } from '@supabase/supabase-js'
import { emailDaConta } from '../src/lib/sessao'

const SENHA_MINIMA = 12

const usuario = process.argv[2] ?? ''
const email = emailDaConta(usuario)
const senha = process.env.PAINEL_NOVA_SENHA ?? ''

if (process.env.IMPORT_CONFIRMO !== 'sim') {
  console.error(
    [
      '',
      'Recusando rodar sem confirmação explícita.',
      '',
      'Este script cria ou altera uma conta REAL de login do painel no Supabase Auth.',
      '',
      `  Banco alvo: ${process.env.NEXT_PUBLIC_SUPABASE_URL || '(não configurado)'}`,
      `  Conta:      ${email || '(não informada)'}`,
      '',
      'Se for o banco certo:  IMPORT_CONFIRMO=sim PAINEL_NOVA_SENHA=... npx tsx scripts/criar-conta-painel.ts <usuario>',
      '',
    ].join('\n')
  )
  process.exit(1)
}

if (!email) {
  console.error('Faltou o usuário.')
  process.exit(1)
}

if (senha.length < SENHA_MINIMA) {
  console.error(`PAINEL_NOVA_SENHA precisa ter pelo menos ${SENHA_MINIMA} caracteres.`)
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !chave) {
  console.error('NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.')
  process.exit(1)
}

/** O admin do Auth não busca por e-mail: pagina a lista até achar. */
async function idDoUsuario(admin: ReturnType<typeof createClient>['auth']['admin']): Promise<string | null> {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const achado = data.users.find((u) => u.email?.toLowerCase() === email)
    if (achado) return achado.id
    if (data.users.length < 1000) return null
  }
}

async function main(): Promise<void> {
  const admin = createClient(url!, chave!, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth.admin

  const { error } = await admin.createUser({ email, password: senha, email_confirm: true })
  if (!error) {
    console.log(`${email}: criada`)
    return
  }
  if (error.code !== 'email_exists') throw error

  const id = await idDoUsuario(admin)
  if (!id) throw new Error(`O Supabase diz que ${email} existe, mas a conta não apareceu na lista.`)

  const { error: erroSenha } = await admin.updateUserById(id, { password: senha })
  if (erroSenha) throw erroSenha
  console.log(`${email}: senha atualizada`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
