# Artha System — Tree

Backend real (recorte B1+B2+B3): Supabase Postgres, WhatsApp Cloud API em
produção (webhook + envio), motor de disparo. `src/mock/` sobrevive como
semente do banco (`scripts/seed.ts`) e fixture de teste — não é mais a fonte
de dados das telas.

```text
.
|-- CLAUDE.md              # diretrizes de trabalho e contexto técnico
|-- CONTEXT.md             # vocabulário do domínio
|-- DESIGN.md              # design system (autoridade estética)
|-- ROADMAP.md
|-- TREE.md
|-- components.json        # shadcn/ui — registry base-ui, NÃO Radix
|-- next.config.ts · postcss.config.mjs · tailwind.config.cjs
|-- eslint.config.mjs · tsconfig.json · vitest.config.ts
|-- .env.local.example     # variáveis de servidor; NEXT_PUBLIC_SUPABASE_URL é a única pública
|-- resumo/                                  # reuniões e o resumo do projeto
|-- docs/superpowers/
|   |-- specs/2026-08-17-artha-system-frontend-design.md
|   |-- specs/2026-08-20-artha-backend-real-design.md   # B1+B2+B3 — este recorte
|   `-- plans/2026-08-17-artha-system-frontend.md
|-- public/
|-- supabase/
|   `-- migrations/0001_schema.sql   # migration única, copiável no SQL Editor
|-- scripts/
|   `-- seed.ts                      # carga do dataset fictício; recusa rodar sem SEED_CONFIRMO=sim
`-- src/
    |-- app/
    |   |-- (app)/{layout,page}.tsx      # shell; page.tsx registra as 10 abas
    |   |-- (auth)/layout.tsx + login/page.tsx   # login ainda decorativo (B5)
    |   |-- api/                         # rotas do App Router — repo por baixo, nunca o browser direto
    |   |   |-- leads/{route,[id]/route}.ts
    |   |   |-- conversas/{route,[key]/mensagens/route,[key]/lida/route}.ts
    |   |   |-- mensagens/route.ts       # envio livre; 409 fora da janela de 24h
    |   |   |-- webhook/route.ts         # GET verificação · POST HMAC + idempotência
    |   |   |-- midia/[id]/route.ts      # signed URL do Storage
    |   |   |-- campanhas/route.ts · agendamentos/route.ts
    |   |   |-- fila/processar/route.ts  # worker; protegido por CRON_SECRET
    |   |   |-- templates/{route,sync/route}.ts
    |   |   |-- quick-replies/route.ts · metrics/route.ts · reativacao/route.ts
    |   |-- globals.css                  # TOKENS: claro + escuro, tipo, raio, espaço
    |   |-- layout.tsx                   # Inter + ThemeProvider + TooltipProvider
    |   `-- providers.tsx                # react-query, polling (5s conversas / 3s timeline)
    |-- components/
    |   |-- Sidebar.tsx                  # 10 abas, barra ativa em --accent, tema
    |   |-- Dashboard.tsx                # tiles + 1 banda invertida (número-herói)
    |   |-- Conversations.tsx            # orquestra 3 colunas; expõe onUpdateUnread
    |   |-- conversations/               # ConversationList · ChatHeader ·
    |   |                                # MessageTimeline · MessageComposer ·
    |   |                                # ContactDetailsPanel · StagedImageModal · telefone.ts
    |   |-- MessageBubble.tsx            # inversão de polaridade na bolha enviada
    |   |-- Leads.tsx                    # tabela paginada, agora contra /api/leads
    |   |-- Disparos.tsx                 # wizard 3 passos + frame de telefone
    |   |-- PhoneFrame.tsx               # frame de telefone extraído, reusado por Templates
    |   |-- Templates.tsx                # décima aba: criação + validação local pré-Meta
    |   |-- Agendamentos.tsx             # fila + histórico
    |   |-- Reativacao.tsx               # a tela que vende: régua + recorte vivo
    |   |-- Reports.tsx                  # funil de campanha
    |   |-- ExecutiveReport.tsx          # série 8 meses, churn, receita
    |   |-- AccountInfo.tsx              # conta, WABA, tema, equipe
    |   |-- {SendDisparoDialog,SendContactDialog,EnqueueReativacaoDialog}.tsx
    |   |-- {QuickRepliesManager,MediaLabel}.tsx
    |   `-- ui/                          # primitivos: pílula 999, card 16, input 8
    |       |-- chip.tsx                 # category-button (+ Tag)
    |       |-- status-label.tsx         # estado = ícone + rótulo, sem cor
    |       `-- alert avatar badge button card dialog dropdown-menu input
    |           scroll-area separator skeleton sonner table tooltip
    |-- hooks/                           # react-query; queryFn agora é fetch('/api/…')
    |   `-- useConversations · useConversationMessages · useConversationData
    |       useMessageSender · useLeads · useCampanhas · useAgendamentos
    |       useTemplates · useReativacaoRecorte · useMetrics
    |-- lib/                             # regras puras, testadas — não mudam de camada
    |   |-- regras.ts                    # ex-mock/metrics.ts: ehInativo, recorteReativacao,
    |   |                                # getMetrics, podeDisparar — a régua única (spec §5.2)
    |   |-- statusEntrega.ts             # avancarStatus: status só avança, nunca retrocede
    |   |-- phoneUtils.ts                # telNorm11() — espelha tel_norm11(text) do Postgres
    |   |-- telefoneCasos.ts             # casos canônicos lidos por telNorm11.test.ts
    |   |-- texto.ts                     # semAcento() — espelha sem_acento(text) do Postgres
    |   |-- templates.ts                 # validação local de template (contagem de {{n}}, botão URL)
    |   |-- webhookParse.ts              # parse do payload da Meta (messages/statuses)
    |   |-- segmentos.ts                 # fonte única do rótulo de produto
    |   |-- conversationTypes.ts         # forma de fio (snake_case) — schema de `messages` a espelha
    |   |-- api.ts                       # fetch helpers do client para as rotas
    |   |-- validation.ts
    |   `-- buscaConversas conversationFilter conversationKey conversationReads
    |       disparos format janela24h listaConversas quickReplies scheduling tabs timeline utils
    |-- mock/                            # sobrevive como SEMENTE (scripts/seed.ts) e fixture de teste
    |   |-- types.ts                     # contrato de domínio
    |   |-- db.ts                        # dataset ancorado no dia corrente; ficticio: true
    |   |-- store.ts                     # leitura + mutação em memória (fixture de teste)
    |   `-- metrics.ts                   # reexporta de src/lib/regras.ts — mesma assinatura
    `-- server/                          # NUNCA importado por componente client — server-only
        |-- env.ts                       # leitura validada de env; falha alto no boot
        |-- supabase.ts                  # client com service_role
        |-- repo/                        # espelha src/mock/store.ts função por função, contra o Postgres
        |   |-- leads.ts · mensagens.ts · campanhas.ts · templates.ts · midia.ts
        `-- meta/
            |-- client.ts                # cliente da Cloud API (envio, upload de mídia, templates)
            `-- assinatura.ts            # HMAC-SHA256 de X-Hub-Signature-256, comparação em tempo constante
