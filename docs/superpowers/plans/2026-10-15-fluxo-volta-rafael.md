# Fluxo de volta do Rafael Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Os três botões do template `mkt_rtv_volta_01` passam a fazer o que o Rafael pediu: "Quero voltar" manda o link com cupom e a frase de prazo, "Preciso de ajuda" entrega a gente, "Não quero receber" agradece pelo nome e faz opt-out. A triagem sai.

**Architecture:** Toda decisão continua pura em `src/lib/bot/` (`roteiro.ts` guarda copy e ids; `estado.ts` deriva o passo do histórico). `mensagemTerminal` vira `mensagensTerminais`, que devolve a LISTA de mensagens em ordem, com o vocativo resolvido. O executor (`src/server/bot/executar.ts`) só busca o nome do lead e envia a lista em ordem.

**Tech Stack:** Next.js 16 / TypeScript / Vitest. Rodar testes com `npx vitest run <arquivo>`.

**Spec:** `docs/superpowers/specs/2026-10-15-fluxo-volta-rafael-design.md`

## Global Constraints

- Copy de mensagem (CLAUDE.md, travado em `roteiro.test.ts`): sem travessão nem meia-risca, sem dois-pontos introduzindo frase, sem markdown, link sozinho na linha (aqui: sozinho na MENSAGEM).
- Nenhum nome de persona (Lúcia, Clara, LucIA) em copy.
- Textos do Rafael verbatim, só com o nome trocado pelo vocativo:
  - `Ótimo{vocativo}. É só você clicar no link acima e fazer a sua inscrição. Já estará com o cupom aplicado. Mas o cupom é válido somente hoje, ok?`
  - `Obrigado pelo retorno{vocativo}. Se precisar de ajuda com as finanças, fale comigo.`
- Vocativo: `, <primeiro nome>` quando há nome; vazio quando o nome é nulo, vazio ou começa com `+`.
- Tags: `rtv:voltar` → `rtv-quer-voltar`; `rtv:problema` → `rtv-precisa-ajuda`; `rtv:sair` → `rtv-optout` (inalterada).
- Mudanças cirúrgicas: não mexer nos rascunhos `mkt_rtv_isencao_01`, `_trial_01`, `_pergunta_01`, nem em `mkt_rtv_volta_01`.

## Review Focus

1. Lead sem cadastro (`nome` = `+5534…`) aperta "Quero voltar": tem de ler "Ótimo. É só…", nunca "Ótimo, +5534…". (Task 1, teste de `mensagensTerminais`.)
2. Segundo toque em "Quero voltar" depois do link: tem de calar, não mandar o link de novo. (Task 1, teste de `estado`.)
3. Lead que escreve texto livre depois de qualquer um dos três botões: cala, não recebe a p1 de segmentação. (Task 1.)
4. Falha da Meta no meio das duas mensagens de "Quero voltar": a qualificação já foi gravada antes (ordem do executor preservada). (Task 2, revisão de ordem.)
5. `LINK_CUPOM` vazio indo para produção: o teste de guarda fica vermelho. (Task 3.)

---

### Task 1: Roteiro sem triagem, três terminais e `mensagensTerminais`

**Files:**
- Modify: `src/lib/bot/roteiro.ts`
- Modify: `src/lib/bot/estado.ts`
- Modify: `src/lib/botoesDaConversa.ts:17,33`
- Test: `src/lib/bot/roteiro.test.ts`, `src/lib/bot/estado.test.ts`, `src/lib/botoesDaConversa.test.ts`

**Interfaces:**
- Produces:
  - `export const LINK_CUPOM: string` (vazio nesta task; Task 3 trava)
  - `export function mensagensTerminais(idP1: string | null, idP2: string | null, primeiroNome: string | null): string[]`
  - `export function ehIdRtv(id: string | null): boolean` (continua existindo; passa a ser o único predicado do ramo)
