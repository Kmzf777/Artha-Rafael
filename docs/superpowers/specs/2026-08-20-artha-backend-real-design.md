# Artha System — backend real (B1 + B2 + B3)

**Data:** 2026-08-20
**Recorte:** persistência em Supabase, WhatsApp Cloud API em produção (envio +
webhook), motor de disparo e criação interna de templates.
**Fora do recorte:** agente de IA (B4), autenticação e importação da base real
(B5). Cada um terá sua própria spec.

---

## 1. Objetivo

Deixar de ser mockup. Ao fim deste recorte, uma mensagem real sai do número
**+55 34 9211-4080**, a resposta do lead entra pelo webhook, aparece na tela de
Conversas, e o operador responde dentro da janela de 24h — tudo gravado em
Postgres.

O objetivo comercial por trás é caixa rápido via reativação da base inativa. A
tela de Conversas já existe e funciona; o que falta é o fio ficar vivo.

---

## 2. Fatos verificados na Graph API (2026-08-20)

Verificados por chamada direta, não presumidos:

| Fato | Valor |
| --- | --- |
| Número | `+55 34 9211-4080` — `CONNECTED`, `VERIFIED`, qualidade `GREEN` |
| Plataforma | `CLOUD_API`, throughput `STANDARD` |
| Token | System user, **permanente** (`expires_at: 0`) |
| Escopos | `whatsapp_business_messaging`, `whatsapp_business_management` |
| WABA | `account_review_status: APPROVED`, `business_verification_status: verified` |
| Envio | **Funciona** — template enviado, `wamid` aceito |
| Webhook | **Não inscrito** — `subscribed_apps` vazio |
| Templates | Só `modelo_teste`, o exemplo genérico da Meta |
| Nome de exibição | `name_status: DECLINED` |

Duas consequências operacionais que precisam chegar ao cliente:

- **`name_status: DECLINED`.** O nome "Artha Finanças Pessoais" foi recusado pela
  Meta. Não bloqueia envio — bloqueia o nome aparecer para o destinatário.
  Precisa ser reenviado para revisão na Business Manager.
- **`messaging_limit_tier` não é exposto pela API para este token.** O motor de
  disparo assume o degrau conservador (250 conversas iniciadas / 24h),
  configurável por env, e conta antes de enviar. Ver §7.3.

### 2.1 A armadilha do nono dígito

Ao enviar para `5534988861441`, a Meta respondeu `wa_id: 553488861441` — **sem o
nono dígito**. A resposta do lead chegará no webhook com 12 dígitos, não 13.
Busca exata por telefone nunca casaria, e a conversa racharia em dois cards.

O projeto já resolveu isso numa encarnação anterior: `telNorm11()` em
`src/lib/phoneUtils.ts` está escrito, testado e documentado com um caso-canário
real. O comentário dela declara o contrato: *"espelha exatamente a função
`tel_norm11(text)` do Postgres — as duas precisam concordar"*.

**Este recorte reusa `telNorm11()` e recria `tel_norm11(text)` no Postgres.** É
requisito duro, não detalhe de implementação. Toda identificação de lead a
partir de um número — webhook, disparo, importação, busca — passa pelas duas.

---

## 3. Arquitetura

### 3.1 Princípio: a forma de fio é o schema

`src/lib/conversationTypes.ts` descreve a forma que os módulos puros preservados
(`timeline`, `listaConversas`, `buscaConversas`, `janela24h`,
`conversationKey`) já consomem — e que é herança direta da tabela `messages` do
backend anterior. A tabela `messages` deste recorte tem **exatamente** essas
colunas.

Consequência: a tela de Conversas e seus seis componentes não mudam. Só o
`queryFn` dos hooks troca de `src/mock/store.ts` para `fetch('/api/…')`. Isso é
o que o CLAUDE.md já previa — *"trocar para um backend depois é cirurgia de
`queryFn`, não reescrita"*.

### 3.2 Camadas

```
browser  ──fetch──▶  src/app/api/*        rotas do App Router
                          │
                          ▼
                     src/server/repo/*    repositório (Postgres via supabase-js)
                          │
                          ├──▶ src/lib/*  regras puras, já testadas (não mudam)
                          └──▶ src/server/meta/*  cliente da Cloud API

Meta  ──POST──▶  /api/webhook  ──▶  repo  ──▶  Postgres
```

- **O browser nunca fala com o Supabase.** Todo acesso ao banco é servidor, com
  `service_role`. Não há chave de banco no cliente, não há RLS para escrever, e
  o painel é interno com poucos operadores. RLS fica em `deny all` como cinto de
  segurança contra acesso direto.
- **`src/server/repo/*` espelha `src/mock/store.ts` função por função**, com as
  mesmas assinaturas. Isso mantém o diff das telas mínimo e deixa o store
  antigo utilizável como fixture de teste.
