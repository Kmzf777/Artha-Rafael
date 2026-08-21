# ROADMAP — Artha System

## Concluído (2026-08-17) — frontend de demonstração

Telas navegáveis com dados fictícios, sem backend. Spec:
`docs/superpowers/specs/2026-08-17-artha-system-frontend-design.md`.

### Onda 1 — fundação

- ✅ **Sistema de design, shell e limpeza (T1)** — remoção da herança de crédito
  consignado (rotas de API, Supabase, Meta, scraper); tokens do DESIGN.md em
  `globals.css` com o acento Ouro Artha e tema escuro por inversão de
  polaridade; Inter via `next/font/google`; alternador de tema sem flash;
  re-skin de todo `src/components/ui/*` para o chrome da pílula 999px; Sidebar
  com as nove abas e a barra indicadora de 3px em `--accent`; registro das nove
  abas em `tabs.ts` e no switch de `page.tsx`.
- ✅ **Camada de dados fictícios (T2)** — `src/mock/` com 760 leads (148 ativos /
  612 inativos), 14 conversas, 6 campanhas, 40 agendamentos, 5 templates;
  semente determinística; `getMetrics()` derivado do dataset; hooks de
  `@tanstack/react-query` sobre o store em memória.

### Onda 2 — telas

- ✅ Dashboard (T3) · Conversas (T4) · Leads (T5) · Disparos e Agendamentos (T6)
  · Reativação (T7) · Relatórios e Painel Executivo (T8) · Login e Configurações (T9)

### Onda 3 — integração

- ✅ `npm run build`, `npm run lint` e `npm test` limpos; varredura de
  conformidade (zero literal de cor/raio/tamanho de fonte no JSX; zero import de
  backend; nenhum nome de persona em copy); consistência numérica entre
  Dashboard e Reativação; as nove telas nos dois temas; `TREE.md` atualizado.

## Em execução (2026-08-20) — backend real (B1 + B2 + B3)

Deixar de ser mockup: Supabase Postgres, WhatsApp Cloud API em produção
(envio + webhook), motor de disparo e criação interna de templates. Spec:
`docs/superpowers/specs/2026-08-20-artha-backend-real-design.md`.

### Pronto

- ✅ **Schema** — migration única `supabase/migrations/0001_schema.sql`:
  `tel_norm11()` e `sem_acento()` espelhando as funções TypeScript, tabelas
  `leads` / `messages` / `conversation_reads` / `campanhas` / `agendamentos` /
  `templates` / `quick_replies` / `webhook_events`, índices não-parciais,
  `reservar_agendamentos()` (`for update skip locked` + reaper de 5 min), RLS
  `deny all`.
- ✅ **B1 — persistência** — `ehInativo`, `diasSemAcesso`, `recorteReativacao`,
  `getMetrics` e `podeDisparar` migraram de `src/mock/metrics.ts` para
  `src/lib/regras.ts`, puras sobre `Lead[]`; `src/mock/metrics.ts` reexporta
  de lá para os testes existentes continuarem valendo. `src/server/repo/*`
  espelha `src/mock/store.ts` função por função contra o Postgres. Rotas
  `/api/leads`, `/api/leads/[id]`, `/api/conversas`,
  `/api/conversas/[key]/mensagens`, `/api/conversas/[key]/lida`,
  `/api/metrics`, `/api/reativacao`, `/api/quick-replies`. `src/mock/db.ts`
  sobrevive como seed (`scripts/seed.ts`), com `npm run seed` recusando rodar
  sem `SEED_CONFIRMO=sim`.
- ✅ **B2 — WhatsApp em produção** — `GET /api/webhook` (verificação) e
  `POST /api/webhook` (assinatura HMAC-SHA256 de `X-Hub-Signature-256` em
  tempo constante, grava em `webhook_events`, responde 200 antes de processar,
  idempotência por `message_id`); tratamento de eventos `messages` e
  `statuses` com `avancarStatus` (`src/lib/statusEntrega.ts`) garantindo que o
  status nunca retrocede; `POST /api/mensagens` para envio livre, recusando
  409 fora da janela de 24h calculada no servidor; mídia de entrada arquivada
  no Storage via `src/server/repo/midia.ts`, servida por `/api/midia/[id]`
  como signed URL.
- ✅ **B3 — disparos e templates** — décima aba **Templates**
  (`src/components/Templates.tsx`), registrada em `src/lib/tabs.ts`,
  `src/app/(app)/page.tsx` e `src/components/Sidebar.tsx`; validação local em
  `src/lib/templates.ts` (contagem de `{{n}}`, botão URL não aceita
  parâmetro — o erro `132018` visto no teste de envio); `POST /api/campanhas`
  enfileira um agendamento por lead do recorte; `POST /api/fila/processar`
  drena a fila protegido por `CRON_SECRET`, respeitando
  `DISPARO_LIMITE_DIARIO` (degrau conservador de 250 conversas iniciadas/24h);
  `podeDisparar(lead)` checada na montagem do recorte **e** de novo dentro do
  worker, imediatamente antes da chamada à Meta.