- Removed: `RTV2`, `RTV2_POR_RTV1`, `ehIdRtv1`, `ehIdRtv2`, `perguntaRtv2`, `ehTerminalRtv`, `mensagemTerminal`, ids `rtv2:*` e suas respostas/tags.

- [ ] **Step 1: Ajustar os testes de `roteiro.test.ts`**

Remover dos imports: `RTV2`, `perguntaRtv2`, `ehIdRtv1`, `ehIdRtv2`, `ehTerminalRtv`, `mensagemTerminal`. Importar `mensagensTerminais`, `ehIdRtv`, `LINK_CUPOM`.

`TERMINAIS` passa a incluir o ramo inteiro:

```ts
const TERMINAIS = [
  ...P1.botoes.map((b) => b.id).filter((id) => !(id in P2_POR_RAMO)),
  ...Object.values(P2_POR_RAMO).flatMap((p) => p.botoes.map((b) => b.id)),
  ...RTV_IDS,
]
```

Atualizar o comentário acima dela (o parágrafo sobre `ehTerminalRtv` e triagem sai; os três botões do template são terminais).

Trocar o `describe('mensagemTerminal', …)` inteiro por:

```ts
describe('mensagensTerminais', () => {
  it('devolve a resposta do id de nível 2', () => {
    expect(mensagensTerminais('p1:artha', 'p2:artha_preco', null)).toEqual([RESPOSTA_POR_ID['p2:artha_preco']])
  })

  it('cai no id de nível 1 quando não há nível 2', () => {
    expect(mensagensTerminais('p1:outro', null, null)).toEqual([FECHO])
  })

  it('devolve o fecho para quem encaminha', () => {
    expect(mensagensTerminais('p1:dhana', 'p2:dhana_demo', null)).toEqual([FECHO])
    expect(mensagensTerminais('p1:dhana', 'p2:humano', null)).toEqual([FECHO])
    expect(mensagensTerminais('rtv:problema', null, 'Rafael')).toEqual([FECHO])
  })

  it('id desconhecido cai no fecho, nunca em silêncio', () => {
    expect(mensagensTerminais(null, null, null)).toEqual([FECHO])
    expect(mensagensTerminais('p1:artha', 'p2:inexistente', null)).toEqual([FECHO])
  })

  it('Quero voltar manda o link sozinho e depois a frase, com o nome', () => {
    expect(mensagensTerminais('rtv:voltar', null, 'Rafael')).toEqual([
      LINK_CUPOM,
      'Ótimo, Rafael. É só você clicar no link acima e fazer a sua inscrição. Já estará com o cupom aplicado. Mas o cupom é válido somente hoje, ok?',
    ])
  })

  it('Não quero receber agradece pelo nome', () => {
    expect(mensagensTerminais('rtv:sair', null, 'Rafael')).toEqual([
      'Obrigado pelo retorno, Rafael. Se precisar de ajuda com as finanças, fale comigo.',
    ])
  })

  it('sem nome, a frase perde o vocativo e não sobra vírgula', () => {
    for (const nome of [null, '', '   ', '+5534999990000']) {
      const [, frase] = mensagensTerminais('rtv:voltar', null, nome)
      expect(frase, String(nome)).toMatch(/^Ótimo\. É só você/)
      expect(mensagensTerminais('rtv:sair', null, nome)[0], String(nome)).toMatch(/^Obrigado pelo retorno\. Se/)
    }
  })

  it('o placeholder {vocativo} nunca vaza', () => {
    for (const id of Object.keys(RESPOSTA_POR_ID)) {
      for (const m of mensagensTerminais(id, null, 'Ana')) expect(m).not.toContain('{vocativo}')
    }
  })
})
```

No `describe('ramo rtv …')`: o teste `'mensagemTerminal resolve um id rtv pelo idP1'` vira

```ts
  it('mensagensTerminais resolve um id rtv pelo idP1', () => {
    expect(mensagensTerminais('rtv:sair', null, null)).toEqual([
      'Obrigado pelo retorno. Se precisar de ajuda com as finanças, fale comigo.',
    ])
  })
```