- **`src/lib/*` não muda.** As regras puras continuam sendo a régua única.

### 3.3 Atualização da UI: polling, não Realtime

Mensagens que entram pelo webhook precisam aparecer na tela. Duas opções:

| | Realtime do Supabase | Polling com react-query |
| --- | --- | --- |
| Custo | anon key no cliente + RLS + canal + reconexão | `refetchInterval` |
| Ganho | latência ~instantânea | latência de 3–5s |

**Escolha: polling.** `refetchInterval` de 5s na lista de conversas e 3s na
timeline aberta, pausado quando a aba perde foco. Para três operadores, a
latência extra é imperceptível e a complexidade economizada é grande. O CLAUDE.md
já registra que o padrão de mutação atual "é o mesmo que o Realtime usaria" — a
troca fica disponível sem reescrita, e vai para o ROADMAP como upgrade.

---

## 4. Schema

Migration única e copiável no SQL Editor do Supabase — sem exigir a CLI, que não
está instalada no ambiente.

### 4.1 Função canônica de telefone

```sql
create or replace function tel_norm11(t text) returns text
```

Espelho exato de `telNorm11()` (§2.1): devolve DDD + nono dígito + assinante (11
dígitos, sem DDI), ou `null` quando não é celular brasileiro reconhecível.
**Nunca fabrica nono dígito para telefone fixo** — isso criaria um celular
inexistente capaz de colidir com o lead de outro contato.

Um teste de paridade roda os mesmos casos do `telNorm11.test.ts` contra o
Postgres. Divergência entre as duas é falha de build.

### 4.2 Tabelas

| Tabela | Papel | Notas |
| --- | --- | --- |
| `leads` | domínio, espelha `Lead` de `src/mock/types.ts` | `tel_norm` gerado por `tel_norm11(telefone)`, **unique** |
| `messages` | forma de fio, colunas de `conversationTypes.ts` | `message_id` (wamid) **unique** — idempotência do webhook |
| `campanhas` | espelha `Campanha` | contadores derivados de `messages`, não digitados |
| `agendamentos` | fila de disparo, espelha `Agendamento` | `+ campanha_id`, `+ variaveis jsonb` |
| `templates` | cache local dos templates da Meta | `+ meta_id`, `+ componentes jsonb` |
| `quick_replies` | respostas rápidas do composer | inalterado |
| `webhook_events` | payload cru recebido | idempotência e depuração |

Não há tabela `conversas`. **A conversa é derivada de `messages`** pela mesma
`conversationKey` que o frontend usa — replicar o agregado em tabela própria
cria duas fontes de verdade que divergem. Não-lidas ficam em
`conversation_reads` (chave do card → instante da última leitura), que é o que
`src/lib/conversationReads.ts` já modela.

### 4.3 Índices que importam

- `messages(message_id)` unique — dedupe do webhook.
- `messages(phone_id, tel_norm11(phone), created_at desc)` — a lista de cards.
- `leads(tel_norm)` unique — lookup do webhook em O(1).
- `agendamentos(status, agendado_para)` — o worker drena por aqui.

---

## 5. B1 — Persistência

### 5.1 Rotas

| Rota | Método | Papel |
| --- | --- | --- |
| `/api/leads` | GET | lista paginada, filtros de `FiltroLeads` |
| `/api/leads/[id]` | PATCH | muda etapa de funil, notas, tags |
| `/api/conversas` | GET | cards + não-lidas |
| `/api/conversas/[key]/mensagens` | GET | timeline |
| `/api/conversas/[key]/lida` | POST | marca lido |
| `/api/metrics` | GET | métricas derivadas |
| `/api/reativacao` | GET | recorte da régua |
| `/api/quick-replies` | GET/POST/DELETE | respostas rápidas |

Filtro, ordenação e paginação vão para SQL — a tabela tem 760 linhas hoje e
milhares depois; filtrar em memória no cliente deixa de servir.

### 5.2 As regras de negócio saem de `src/mock/`

`src/mock/metrics.ts` hospeda `ehInativo`, `diasSemAcesso`, `recorteReativacao`
e `getMetrics` — regras de negócio morando num diretório chamado "mock". Elas
mudam para `src/lib/regras.ts`, puras sobre `Lead[]`, e o servidor as chama com
os leads do banco.

Isso preserva o invariante mais importante da demo: **o total de inativos do
Dashboard é o mesmo que a régua da Reativação encontra, porque os dois chamam
`ehInativo`.** `src/mock/metrics.ts` passa a reexportar de `src/lib/regras.ts`,
para que os testes existentes continuem valendo sem edição.

`src/mock/db.ts` sobrevive como **seed**: o dataset fictício de 760 leads vira a
carga inicial do banco de desenvolvimento, por `scripts/seed.ts`.

