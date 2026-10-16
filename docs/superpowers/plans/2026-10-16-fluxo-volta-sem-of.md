# Fluxo de volta sem Open Finance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar o template `mkt_rtv_volta_02` (trials sem Open Finance, oferta R$49) e fazer "Quero voltar" mandar o link de cupom do template a que o toque responde. Sem submeter à Meta e sem importar leads.

**Architecture:** Dado e regra pura em `src/lib/bot/` (`roteiro.ts` guarda o rascunho e `LINK_CUPOM_POR_TEMPLATE`; `campanhaDoToque.ts` escolhe a campanha pelo histórico). O executor só busca `campanhas.template` e passa o link a `mensagensTerminais`.

**Tech Stack:** Next.js 16 / TypeScript / Vitest / Supabase. Testes com `npx vitest run <arquivo>`.

**Spec:** `docs/superpowers/specs/2026-10-16-fluxo-volta-sem-of-design.md`

## Global Constraints

- Corpo do template exatamente o da spec §2 (R$49).
- Copy (CLAUDE.md): sem travessão nem meia-risca, sem dois-pontos introduzindo frase, sem markdown, sem persona.
- `mensagensTerminais` do volta_01 idêntico ao de hoje: `[LINK_CUPOM, frase]`, com `LINK_CUPOM = 'https://buy.stripe.com/9B6aEW9vi3iz4z6bwAd7q0c'`.
- Não rodar `scripts/criar-template.ts` nem `scripts/importar-leads.ts`.

## Review Focus

1. Toque em volta_01 depois de o lead também ter recebido volta_02 (ou o contrário): `context.id` manda, não a mais recente (Task 2).
2. Toque sem `context.id` (cliente antigo do WhatsApp, simulação): cai na campanha mais recente antes do toque, e sem campanha nenhuma no `LINK_CUPOM` (Tasks 1 e 2).
3. Template `constructor`/`toString` vindo do banco: `Object.hasOwn`, não `in`, cai no `LINK_CUPOM` (Task 1).
4. Link vazio: nunca mensagem vazia nem "link acima" sem link; sai o `FECHO` (Task 1).
5. Rodar `criar-template.ts` sem o nome resubmete todas: comando documentado com o nome (Task 3).

---

### Task 1: Corpo R$49, mapa de links e `mensagensTerminais` com link

**Files:** Modify `src/lib/bot/roteiro.ts`; Test `src/lib/bot/roteiro.test.ts`

**Interfaces — Produces:**
- `export const LINK_CUPOM_POR_TEMPLATE: Record<string, string>`
- `export function linkCupomDoTemplate(template: string | null): string`
- `mensagensTerminais(idP1, idP2, primeiroNome, linkCupom: string = LINK_CUPOM): string[]`

- [ ] **Step 1: Testes que falham**
  - Corpo do volta_02 com "fica R$49 em vez de R$197".
  - `LINK_CUPOM` igual ao literal atual; `LINK_CUPOM_POR_TEMPLATE.mkt_rtv_volta_01` é `LINK_CUPOM`.
  - Guard do volta_02: `toMatch(/^https:\/\/\S+$/)` e não a home (vermelho até o link chegar).
  - `linkCupomDoTemplate`: `'mkt_rtv_volta_01'`, `null`, `'mkt_rtv_isencao_01'`, `'constructor'` → `LINK_CUPOM`; `'mkt_rtv_volta_02'` → valor do mapa.
  - `mensagensTerminais('rtv:voltar', null, 'Rafael', LINK_CUPOM)` igual a sem o 4º argumento.
  - `mensagensTerminais('rtv:voltar', null, 'Rafael', '')` → `[FECHO]`; outros ids ignoram o link.
- [ ] **Step 2:** `npx vitest run src/lib/bot/roteiro.test.ts` → FAIL (exports ausentes, corpo R$97).
- [ ] **Step 3:** Implementar. Link vazio em `rtv:voltar` devolve `[FECHO]`.
- [ ] **Step 4:** Mesmo comando → só o guard do volta_02 vermelho.

### Task 2: `campanhaDoToque` e o executor

**Files:** Create `src/lib/bot/campanhaDoToque.ts` + `.test.ts`; Modify `src/server/repo/mensagens.ts` (`historicoParaBot`), `src/server/bot/executar.ts`

**Interfaces — Produces:**
- `export type MensagemToque = { direction: 'inbound' | 'outbound'; message_id: string | null; reply_to_message_id: string | null; campanha_id: string | null }`
- `export function campanhaDoToque(historico: MensagemToque[], messageIdDoToque: string): string | null`
- `historicoParaBot` passa a devolver `(MensagemBot & MensagemToque)[]`, com `message_id,reply_to_message_id` no `select`.

- [ ] **Step 1: Testes** (`campanhaDoToque.test.ts`): context aponta para campanha A com B mais recente → A; sem context → mais recente antes do toque; context para mensagem fora do histórico ou sem campanha → mais recente; campanha enviada depois do toque é ignorada; sem campanha → `null`; toque fora do histórico → mais recente do histórico inteiro.
- [ ] **Step 2:** FAIL (módulo ausente).
- [ ] **Step 3:** Implementar; no executor, só para terminal `rtv:voltar`: `campanhaDoToque` → `select template from campanhas where id` (`maybeSingle`) → `linkCupomDoTemplate` → 4º argumento de `mensagensTerminais`.
- [ ] **Step 4:** PASS; `npx tsc --noEmit` verde.

### Task 3: ROADMAP e verificação

- [ ] Linha do volta_02 no `ROADMAP.md` passa a dizer R$49, link por template, bloqueio do link vazio (guard vermelho trava o merge) e os dois comandos:
  - `npx tsx scripts/criar-template.ts mkt_rtv_volta_02`
  - `IMPORT_CONFIRMO=sim npx tsx scripts/importar-leads.ts <csv> rtv-lote-2026-10-sof`
- [ ] `npm test` (só o guard do volta_02 vermelho), `npx tsc --noEmit`, `npx eslint src scripts`, `npm run build`.
- [ ] Commits por task, PT-BR.
