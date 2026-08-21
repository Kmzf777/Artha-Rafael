# Plano — Artha System: frontend de demonstração

**Spec:** `docs/superpowers/specs/2026-08-17-artha-system-frontend-design.md`
**Data:** 2026-08-17
**Status:** Aprovado antecipadamente pelo gestor. Execução por subagentes.

---

## Regras válidas para toda tarefa

1. **Ler antes de escrever:** `DESIGN.md` (raiz) e a spec desta feature, inteiros. O DESIGN.md
   é a autoridade estética; a spec resolve suas duas contradições internas e define o acento.
2. **Todo agente que toca frontend invoca a skill `frontend-design`** antes de escrever JSX.
3. **shadcn/ui sobre `@base-ui/react`, não Radix.** Não existe `asChild` — usa-se
   `render={<elemento />}`. Componente novo: preferir compor a partir de `src/components/ui/*`;
   se precisar de primitivo inexistente, `npx shadcn@latest add <nome>`. Se o CLI travar,
   pedir input ou falhar, escrever à mão seguindo o idioma dos arquivos vizinhos
   (base-ui + `cva` + `cn`) — nunca deixar a tarefa pela metade por causa do CLI.
4. **Só tokens.** Zero literal de cor, raio, espaçamento ou tamanho de fonte no JSX.
   Se falta um token, o certo é reportar, não inventar hex.
5. **Nenhum backend.** Zero import de `@supabase/*`, `metaApi`, rota de API. Dados vêm de
   `src/mock/`.
6. **Nenhum nome de persona** (Lúcia / Clara / LucIA) em copy de mensagem. Voz institucional Artha.
7. **Não editar arquivo fora do escopo declarado da sua tarefa.** Colisão de arquivo entre
   agentes simultâneos é o modo de falha mais caro deste plano.
8. Ao terminar: rodar `npx tsc --noEmit` e `npm run lint` e relatar a saída real. Não afirmar
   sucesso sem ter visto o comando passar.

---

## Onda 1 — fundação (2 agentes em paralelo)

### T1 · Sistema de design, shell e limpeza

**Possui:** `src/app/**` (exceto `api/`, que apaga), `src/components/ui/**`,
`src/components/Sidebar.tsx`, `src/lib/tabs.ts`, `middleware.ts`, `scraper/`, `supabase/`,
`docs/adr/`, `docs/agents/`, `docs/painel-executivo/`, `docs/superpowers/{specs,plans}/2026-0[6-7]-*`,
raiz (`package.json`, `CLAUDE.md`, `CONTEXT.md`, `ROADMAP.md`, `TREE.md`, os dois docs de API de
terceiro), e os `src/lib/*` listados como remoção na spec §2, mais
`src/components/{Erros,Instances}.tsx` e `src/components/conversations/CopilotSummary.tsx`.

1. Executar todas as remoções da spec §2, com os `.test.ts` correspondentes.
2. `src/app/globals.css`: substituir a paleta OKLCH "Carta Náutica" pelos tokens da spec §3.3 —
   `:root` claro e `.dark` escuro, incluindo o acento Ouro Artha e os cinco valores derivados.
   Escala de tipo, raio, espaçamento e elevação como tokens. No escuro, elevação é borda.
3. `src/app/layout.tsx`: Inter via `next/font/google` (400/500/700), `ss01` na classe de display;
   `ThemeProvider` do `next-themes` com `attribute="class"` e sem flash no boot. Manter o
   `TooltipProvider` que já existe. Remover as três famílias antigas.
4. Re-skin de **todo** `src/components/ui/*` para o chrome da spec §3.4: pílula 999px em tudo
   que é interativo, card 16px, input 8px, tabela com cabeçalho `--canvas-soft`, Level 0 flat
   como padrão. Altura mínima de 44px em elemento interativo.
5. `Sidebar.tsx`: logo Artha, nove abas, linha ativa com barra de 3px em `--accent` na borda
   esquerda, alternador de tema e menu de usuário no rodapé. Sem gate de admin (não há auth).