---

## 6. B2 — WhatsApp em produção

### 6.1 `GET /api/webhook` — verificação

Compara `hub.verify_token` com `WEBHOOK_VERIFY_TOKEN` e devolve `hub.challenge`
como **texto puro**. Token errado → 403.

### 6.2 `POST /api/webhook` — recebimento

Contrato duro, nesta ordem:

1. **Verifica `X-Hub-Signature-256`** — HMAC-SHA256 do corpo cru com
   `META_APP_SECRET`, comparado em tempo constante. Assinatura inválida → 401,
   sem tocar no banco. Sem isso, qualquer um injeta mensagem no painel.
2. **Grava o payload cru** em `webhook_events`.
3. **Responde 200 imediatamente.** A Meta re-entrega se a resposta demorar mais
   que ~5s ou falhar, e re-entrega gera duplicata. Processamento pesado (baixar
   mídia) não bloqueia a resposta.
4. **Processa por idempotência**: `insert … on conflict (message_id) do nothing`.

Trata dois tipos de evento:

- **`messages`** (entrada) — resolve o lead por `tel_norm11(from)`, criando um
  lead novo quando não existe; grava a mensagem; guarda `contact_name` do
  payload. Mídia: registra `media_id` e agenda o download (§6.4).
- **`statuses`** (entrega) — `sent → delivered → read → failed` casados por
  `wamid`. **Status só avança, nunca retrocede** — a Meta entrega fora de ordem,
  e um `sent` atrasado sobrescrevendo um `read` é um defeito visível na bolha.

### 6.3 `POST /api/mensagens` — envio livre

Texto e mídia. **Recusa com 409 fora da janela de 24h**, calculada pelo
`getWindowStatus()` já existente sobre as mensagens do banco — a checagem é do
servidor, não do botão, porque o cliente pode estar com cache velho.

Grava a mensagem como `outbound` com o `wamid` devolvido pela Meta, que é o que
casa os callbacks de status depois.

### 6.4 Mídia

- **Entrada:** `media_id` do payload → `GET /{media_id}` para a URL → download
  com o token → Supabase Storage → `media_storage_path`. A URL da Meta expira em
  5 minutos e exige o token; servir direto ao browser não funciona.
- **Saída:** upload para `/{PHONE_ID}/media`, depois envio por `id`.

---

## 7. B3 — Disparos e templates

### 7.1 Criação interna de templates

Décima superfície do painel: `templates`. Registrada nos três arquivos que o
CLAUDE.md exige mudarem juntos — `src/lib/tabs.ts`,
`src/app/(app)/page.tsx` e `src/components/Sidebar.tsx`.

A tela edita cabeçalho, corpo com variáveis `{{n}}`, rodapé e botões, com
prévia no frame de telefone que `Disparos.tsx` já desenha. Submete para a Meta
por `POST /{WABA_ID}/message_templates` e grava local como `pendente`; um sync
puxa o status de aprovação.

O erro `132018` encontrado no teste de envio mostra por que a validação tem de
ser local antes de submeter: botão URL estático **não aceita parâmetro**, e a
contagem de `{{n}}` do corpo tem de bater com os exemplos. Ambas as regras
viram validação em `src/lib/templates.ts`, pura e testada.

### 7.2 Fila de disparo

- `POST /api/campanhas` — cria a campanha e enfileira um `agendamento` por lead
  do recorte, com as variáveis já resolvidas por lead.
- `POST /api/fila/processar` — worker. Protegido por `CRON_SECRET` no header.
  Drena os pendentes com `agendado_para <= now()`, envia, grava `wamid`, marca
  status. Falha → `tentativas + 1` e recuo exponencial; três falhas → `falhou`
  com o erro da Meta preservado.

Reentrância: o worker trava as linhas que pegou (`for update skip locked`) antes
de enviar. Duas execuções sobrepostas — que acontecem quando um ciclo demora
mais que o intervalo do cron — não podem disparar a mesma mensagem duas vezes.

### 7.3 Limites

Duas grandezas diferentes, e confundi-las derruba o número:

- **Throughput** — quantas requisições por segundo. `STANDARD` aguenta muito
  mais do que precisamos; o worker espaça mesmo assim (lote de 20, pausa entre
  lotes) para proteger a qualidade do número.
- **Messaging limit** — quantas *conversas iniciadas* por 24h. É o limite que
  importa para 612 leads. Não exposto pela API para este token (§2), então:
  `DISPARO_LIMITE_DIARIO` (default **250**), e o worker **conta as conversas
  iniciadas nas últimas 24h antes de cada lote**. Atingido o teto, para e
  reagenda em vez de queimar qualidade com erro `131049`.

Com 250/dia, 612 leads levam três dias. Isso é informação de planejamento
comercial, e a tela de Disparos precisa mostrar — não descobrir no meio.