Trocar o `describe('triagem do ramo rtv', …)` inteiro por:

```ts
describe('terminais do ramo rtv', () => {
  it('os três botões do template são terminais e conhecidos', () => {
    for (const id of RTV_IDS) {
      expect(ehIdRtv(id), id).toBe(true)
      expect(ehIdConhecido(id), id).toBe(true)
    }
    expect(ehIdRtv(null)).toBe(false)
    expect(ehIdRtv('p1:artha')).toBe(false)
  })

  it('ids da triagem antiga deixaram de existir', () => {
    for (const id of ['rtv2:preco', 'rtv2:tecnico', 'rtv2:duvida']) {
      expect(ehIdConhecido(id), id).toBe(false)
      expect(RESPOSTA_POR_ID[id], id).toBeUndefined()
      expect(TAG_POR_RESPOSTA[id], id).toBeUndefined()
    }
  })

  it('cada botão tem a tag combinada', () => {
    expect(TAG_POR_RESPOSTA['rtv:voltar']).toBe('rtv-quer-voltar')
    expect(TAG_POR_RESPOSTA['rtv:problema']).toBe('rtv-precisa-ajuda')
    expect(TAG_POR_RESPOSTA['rtv:sair']).toBe('rtv-optout')
  })

  it('Preciso de ajuda encaminha, não responde', () => {
    expect(IDS_QUE_ENCAMINHAM.has('rtv:problema')).toBe(true)
    expect(RESPOSTA_POR_ID['rtv:problema']).toBeUndefined()
  })
})
```

Nos testes `'nenhuma copy do ramo cita nome de persona'` e `'a copy do ramo segue as regras de escrita do gestor'`, trocar as linhas com `RTV2` por:

```ts
      ...RTV_IDS.flatMap((id) => mensagensTerminais(id, null, 'Ana')),
```

No mesmo teste de regras, a checagem de link por linha já cobre o `LINK_CUPOM` (vazio passa; preenchido tem de ser só a URL).

- [ ] **Step 2: Ajustar `estado.test.ts`**

Remover `RTV2` do import. Nos testes 36 e 38, os laços passam a cobrir os três ids:

```ts
    for (const id of ['rtv:voltar', 'rtv:problema', 'rtv:sair']) {
```

Atualizar o comentário do teste 36 (a frase sobre `rtv:voltar` ter saído em 2026-09-28 sai; os três botões são terminais desde 2026-10-15).

Apagar os testes 38b, 39, 40, 41, 42 e 43 (todos descrevem a triagem). No lugar, adicionar:

```ts
  it('39. quem aperta Quero voltar encerra com fecho, como os outros dois', () => {
    expect(proximoPasso([disparo(), doTemplateRtv('rtv:voltar')])).toEqual({
      acao: 'encerrar',
      idP1: 'rtv:voltar',
      idP2: null,
      comFecho: true,
    })
  })

  it('40. botão da triagem antiga numa conversa velha não reabre nada', () => {
    // Conversa de teste de 2026-10-06 tem `rtv2:preco` gravado. O id deixou de
    // ser conhecido: entra pela regra de id desconhecido, que encerra sem fecho.
    const passo = proximoPasso([disparo(), doTemplateRtv('rtv:voltar'), doBot(), botao('rtv2:preco')])
    expect(passo.acao).toBe('calar')
  })
```

E o teste 44 passa a iterar os três ids (`'rtv:voltar', 'rtv:problema', 'rtv:sair'`), com o título `'44. os três botões do nível 1 encerram em um toque'`.

Nota para o teste 40: depois de `rtv:voltar` (terminal) qualquer inbound seguinte cala pela regra "respondido um terminal do ramo, o roteiro acabou". Se a execução mostrar outro resultado, NÃO mude a expectativa sem antes ler `proximoPasso`: calar é o comportamento certo.

- [ ] **Step 3: Rodar os testes e confirmar que falham**

