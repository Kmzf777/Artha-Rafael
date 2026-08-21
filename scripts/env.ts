// Carrega o ambiente para scripts e testes que rodam FORA do Next.js.
//
// `import 'dotenv/config'` lê só `.env`. O Next carrega `.env.local`
// automaticamente, mas `tsx` e o Vitest não — e é em `.env.local` que moram as
// credenciais. Sem isto, script e teste veem as variáveis vazias e ou pulam em
// silêncio, ou recusam rodar sem explicar por quê.
//
// A ordem espelha a precedência do Next: `.env.local` primeiro, e o `.env`
// depois só preenche o que faltou (dotenv nunca sobrescreve o que já existe).
import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })
