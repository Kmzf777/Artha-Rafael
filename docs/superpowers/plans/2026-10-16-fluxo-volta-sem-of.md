# Fluxo de volta sem Open Finance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar o template `mkt_rtv_volta_02` (trials expirados sem Open Finance confirmado) em `TEMPLATES_RTV`, com os mesmos botões e respostas do volta_01, travado por teste. Sem submeter à Meta e sem importar leads.

**Architecture:** O rascunho entra em `TEMPLATES_RTV` (`src/lib/bot/roteiro.ts`) via `rascunhoRtv`. Isso basta para `componentesDeBotao` mandar os payloads `rtv:*` e para o bot tratar o toque; nenhum outro código muda. Os testes de `roteiro.test.ts` travam o corpo, as regras de copy e o roteamento.

**Tech Stack:** Next.js 16 / TypeScript / Vitest. Testes com `npx vitest run <arquivo>`.

**Spec:** `docs/superpowers/specs/2026-10-16-fluxo-volta-sem-of-design.md`

## Global Constraints

- Corpo do template exatamente o da spec §2 (quatro parágrafos separados por linha em branco).
- Copy (CLAUDE.md): sem travessão nem meia-risca, sem dois-pontos introduzindo frase, sem markdown, sem persona (Lúcia, Clara, LucIA).
- Não mexer em `RTV_BOTOES`, `RESPOSTA_POR_ID`, `LINK_CUPOM`, tags, nem no `mkt_rtv_volta_01`.
- Não rodar `scripts/criar-template.ts` nem `scripts/importar-leads.ts`.

## Review Focus

1. Alguém roda `npx tsx scripts/criar-template.ts` SEM o nome e resubmete todas as variantes, inclusive a aprovada: o comando documentado leva o nome explícito (Task 1, ROADMAP).
2. Dois-pontos introduzindo frase entra numa revisão futura da copy do ramo: o teste de regras de escrita do ramo passa a checar `:` seguido de espaço ou fim de linha (Task 1).
3. Meia-risca (U+2013) na copy do ramo: o teste do ramo hoje só checa U+2014; passa a usar `TRAVESSAO` (Task 1).
4. Volta_02 com payload diferente do volta_01: teste compara `componentesDeBotao` dos dois (Task 1).
5. "Sai de graça" disparar a trava de "teste grátis": o teste existente cobre; tem de continuar verde sem afrouxar o regex (Task 1).

---

### Task 1: Registrar `mkt_rtv_volta_02` e travar por teste

**Files:**
- Modify: `src/lib/bot/roteiro.ts` (entrada nova em `TEMPLATES_RTV`, depois de `mkt_rtv_volta_01`)
- Test: `src/lib/bot/roteiro.test.ts`
- Modify: `ROADMAP.md` (uma linha)

**Interfaces:**
- Produces: `TEMPLATES_RTV.mkt_rtv_volta_02` com o formato de `rascunhoRtv`.
- Consumes: `componentesDeBotao(nome: string)` de `src/lib/templates.ts`; `mensagensTerminais`, `RTV_IDS`.

- [ ] **Step 1: Testes que falham** em `roteiro.test.ts`

  - `'são quatro'` vira `'são cinco'` com `toHaveLength(5)`.
  - No teste `'a copy do ramo segue as regras de escrita do gestor'`: trocar `/—/` por `TRAVESSAO` e acrescentar `expect(t, 'sem dois-pontos introduzindo frase').not.toMatch(/:(\s|$)/m)`.
  - `describe('mkt_rtv_volta_02 (sem Open Finance)')`:
    - corpo igual à constante com o texto exato da spec §2;
    - não afirma banco conectado: `not.toMatch(/conectou|reconectar/i)`;
    - `componentesDeBotao('mkt_rtv_volta_02')` igual a `componentesDeBotao('mkt_rtv_volta_01')`, e os payloads são `RTV_IDS`;
    - para cada id de `RTV_IDS`, `mensagensTerminais(id, null, 'Ana')` é a mesma lista que o volta_01 produz (o roteamento é por id, então o teste prova que o payload do volta_02 aponta para os mesmos terminais).

- [ ] **Step 2:** `npx vitest run src/lib/bot/roteiro.test.ts` → FAIL (`são cinco`, corpo `undefined`).

- [ ] **Step 3:** entrada `mkt_rtv_volta_02: rascunhoRtv('mkt_rtv_volta_02', [...])` com as linhas da spec §2 e comentário de uma linha sobre o público.

- [ ] **Step 4:** `npx vitest run src/lib/bot/roteiro.test.ts src/lib/templates.test.ts` → PASS.

- [ ] **Step 5:** linha no `ROADMAP.md` com os dois comandos pendentes:
  - `npx tsx scripts/criar-template.ts mkt_rtv_volta_02` (com o nome; sem ele submete todas)
  - `IMPORT_CONFIRMO=sim npx tsx scripts/importar-leads.ts <csv> rtv-lote-2026-10-sof`

- [ ] **Step 6: Verificação completa:** `npm test`, `npx tsc --noEmit`, `npx eslint src scripts`, `npm run build` verdes.

- [ ] **Step 7: Commit**

```bash
git add src/lib/bot/roteiro.ts src/lib/bot/roteiro.test.ts ROADMAP.md
git commit -m "Registra mkt_rtv_volta_02 para trials sem Open Finance"
```
