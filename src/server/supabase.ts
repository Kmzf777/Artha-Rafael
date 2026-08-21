// Client de SERVIDOR, com service_role. O browser nunca importa este módulo —
// `server-only` faz o build quebrar se alguém tentar. Spec §3.2.
import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from './env'

let client: SupabaseClient | null = null

export function db(): SupabaseClient {
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return client
}