6. **Ponto crítico de colisão:** registrar em `src/lib/tabs.ts` e no switch de render de
   `src/app/(app)/page.tsx` **as nove abas de uma vez**, importando os componentes de tela que
   a Onda 2 vai preencher. Criar `src/components/Reativacao.tsx` como placeholder mínimo. As
   telas existentes ficam como estão — a Onda 2 as reescreve. Nenhum agente da Onda 2 toca
   `page.tsx` nem `tabs.ts`.
7. `package.json` name → `artha-system`. Reescrever `CLAUDE.md`, `CONTEXT.md`, `ROADMAP.md` e
   `TREE.md` para o projeto Artha, sem herança de crédito consignado nem a nota de git/deploy
   da Mar Azul.

**Verificar:** `npx tsc --noEmit` sem erro (placeholders contam), `npm run lint` limpo,
`npm run dev` sobe e o shell navega entre as nove abas nos dois temas.

### T2 · Camada de dados fictícios

**Possui:** `src/mock/**` (novo), `src/hooks/**`.

1. Implementar o contrato de tipos da spec §4.1 em `src/mock/types.ts`.
2. `src/mock/db.ts`: dataset com os volumes da spec §4.2 — 760 leads (148 ativos / 612
   inativos), 14 conversas com thread real incluindo uma sequência completa de reativação,
   6 campanhas, 40 agendamentos, 5 templates. Semente determinística, data-âncora exportada,
   zero `Math.random()`/`Date.now()` em render.
3. `src/mock/store.ts`: store em memória com mutação (enviar mensagem, mudar etapa de lead,
   enfileirar campanha).
4. `src/mock/metrics.ts`: `getMetrics()` **derivado do dataset**. O total de inativos do
   Dashboard tem de ser exatamente o que a régua da Reativação encontra. Número divergente
   entre telas é o defeito mais grave possível nesta demo.
5. Reescrever `useConversations`, `useConversationMessages`, `useConversationData`,
   `useMessageSender` mantendo **assinatura idêntica**, com `@tanstack/react-query` e `queryFn`
   lendo do store; mutação grava no store e atualiza cache via `queryClient.setQueryData`.
   Status de saída progride enviado → entregue → lido.
6. Apagar `useCopilot.ts`, `useOperationalErrors.ts`, `useIsAdmin.ts`, `useAudioRecorder.ts`.
7. Expor hooks novos que a Onda 2 vai consumir: `useLeads` (com filtro e paginação),
   `useCampanhas`, `useAgendamentos`, `useTemplates`, `useReativacaoRecorte`, `useMetrics`.

**Verificar:** `npx tsc --noEmit` limpo. Teste unitário de `getMetrics()` provando que
ativos + inativos = 760 e que a régua de inativos devolve 612.

---

## Onda 2 — telas (7 agentes em paralelo, arquivos disjuntos)

Cada agente possui **somente** os arquivos listados. Nenhum toca `page.tsx`, `tabs.ts`,
`globals.css`, `src/components/ui/*`, `src/mock/*` ou `src/hooks/*`.

| Tarefa | Tela | Arquivos que possui |
| --- | --- | --- |
| T3 | Dashboard | `src/components/Dashboard.tsx` |
| T4 | Conversas | `src/components/Conversations.tsx`, `src/components/conversations/*`, `MessageBubble.tsx`, `MediaLabel.tsx`, `QuickRepliesManager.tsx` |
| T5 | Leads | `src/components/Leads.tsx` |
| T6 | Disparos e Agendamentos | `src/components/{Disparos,Agendamentos,SendDisparoDialog,SendContactDialog}.tsx` |
| T7 | Reativação | `src/components/{Reativacao,EnqueueReativacaoDialog}.tsx` |
| T8 | Relatórios e Executivo | `src/components/{Reports,ExecutiveReport}.tsx` |
| T9 | Login e Configurações | `src/app/(auth)/**`, `src/components/AccountInfo.tsx` |

Requisitos por tela: spec §5. T8 também invoca a skill `dataviz` e obedece o teto de **3 séries
por gráfico**, série primária em `--accent`, demais em rampa de opacidade de `--ink`, distinção
por padrão de preenchimento, rótulo direto, **SVG inline sem Recharts**.

**Verificar, por agente:** `npx tsc --noEmit` limpo, `npm run lint` limpo, a tela renderiza nos
dois temas sem erro de console, contraste ≥4,5:1 em texto normal e ≥3:1 em componente de UI.