```

46 `.tsx`, 90 `.ts` (70 de produção + 20 de teste), 20 arquivos de teste — `npm test` dá
205 passando e **14 pulados**: os de paridade `tel_norm11` contra o Postgres, que
esperam banco configurado. 18 rotas em `src/app/api/` mais o `src/middleware.ts`.

## Invariantes

- **Nenhum número digitado em tela.** Toda métrica sai de `src/lib/regras.ts`
  (`getMetrics`). O total de inativos do Dashboard é o mesmo que a régua da
  Reativação encontra, porque ambos chamam `ehInativo` — agora contra o
  Postgres, não mais contra o dataset em memória.
- **A âncora temporal acompanha o calendário** (`ancoraDoDia()` em
  `src/mock/db.ts`, resolvida no load). `src/mock/db.test.ts` trava isso: a
  mensagem mais recente tem de render "Hoje". Vale só para o seed/fixture — o
  servidor usa `new Date()`.
- **Estado operacional não tem cor** — ícone + rótulo em `status-label.tsx`.
- **O ouro tem cinco papéis fechados** e nunca é o CTA. Ver spec §3.2 do
  design de frontend.
- **`telNorm11()` (`src/lib/phoneUtils.ts`) e `tel_norm11(text)` (Postgres,
  `0001_schema.sql`) têm de concordar.** Os casos canônicos vivem em
  `src/lib/telefoneCasos.ts` e são lidos por `telNorm11.test.ts`. O `wa_id` que
  a Meta devolve vem **sem o nono dígito** — é a armadilha documentada no
  canário `553488861441` → `34988861441`.
- **`semAcento()` (`src/lib/texto.ts`) e `sem_acento(text)` (Postgres) são o
  mesmo par**, para busca por nome tolerar acento.
- **Idempotência do webhook é `messages.message_id` UNIQUE.** O mesmo payload
  entregue duas vezes grava uma linha só (`on conflict do nothing`).
- **Status de entrega só avança.** A régua está em `src/lib/statusEntrega.ts`
  (`avancarStatus`, `estadosPromovidosPor`) e entra no `where` do `update`, não
  numa leitura anterior — dois callbacks fora de ordem convergem para o mais
  avançado em vez de o mais lento rebaixar o mais rápido.
- **`podeDisparar(lead)`** (`src/lib/regras.ts`) é a trava contra disparo para
  lead de semente. Os telefones do mock são celulares brasileiros
  estruturalmente válidos com DDD real; disparar para eles é spam a
  desconhecidos. Checada duas vezes de propósito — na montagem do recorte e
  dentro do worker, imediatamente antes da chamada irreversível à Meta.
- **Nenhum índice único do schema é parcial** (`leads_tel_norm_uk`,
  `agendamentos_campanha_lead_uk`): `ON CONFLICT` do PostgREST não infere
  índice parcial (erro 42P10).
- **O browser nunca fala com o Supabase.** Todo `src/server/*` importa
  `server-only` — o build quebra se um componente client tentar importar essa
  camada. RLS fica `deny all` em todas as tabelas como cinto de segurança.
- **A UI atualiza por polling, não Realtime** — `refetchInterval` de 5s na
  lista de conversas, 3s na timeline aberta (spec §3.3). Realtime é upgrade
  registrado no ROADMAP, não reescrita.