- ✅ Hooks trocaram o `queryFn` do store em memória para `fetch` nas rotas.
  Atualização por polling: `refetchInterval` de 5s na lista de conversas, 3s
  na timeline aberta (spec §3.3) — Realtime fica como upgrade, ver [NA FILA].
- ✅ `npm run lint`, `npx tsc --noEmit` e `npm run build` limpos; `npm test` —
  205 passando e 14 pulados (paridade `tel_norm11`, esperando banco), todos
  passando, incluindo a paridade de `telNorm11()` contra os casos canônicos de
  `src/lib/telefoneCasos.ts`. (`npm run build` não foi rodado nesta atualização
  de docs.)

### Bloqueado — depende de credenciais do Supabase

`NEXT_PUBLIC_SUPABASE_URL` está vazio em `.env.local`. Três itens do recorte
não podem ser concluídos sem o projeto Supabase existir:

- **Aplicar a migration** `0001_schema.sql` no projeto (SQL Editor — não exige
  CLI).
- **Criar o bucket `midia`, privado**, no Storage — é o destino de
  `src/server/repo/midia.ts` e não existe automatizado na migration.
- **O teste ponta a ponta** (critério de aceitação 10 da spec): disparo real
  para `5534988861441`, resposta do lead pelo webhook, card correto na tela
  de Conversas com o nono dígito reconciliado, resposta dentro da janela de
  24h. Os critérios 1–9 da spec não dependem disso e estão cobertos por
  código e teste automatizado; o 10 só roda com o projeto Supabase de pé e a
  URL do webhook exposta publicamente (túnel `cloudflared` em dev).

### Correções da revisão final (2026-08-20)

Uma revisão independente achou dez defeitos depois de o código estar de pé.
Os três que mais importavam:

- **Nenhuma rota de envio tinha autenticação.** `src/middleware.ts` põe basic
  auth em tudo, menos `/api/webhook` (assinatura HMAC da Meta) e
  `/api/fila/processar` (`CRON_SECRET`). Publicar sem isso deixaria
  `POST /api/campanhas` aberto na internet. Medida mínima até o B5.
- **Nada drenava a fila.** `vercel.json` com cron de 10 min, mais o botão
  "Processar fila agora" em Agendamentos para desenvolvimento.
  ⚠️ **Cron a cada 10 min exige plano Pro da Vercel** — no Hobby só há cron
  diário, e 612 leads levariam meses.
- **`/api/templates/sync` nunca era chamado**, então template aprovado pela
  Meta ficava "pendente" para sempre e a campanha nunca ficava possível.
  Botão "Sincronizar com a Meta" na aba Templates.

Também: `env ARTHA (1).txt` passou a ser coberto pelo `.gitignore` (o padrão
`.env*` não o alcançava, e ele carrega o token e o app secret em texto puro);
`/api/reativacao` passou a usar a mesma régua de `podeDisparar` que
`/api/campanhas`; o relógio congelado do mock saiu de todas as telas que leem
do Postgres, via `useAgora()`; e `/api/conta` passou a mostrar o número WABA
real no lugar do fictício.

## [NA FILA]

- **B5 — base real e autenticação.** Depende do CSV dos 612 inativos, ainda
  não entregue pelo cliente. Inclui login com papéis: hoje a tela de login é
  decorativa (`src/app/(auth)/login/page.tsx` só navega, não autentica), e o
  painel não pode ir para a internet antes disso.
- **B4 — agente de IA.** Depende do JSON exportado do n8n e das três bases de
  conhecimento (Lúcia/Clara/LucIA — nome ainda em aberto), nenhum entregue.
- **Realtime do Supabase** no lugar do polling atual (spec §3.3) — troca
  disponível sem reescrita de tela, pelo mesmo padrão de mutação que os hooks
  já usam.
- **Rotacionar o `WHATSAPP_ACCESS_TOKEN`.** Circulou em texto puro no arquivo
  `env ARTHA (1).txt` e é system user permanente (`expires_at: 0`) — não
  expira sozinho. Rotacionar na Business Manager quando o cliente puder.
- **`name_status: DECLINED`.** O nome de exibição "Artha Finanças Pessoais" foi
  recusado pela Meta — não bloqueia envio, bloqueia o nome aparecer para o
  destinatário. Reenviar para revisão na Business Manager.
- **Nome da persona** — o site anuncia "Clara IA", a LucIA é produto vendido a
  terceiros e a transcrição chama de "Lúcia". Três nomes em circulação; a
  escolha é do cliente. Até lá, a voz é institucional e nenhuma copy cita nome.
- **Cor semântica em tabela densa** — a demo usa cinza + ícone + rótulo, fiel ao
  DESIGN.md. Um operador varrendo 120 disparos em produção depende disso para
  achar as falhas, o que é mais lento que um vermelho. Revisitar agora que a
  operação é real.
