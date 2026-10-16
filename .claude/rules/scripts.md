---
paths:
  - "scripts/**"
---

# Scripts de `scripts/`

- Rodam com `npx tsx scripts/<nome>.ts`, fora do Next.js.
- Todo script começa com `import './env'`. `scripts/env.ts` carrega `.env.local`
  e depois `.env`, porque `tsx` não lê `.env.local` sozinho. Sem esse import o
  script vê as variáveis vazias.
- **Script que importa `src/server/*` precisa de `--conditions=react-server`:**
  `npx tsx --conditions=react-server scripts/<nome>.ts`. Os módulos de
  `src/server/` importam `server-only`, cujo export padrão lança erro; só a
  condição `react-server` resolve para o arquivo vazio. Os scripts atuais evitam
  isso criando o próprio client do Supabase.
- Trate o `.env.local` como produção: é com ele apontando para o banco de
  produção que se criam contas e se importam leads (DEPLOY.md §5). Os scripts que
  escrevem em massa ou apagam exigem confirmação explícita por variável:
  `IMPORT_CONFIRMO=sim` (`importar-leads.ts`, `criar-conta-painel.ts`),
  `RESET_CONFIRMO=sim` (`reset-storage.ts`). Não remova a trava.
- `simular-disparo.ts` manda WhatsApp de verdade para o número passado, sem
  trava. Antes de cada simulação, `!reset` na conversa daquele número.
- Senha vai por variável de ambiente (`PAINEL_NOVA_SENHA`), nunca por argumento,
  e o script não a imprime.