Run: `npx vitest run src/lib/bot/roteiro.test.ts src/lib/bot/estado.test.ts`
Expected: FAIL (imports inexistentes, `mensagensTerminais` não definida).

- [ ] **Step 4: Implementar em `roteiro.ts`**

1. Apagar o bloco da triagem inteiro: o docblock "A TRIAGEM", `RTV2`, o docblock "Quem ABRE a triagem", `RTV2_POR_RTV1`, `IDS_RTV2`, `ehIdRtv1`, `ehIdRtv2`, `perguntaRtv2`, o docblock e a função `ehTerminalRtv`. Ficam:

```ts
const IDS_RTV = new Set(RTV_IDS)

/** Os três botões do template. Desde 2026-10-15 os três encerram o roteiro. */
export function ehIdRtv(id: string | null): boolean {
  return id !== null && IDS_RTV.has(id)
}
```

Conferir se `ehIdConhecido` usa `ehIdRtv` (já usa ou usava `ehIdRtv1 || ehIdRtv2` via `ehIdRtv`); ajustar para `ehIdRtv(id)`.

2. Logo abaixo de `ID_OPTOUT`, adicionar:

```ts
/**
 * O link de inscrição com o cupom já aplicado, mandado pelo Rafael. Vazio até
 * ele mandar, e há um teste que fica vermelho enquanto estiver vazio: mandar
 * https://artha.ia.br sob "já estará com o cupom aplicado" seria afirmar ao
 * cliente uma coisa falsa. Spec 2026-10-15 §3.3.
 */
export const LINK_CUPOM = ''
```

3. Em `RESPOSTA_POR_ID`: apagar o comentário "A triagem responde e entrega…" e as três chaves `rtv2:*`; apagar `'rtv:problema'`; trocar `'rtv:sair'`; adicionar `'rtv:voltar'`:

```ts
  // Textos do Rafael (cliente), 2026-10-15. `{vocativo}` vira ", Nome" ou some.
  // O link de `rtv:voltar` sai ANTES, em mensagem própria: ver `mensagensTerminais`.
  'rtv:voltar':
    'Ótimo{vocativo}. É só você clicar no link acima e fazer a sua inscrição. Já estará com o cupom aplicado. Mas o cupom é válido somente hoje, ok?',

  'rtv:sair': 'Obrigado pelo retorno{vocativo}. Se precisar de ajuda com as finanças, fale comigo.',
```

4. `IDS_QUE_ENCAMINHAM` ganha `'rtv:problema'`:

```ts
export const IDS_QUE_ENCAMINHAM = new Set(['p1:outro', 'p2:dhana_demo', 'p2:humano', 'rtv:problema'])
```

5. `TAG_POR_RESPOSTA`: apagar as três `rtv2:*`, trocar `'rtv:problema': 'rtv-teve-problema'` por `'rtv:problema': 'rtv-precisa-ajuda'` e adicionar `'rtv:voltar': 'rtv-quer-voltar'`.

6. Trocar `mensagemTerminal` por:

```ts
/** `, Nome` para quem tem nome de verdade. Lead criado sem cadastro tem `+55…`. */
function vocativo(primeiroNome: string | null): string {
  const nome = primeiroNome?.trim() ?? ''
  return nome && !nome.startsWith('+') ? `, ${nome}` : ''
}

/**
 * As mensagens que encerram o roteiro, em ordem. Quase sempre uma; "Quero
 * voltar" manda o link sozinho antes da frase que diz "clicar no link acima".
 */
export function mensagensTerminais(
  idP1: string | null,
  idP2: string | null,
  primeiroNome: string | null
): string[] {
  const id = idP2 ?? idP1
  const texto = ((id ? RESPOSTA_POR_ID[id] : undefined) ?? FECHO).replace('{vocativo}', vocativo(primeiroNome))
  return id === 'rtv:voltar' ? [LINK_CUPOM, texto] : [texto]
}
```

7. Apagar comentários que agora mentem: o trecho do docblock de `TEMPLATES_RTV`/`RTV_BOTOES` que fala em triagem, se houver; qualquer menção a "Tive um problema".

