# Artha System — CLAUDE.md

<!-- Manutenção: alvo abaixo de 200 linhas. Só entra o que o Claude não descobre
lendo o código. Regra que vale para parte do código vai para .claude/rules/ com
`paths:`. Estado do projeto vai para o ROADMAP, deploy para o DEPLOY.md.
Pesquisa que embasa isto: docs/research/2026-10-16-claude-md-e-workflow.md -->

Painel operacional de WhatsApp da **Artha** (planejamento e educação financeira).
O eixo é **atendimento e qualificação** de quem escreve para o número. Não é
reativação: a base de 612 inativos nunca foi entregue pelo cliente.

**O estado corrente está no `ROADMAP.md`, não aqui.** Antes de assumir em que fase
o projeto está, o que está aplicado no banco ou o que está pendente, leia o
ROADMAP. Deploy, variáveis e autenticação: `DEPLOY.md`. Specs por onda:
`docs/superpowers/specs/`.

## Como trabalhar

- **Investigue antes de agir.** Leia o código que vai mexer antes de planejar.
  Havendo ambiguidade no pedido, apresente as leituras possíveis e pergunte; não
  escolha uma em silêncio. Aponte quando houver caminho mais simples.
- **Mínimo de código.** Sem feature, abstração ou configuração que não foi pedida.
  Sem tratamento de erro para cenário impossível.
- **Mudança cirúrgica.** Cada linha alterada rastreia até o pedido. Sem
  refatoração de passagem; siga o estilo do arquivo. Remova só o que a sua
  mudança deixou órfão.
