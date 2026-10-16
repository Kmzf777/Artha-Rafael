// Contas extras do painel no Supabase Auth do próprio projeto.
//
// Existem para dar login a alguém sem mexer em variável da Vercel (o dono do
// painel não tem acesso a ela) e sem DDL: o Auth já vem com o projeto. Quem
// cria a conta é o `scripts/criar-conta-painel.ts`; não há cadastro público.
//
// O Supabase só CONFERE a senha. A sessão do painel continua sendo o cookie
// assinado com `PAINEL_SENHA` — o token do Supabase é descartado.
import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { emailDaConta } from '@/lib/sessao'
import { env } from './env'

/**
 * A credencial confere com uma conta do Supabase Auth. Erro de rede ou do
 * Supabase conta como recusa: o login responde o mesmo 401 de senha errada.
 */
export async function contaSupabaseConfere(usuario: string, senha: string): Promise<boolean> {
  const email = emailDaConta(usuario)
  if (!email || !senha) return false

  // Client NOVO a cada chamada, e não o `db()`: `signInWithPassword` guarda a
  // sessão do usuário no client, e a partir daí as consultas dele saem com o
  // token do usuário em vez da service_role.
  const auth = createClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth

  try {
    const { data, error } = await auth.signInWithPassword({ email, password: senha })
    if (error) {
      // Credencial errada é o caso comum e não merece log. O resto é falha do
      // Supabase — vai para o log sem a senha.
      if (error.code !== 'invalid_credentials') {
        console.error('[login] Supabase Auth falhou:', error.code ?? error.status, error.message)
      }
      return false
    }
    return Boolean(data.session)
  } catch (e) {
    console.error('[login] Supabase Auth inacessível:', e instanceof Error ? e.message : e)
    return false
  }
}