- [ ] **Step 5: Implementar em `estado.ts`**

1. Imports: remover `ehIdRtv1`, `ehIdRtv2`, `ehTerminalRtv`, `perguntaRtv2`; importar `ehIdRtv`.
2. A regra "RESPONDIDO UM TERMINAL DO RAMO" passa a usar `ehIdRtv(m.button_id)`. Reescrever o comentário: os três botões são terminais; tirar a menção a "Tive um problema"/"me conta o que travou" e o parágrafo sobre `ehTerminalRtv` vs `ehIdRtv`.
3. A PORTA DE CAMPANHA vira:

```ts
  // PORTA DE CAMPANHA. Spec 2026-09-26 §5.2, nível único desde 2026-10-15.
  //
  // Vem antes do portão de primeiro contato de propósito. O disparo grava
  // autoria nula, então `ehDoBot` é falso e o portão abaixo trataria este
  // inbound como primeiro contato — devolvendo a P1 de segmentação para quem
  // acabou de apertar "Quero voltar".
  if (ehIdRtv(ultima.button_id)) {
    return { acao: 'encerrar', idP1: ultima.button_id, idP2: null, comFecho: true }
  }
```

(apagar o `reduce` de `idRtv1`, o ramo `ehIdRtv2` e o ramo `ehIdRtv1` com `perguntaRtv2`).

4. No fim, o fallback de repetição volta a ser:

```ts
  const pendente = idP1 ? (perguntaP2(idP1) ?? P1) : P1
  return { acao: 'repetir', pergunta: pendente }
```

(apagar o comentário "A triagem vem primeiro…").

- [ ] **Step 6: `botoesDaConversa.ts` e seu teste**

Em `src/lib/botoesDaConversa.ts`: remover `RTV2` do import e de `PERGUNTAS` (`const PERGUNTAS: Pergunta[] = [P1, ...Object.values(P2_POR_RAMO)]`). Em `botoesDaConversa.test.ts`: remover `RTV2` do import, apagar o teste que usa `pergunta(RTV2.corpo)` (linhas ~119-122) e tirar `RTV2` da lista da linha ~130. NÃO mexer na fixture da linha ~42 (`'Tive um problema'`): ela é histórico gravado, não roteiro.

- [ ] **Step 7: Rodar os testes**

Run: `npx vitest run src/lib/bot src/lib/botoesDaConversa.test.ts`
Expected: PASS. (`src/server/bot/executar.ts` ainda importa `mensagemTerminal` e `ehTerminalRtv`; isso quebra o type-check e é a Task 2. Vitest não compila o executor.)

- [ ] **Step 8: Commit**

```bash
git add src/lib/bot/roteiro.ts src/lib/bot/roteiro.test.ts src/lib/bot/estado.ts src/lib/bot/estado.test.ts src/lib/botoesDaConversa.ts src/lib/botoesDaConversa.test.ts
git commit -m "Roteiro rtv sem triagem: tres terminais com os textos do Rafael"
```

---

### Task 2: Executor envia a lista, com o nome do lead

**Files:**
- Modify: `src/server/bot/executar.ts`

**Interfaces:**
- Consumes: `mensagensTerminais(idP1, idP2, primeiroNome): string[]`, `ehIdRtv(id)`, `ID_OPTOUT` de `@/lib/bot/roteiro`; `buscarLead(id: string): Promise<Lead | null>` de `../repo/leads`; `valorDoCampo('nome', lead, agora): string` de `@/lib/disparos`.

Não há teste unitário do executor (é `server-only`); a verificação é `npx tsc --noEmit` + `npm run build` + revisão da ordem.

- [ ] **Step 1: Imports**

Trocar `ehTerminalRtv` por `ehIdRtv` e `mensagemTerminal` por `mensagensTerminais`. Adicionar `buscarLead` ao import de `../repo/leads` e `import { valorDoCampo } from '@/lib/disparos'`.