- **Meta verificável.** Transforme o pedido em critério checável ("reproduzir o
  bug, corrigir, ver que não ocorre mais") e mostre a evidência (comando e saída)
  antes de dizer que terminou. Em tarefa de vários passos, declare o plano:
  `1. [passo] → verificar: [critério]`.
- **Agentes em paralelo editam arquivos disjuntos.** Cada subagente toca só os
  arquivos do seu escopo declarado; colisão de arquivo é a falha mais cara aqui.
- Responda em português do Brasil.

## Comandos

```bash
npm run dev           # localhost:3000
npm run build         # build de produção + type-check
npm run lint          # ESLint
npm test              # Vitest (src/**/*.test.ts)
npx tsc --noEmit      # type-check sem build
```

Scripts de `scripts/` rodam com `npx tsx scripts/<nome>.ts`; `import './env'`
(`scripts/env.ts`) carrega o `.env.local`, que o `tsx` não lê sozinho. Script que
importa `src/server/*` precisa de `npx tsx --conditions=react-server ...`, senão o
`server-only` lança. Travas de confirmação em `.claude/rules/scripts.md`.

## Repositório e produção

- **O repo é PÚBLICO** (`github.com/Kmzf777/Artha-Rafael`). Nada de PII (nome,
  telefone, e-mail de lead real), token ou segredo em código, teste, doc ou
  mensagem de commit. Planilha de leads (`*.csv`, `*.xlsx`) e `env*.txt` estão no
  `.gitignore` de propósito; não contorne.
- **Push na `main` é deploy de produção** na Vercel (integração Git). Push em
  outro branch gera só preview. **Merge e push na `main` só com o ok do dono.**
  Trabalhe em branch ou worktree e pare antes do merge.
- **Migrations são aplicadas à mão** no SQL Editor do Supabase, **antes** do
  deploy que as usa. Não há CLI do Supabase nem migração automática no deploy.
  Coluna faltando no banco quebra em silêncio (ver DEPLOY.md, "Migration antes do
  código"). Registre no ROADMAP se a migration nova já foi aplicada.
- **`.env.local` não chega à Vercel.** Variável nova ou alterada é criada no
  painel da Vercel e exige redeploy para valer.

## Gotchas operacionais

- **Não há cron.** `vercel.json` só fixa a região. A fila de disparo só drena por
  `POST /api/fila/disparar-agora` (sessão do painel; é o botão "Processar fila
  agora" de `Agendamentos.tsx`, componente que hoje está fora do menu),
  `POST /api/fila/processar` com `CRON_SECRET`, ou chamando `processarFila()` de
  `src/server/fila.ts`. Comentário no código que fala em "cron do vercel.json"
  está desatualizado.
- **Template aprovado na Meta não aparece sozinho.** Depois da aprovação, chame
  `POST /api/templates/sync` (exige sessão do painel, cookie do `/login`) para
  atualizar o cache local. O botão "Sincronizar com a Meta" mora em
  `Templates.tsx`, também fora do menu.
- **`!reset` no WhatsApp apaga mensagens, leitura e o lead daquele número.** É o
  comando de teste do roteiro, sempre ativo, e só afeta quem o mandou. Teste de
  WhatsApp ponta a ponta exige sessão **fora do auto mode**: o classificador
  bloqueia o `!reset`.
- **Contas do painel.** Credencial principal em `PAINEL_USUARIO`/`PAINEL_SENHA`
  na Vercel. Contas extras por `PAINEL_CONTAS` (`usuario:senha;...`) ou no
  Supabase Auth via `scripts/criar-conta-painel.ts`. Nenhuma derruba sessão
  aberta ao ser removida; só trocar `PAINEL_SENHA` derruba todas (DEPLOY.md §5).
- **Importar leads:** `IMPORT_CONFIRMO=sim npx tsx scripts/importar-leads.ts
  <arquivo.csv> <tag-do-lote>`. A tag é o 2º argumento e é por ela que o recorte
  da campanha acha o lote; sem ela vale `rtv-lote-2026-09` e o lote novo cai
  junto com o antigo.
- **"Lida" só quando a equipe age.** Abrir a conversa não marca. Marca a resposta
  humana por `POST /api/mensagens` (que também manda o visto azul à Meta; falha
  só loga) ou "Marcar como lida" no botão direito do card (só no painel, sem
  visto azul). Bot e fila de disparo não marcam nem mandam visto.

## Arquitetura (o que não salta do código)

- **Um deploy só.** Next.js 16 App Router: telas e as rotas de `src/app/api/`
  sobem juntas como funções serverless em `gru1` (São Paulo, onde está o
  Supabase).
- **Backend real.** Supabase Postgres com RLS `deny all`: só o servidor acessa,
  com a service role, por `src/server/` (`repo/*`, `fila.ts`, `meta/*`, `bot/*`).
  Os módulos de lá que tocam banco ou segredo importam `server-only`.
- **WhatsApp Cloud API.** `POST /api/webhook` valida HMAC (`X-Hub-Signature-256`),
  grava e roda o bot. O bot é **de botões, determinístico, sem LLM**: roteiro em
  `src/lib/bot/roteiro.ts`, motor em `src/lib/bot/estado.ts`, execução em
  `src/server/bot/executar.ts`. O agente de IA (B4) segue bloqueado esperando o
  JSON do n8n.
- **Front.** Hooks em `src/hooks/` com `@tanstack/react-query` fazendo `fetch`
  nas rotas `/api/*`, com polling (5 s na lista de conversas, 3 s na timeline).
  Mutação chama a API e atualiza o cache com `queryClient.setQueryData`.
- **`src/mock/` não é mais fonte de dados.** Dali o app só importa `types.ts`
  (os tipos de domínio, via `@/mock/types`). `db.ts`, `store.ts` e `metrics.ts`
  são o legado da demo, usados só pelos testes de `src/mock/`. Tela nenhuma lê
  do store em memória.
- **Regras puras e testadas ficam em `src/lib/`** (`regras.ts`, `janela24h`,
  `statusEntrega`, `timeline`, `templates`, ...), fora de componente e de rota.
  Regra de negócio nova nasce ali, com teste.
- **Abas.** Cinco: `dashboard`, `conversations`, `leads`, `reports`, `account`.
  Registro em `src/lib/tabs.ts`, switch em `src/app/(app)/page.tsx`, menu em
  `src/components/Sidebar.tsx`; os três mudam juntos. Deep-link por `?tab=`.
  Disparos, Templates, Agendamentos e Reativação existem como componente mas
  saíram do menu.
- **Sessão.** `src/middleware.ts` exige cookie assinado em tudo, exceto
  `/api/webhook` (HMAC da Meta), `/api/fila/processar` (`CRON_SECRET`), login e
  logout.
- **Número igual entre telas.** Métrica é derivada da mesma régua em
  `src/lib/regras.ts` (`getMetrics`, `podeDisparar`, `recorteReativacao`). Duas
  telas mostrando números diferentes para a mesma coisa é o defeito mais grave
  possível neste painel.

## Produtos (aparecem como segmento de lead)

| Produto | Público | Nota |
| --- | --- | --- |
| **Artha** | B2C, pessoa física | Open Finance. Mensal R$197 no 1º mês (R$97 + adesão de R$100) e R$97 depois; anual R$997 sem adesão. Fonte: `artha.ia.br` |
| **Dhana** | B2B | White-label para planejadores financeiros. Sem preço público |
| **LucIA** | B2B | IA operacional para escritórios de planejamento |

## Voz

Institucional Artha: "Aqui é da Artha", "equipe da Artha". **Nenhum nome de
persona (Lúcia, Clara, LucIA) em copy de mensagem.** Clara é a assistente
**dentro** do produto (`artha.ia.br` vende "Assistente Clara IA via WhatsApp"); o
número deste painel é o canal **comercial**, e chamar o bot de Clara faz o lead
achar que já fala com algo que não assinou. Lúcia é o CRM B2B vendido a
planejadores. Regras de escrita da copy do bot: `.claude/rules/copy-do-bot.md`.

## Regras por área

Carregam sozinhas quando o Claude lê ou edita arquivo da área:

- `.claude/rules/design-system.md`: UI, tokens, `@base-ui/react`, acento ouro.
- `.claude/rules/copy-do-bot.md`: roteiro, templates e texto de mensagem.
- `.claude/rules/scripts.md`: como rodar `scripts/`.
- `.claude/rules/migrations.md`: `supabase/migrations/`.