---

## Onda 3 — integração (feita pelo orquestrador, não por subagente)

1. `npm run build`, `npm run lint`, `npm test` — os três limpos.
2. Varredura de conformidade: nenhum literal de cor/raio/tamanho de fonte no JSX das telas;
   nenhum import de `@supabase/*` ou `metaApi`; nenhum nome de persona em copy.
3. Consistência numérica entre Dashboard e Reativação.
4. Passar as nove telas nos dois temas.
5. `TREE.md` atualizado com a estrutura final real.

### Débitos levantados pelas Ondas 1 e 2 — resolver aqui

**P1 — a demo envelhece em 24h.** `ANCORA_ISO` em `src/mock/db.ts` está fixa em
`2026-08-17T15:00:00.000Z`, mas `formatMsgTime` e `formatSectionDate` em `src/lib/format.ts`
chamam `isToday`/`isYesterday` contra o **relógio do sistema**. Hoje é 2026-08-17 e funciona;
em qualquer outra data toda mensagem vira "17/08/26" e nunca "Hoje"/"Ontem" — o thread inteiro
fica visivelmente velho na frente do cliente. Correção: derivar `ANCORA` da data corrente **no
carregamento do módulo** (não em render, para não violar a pureza), mantendo todos os offsets
fixos. Rodar `npm test` depois: as asserções de contagem sobrevivem porque são calculadas a
partir dos offsets; asserções de data absoluta, se houver, precisam mudar junto.

Não foi feito durante a Onda 2 de propósito: sete agentes rodavam `npm test` ao mesmo tempo e
quebrar a suíte no meio do voo os faria perseguir erro alheio.

**P2 — dependências mortas em `package.json`.** `@supabase/ssr`, `@supabase/supabase-js`,
`@ffmpeg-installer/ffmpeg`, `fluent-ffmpeg`, `@types/fluent-ffmpeg`, `@vercel/functions`
ficaram sem uso após a limpeza. Remover e rodar `npm install` para ressincronizar o lockfile.

**P3 — herança de crédito consignado em módulos preservados.** `buscaConversas.ts` ainda
declara `cpf: string | null`, `MatchTipo` ainda inclui `'cpf'` e `ROTULO_MATCH.cpf = 'CPF'`.
`quickReplies.ts` tem um ramo `{cpf}` morto em `applyLeadVariables`. `format.ts` tem `maskCpf`
morto. Não existe CPF neste negócio — remover, com os testes correspondentes.

**P4 — `timeline.ts` não é genérico.** `agruparPorData(mensagens: Message[])` descarta o campo
`status` no tipo, o que obrigou o T2 a contornar com um helper `statusDe(id)`. Ideal:
`agruparPorData<T extends { id: string; created_at: string }>(msgs: T[])`.

**P5 — `scheduling.ts` fala inglês.** `ScheduledStatus` é
`'pending'|'processing'|'sending'|'sent'|'failed'|'canceled'`, incompatível com o
`AgendamentoStatus` português da spec §4.1. Hoje convivem os dois. Unificar no português.

**P7 — falta hairline para superfície invertida.** `--hairline` claro sobre `--ink` preto dá
~15:1: linha quase branca, forte demais para divisor. T9 resolveu com `border-on-ink/20`
(derivado do token da superfície, simétrico nos dois temas). Se uma segunda tela precisar do
mesmo, promover a `--hairline-on-ink` em vez de repetir a derivação.

**P8 — input aninhado em card soft é quase invisível.** `--canvas-softer` sobre `--canvas-soft`
no tema claro dá **1,03:1**. Num sistema sem borda de input, é o rótulo que identifica o
controle. **Regra:** todo input dentro de `card-soft-tinted` tem rótulo visível. Se aparecer
input sem rótulo nesse contexto, ele precisa de borda.

**P6 — nomes de tamanho do Button mentem.** `xs`, `sm`, `icon-xs` e `icon-sm` todos renderizam
44px por causa da regra de alvo de toque da spec §3.4. A API sugere densidade que não existe.
Se algum agente de tela relatar tabela apertada, é a spec que precisa ser revisitada.

## Critérios de aceite

Os dez da spec §6.