- [ ] **Step 2: Qualificação**

```ts
    const terminal = passo.idP2 ?? passo.idP1
    const qualificar = ehIdRtv(terminal) && terminal !== ID_OPTOUT
```

Reescrever o comentário acima ("QUEM QUALIFICA É O TERMINAL…"): os três botões do template encerram; o opt-out não qualifica. Tirar a menção à triagem e a `rtv:voltar` abrir pergunta.

- [ ] **Step 3: Envio**

Substituir o bloco `if (passo.comFecho) { … }` por:

```ts
  if (passo.comFecho) {
    // Mesmo nome do {{1}} do template (`valorDoCampo`), para o lead ler o mesmo
    // nas duas pontas. Uma mensagem por vez, em ordem: em "Quero voltar" o link
    // vai antes da frase que diz "clicar no link acima". Spec 2026-10-15 §3.
    const lead = gatilho.leadId ? await buscarLead(gatilho.leadId) : null
    const nome = lead ? valorDoCampo('nome', lead, new Date()) : null
    for (const texto of mensagensTerminais(passo.idP1, passo.idP2, nome)) {
      const resposta = await enviarTexto(gatilho.phone, texto)
      await gravarSaida(gatilho, resposta.messages[0]?.id ?? null, texto, 'text')
    }
  }
```

A ordem qualificação → envio fica como está (qualificar antes de qualquer envio).

- [ ] **Step 4: Verificar tipos e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros. Se `tsc` apontar qualquer outro uso dos nomes removidos na Task 1, corrigir aqui.

- [ ] **Step 5: Commit**

```bash
git add src/server/bot/executar.ts
git commit -m "Executor manda as mensagens terminais em ordem, com o nome do lead"
```

---

### Task 3: Trava do link, ROADMAP e verificação completa

**Files:**
- Modify: `src/lib/bot/roteiro.test.ts`
- Modify: `ROADMAP.md`

- [ ] **Step 1: Teste de guarda do link**

No `describe('terminais do ramo rtv', …)` de `roteiro.test.ts`:

```ts
  it('LINK_CUPOM é uma URL https, sozinha (vermelho até o Rafael mandar o link)', () => {
    // Spec 2026-10-15 §3.3. Este teste falhando é a trava que impede o merge:
    // sem o link, "já estará com o cupom aplicado" é falso.
    expect(LINK_CUPOM).toMatch(/^https:\/\/\S+$/)
  })
```

- [ ] **Step 2: Confirmar que só ele falha**

Run: `npm test`
Expected: exatamente 1 falha, este teste. Qualquer outra falha é defeito das Tasks 1-2 e tem de ser corrigida.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: sucesso.

- [ ] **Step 4: ROADMAP**

Adicionar ao fim de `ROADMAP.md` uma seção no estilo das anteriores:

```markdown
## Em execução (2026-10-15) — fluxo de volta do Rafael

Spec `docs/superpowers/specs/2026-10-15-fluxo-volta-rafael-design.md`.

- ✅ Template `mkt_rtv_volta_01` aprovado na Meta (id 1629556198634284), texto do
  Rafael, botões Quero voltar / Preciso de ajuda / Não quero receber.
- ✅ Triagem removida. Os três botões encerram: "Quero voltar" manda o link com
  cupom e a frase de prazo; "Preciso de ajuda" entrega a gente com o fecho;
  "Não quero receber" agradece pelo nome e faz opt-out.
- ⏳ **Falta o link com cupom.** `LINK_CUPOM` em `src/lib/bot/roteiro.ts` está
  vazio e um teste fica vermelho até ser preenchido. Não fazer merge antes.
- ⏳ Depois do deploy: `POST /api/templates/sync` para o CRM mostrar o texto do
  template novo, e `scripts/simular-disparo.ts <telefone> <nome>
  mkt_rtv_volta_01` apertando os três botões.
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot/roteiro.test.ts ROADMAP.md
git commit -m "Trava do link do cupom e ROADMAP do fluxo de volta"
```