---

### 7.4 A trava contra disparo para a semente

Descoberto durante a implementação, e é o risco mais grave do recorte.

Os 760 telefones de `src/mock/db.ts` são gerados como `55` + **DDD real** + `9`
+ oito dígitos: celulares brasileiros estruturalmente válidos, com DDD de
Uberlândia, Belo Horizonte e São Paulo. **Eles pertencem a pessoas reais.**

Seed e produção compartilham o mesmo banco e o mesmo motor de disparo. Sem
defesa, uma campanha rodada num banco semeado manda template real para até 760
desconhecidos — spam, denúncia em massa, qualidade do número destruída e a
operação da Artha morta no primeiro disparo. É irreversível: mensagem enviada
não volta.

Três camadas, porque comentário não é defesa:

1. **`leads.ficticio boolean not null default false`** no schema. O seed grava
   `true`; a base real nasce `false` por omissão.
2. **`podeDisparar(lead)`** em `src/lib/regras.ts` — regra única, pura e
   testada. Chamada na montagem do recorte, para a contagem da tela ser
   honesta.
3. **A mesma regra dentro do worker**, imediatamente antes da chamada à Meta.
   Duplicar a checagem é deliberado: a segunda é a última defesa antes do ponto
   de não-retorno, e falha ali é irreparável. O agendamento bloqueado é marcado
   `falhou` em definitivo, sem retentativa.

Mais: `npm run seed` **recusa rodar** sem `SEED_CONFIRMO=sim`, e imprime o banco
alvo antes de pedir a confirmação.

## 8. Segurança

- Chaves de servidor (`SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_ACCESS_TOKEN`,
  `META_APP_SECRET`, `CRON_SECRET`) **nunca** com prefixo `NEXT_PUBLIC_`.
- Webhook com assinatura verificada (§6.2). Worker com segredo no header.
- RLS `deny all` em todas as tabelas.
- `.env.local` no `.gitignore`. **O token do arquivo `env ARTHA (1).txt`
  circulou em texto puro e deve ser rotacionado na Business Manager** quando o
  cliente puder — o system user token é permanente, então vazamento não expira
  sozinho.

---

## 9. Bloqueios e dependências

| # | Bloqueio | Quem resolve |
| --- | --- | --- |
| 1 | Projeto Supabase não existe; `DATABASE_URL` vazio | **Cliente/gestor** — criar projeto e fornecer `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` |
| 2 | Webhook exige HTTPS público | Dev: túnel `cloudflared` (via npx). Produção: deploy com URL estável |
| 3 | Inscrever o app no webhook da WABA | Automatizável por API depois que a URL existir |
| 4 | Template real de reativação | A tela de §7.1 cria; a aprovação da Meta leva de minutos a 24h |
| 5 | `name_status: DECLINED` | Cliente, na Business Manager |

**Nenhum bloqueio impede começar.** Schema, repositório, rotas, cliente da Meta,
motor de fila, validação de template e a tela de templates são construídos e
testados contra o schema; o item 1 é necessário só para rodar de ponta a ponta.

---

## 10. Critérios de aceitação

Verificáveis, não descritivos:

1. `npm run build`, `npm run lint` e `npm test` limpos.
2. Paridade `telNorm11()` ↔ `tel_norm11(text)` provada por teste sobre os casos
   do canário, incluindo `553488861441` → `34988861441`.
3. Assinatura de webhook inválida → 401 e **zero** linhas gravadas.
4. O mesmo payload entregue duas vezes → **uma** mensagem no banco.
5. `sent` chegando depois de `read` **não** rebaixa o status na bolha.
6. Envio livre fora da janela de 24h → 409 do servidor.
7. Dashboard e Reativação devolvem o mesmo total de inativos, agora contra o
   Postgres.
8. Duas execuções simultâneas do worker → nenhum lead recebe duas vezes.
9. Worker respeita `DISPARO_LIMITE_DIARIO` e reagenda ao atingir o teto.
10. **Ponta a ponta:** disparo de template real para `5534988861441`, resposta do
    lead chega pelo webhook, aparece na tela de Conversas com o lead correto
    (nono dígito reconciliado), e o operador responde dentro da janela.

O critério 10 depende dos bloqueios 1–4. Os critérios 1–9 não.

---

## 11. Fora de escopo

- **B4 — agente de IA.** Depende do JSON do n8n e das três bases de conhecimento
  da Lúcia, não entregues.
- **B5 — auth e base real.** O login segue decorativo; o CSV dos 612 não foi
  entregue.
- **Integração com o CRM próprio do cliente.** A reunião decidiu manter os
  sistemas separados no primeiro momento.
- **Realtime.** Ver §3.3.
- **Nome da persona.** Segue institucional, conforme o CLAUDE.md.
