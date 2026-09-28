# Triagem no ramo de campanha e três variantes — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `qualificado` passar a significar que a pessoa disse o motivo, e o
cliente ter três mensagens de disparo para escolher.

**Architecture:** O ramo `rtv` ganha um segundo nível aberto só por
`rtv:voltar`. O motor passa a distinguir id que **abre** de id que **fecha**,
como já faz entre `p1:artha` e `p1:outro`. Os três templates compartilham os
mesmos botões, então o payload continua trivial e o registro nomeado existe só
para responder "este nome é de campanha?" — e para transformar em erro alto o que
hoje falha em silêncio.

**Tech Stack:** TypeScript, Vitest, Next.js App Router, WhatsApp Cloud API.

**Spec:** `docs/superpowers/specs/2026-09-28-triagem-e-variantes-design.md`

---

## Como rodar teste neste projeto

Durante as tarefas, **rode só o arquivo de teste da tarefa**:

```bash
npx vitest run src/lib/bot/roteiro.test.ts
```

`npm test` e `npm run build` rodam **uma vez só**, na Tarefa 6. O Supabase está de
pé desde 2026-09-28, então a suíte completa agora inclui os 14 testes de paridade
com o Postgres — que passam.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Tarefa |
| --- | --- | --- |
| `src/lib/bot/roteiro.ts` | `RTV2`, `perguntaRtv2`, `ehIdRtv1/2`, `ehTerminalRtv`, `TEMPLATES_RTV` | T1 |
| `src/lib/bot/roteiro.test.ts` | critérios 1–11 da spec | T1 |
| `src/lib/bot/estado.ts` | portão terminal, ramificação da porta, `pendente` | T2 |
| `src/lib/bot/estado.test.ts` | critérios 12–17 | T2 |
| `src/lib/templates.ts` | `componentesDeBotao` por registro, com `throw` | T3 |
| `src/lib/templates.test.ts` | critérios 18–20 | T3 |
| `src/server/bot/executar.ts` | `qualificar` decide pelo terminal | T4 |
| `scripts/criar-template.ts` | submete as três | T5 |
| `ROADMAP.md` | registro e verificação final | T6 |

### Ondas

Regra do `CLAUDE.md` §5: agentes simultâneos nunca dividem arquivo.

| Onda | Em paralelo | Depende de |
| --- | --- | --- |
| 1 | **T1** | — |
| 2 | **T2**, **T3**, **T4**, **T5** | todas ← T1 |
| 3 | **T6** | tudo |

T1 é gargalo de propósito: é a camada de dado, e as quatro da onda 2 importam
dela.

---

## Tarefa 1 — O nível 2 e as três variantes em `roteiro.ts`

**Files:**
- Modify: `src/lib/bot/roteiro.ts`
- Test: `src/lib/bot/roteiro.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Acrescente ao final de `src/lib/bot/roteiro.test.ts`:

```ts
describe('triagem do ramo rtv', () => {
  const IDS_RTV2 = RTV2.botoes.map((b) => b.id)

  it('rtv:voltar ABRE a triagem e não é terminal', () => {
    expect(perguntaRtv2('rtv:voltar')).toBe(RTV2)
    expect(ehTerminalRtv('rtv:voltar')).toBe(false)
  })

  it('os outros dois do nível 1 são terminais', () => {
    expect(ehTerminalRtv('rtv:problema')).toBe(true)
    expect(ehTerminalRtv('rtv:sair')).toBe(true)
  })

  it('todo id da triagem é terminal', () => {
    for (const id of IDS_RTV2) expect(ehTerminalRtv(id), id).toBe(true)
  })

  it('perguntaRtv2 devolve null para qualquer id que não abre', () => {
    for (const id of ['rtv:problema', 'rtv:sair', 'p1:artha', ...IDS_RTV2]) {
      expect(perguntaRtv2(id), id).toBeNull()
    }
  })

  it('a triagem tem três botões dentro do limite de título', () => {
    expect(RTV2.botoes).toHaveLength(MAX_BOTOES)
    for (const b of RTV2.botoes) {
      expect(b.titulo.length, `"${b.titulo}"`).toBeLessThanOrEqual(MAX_TITULO)
    }
  })

  it('todo terminal do ramo tem resposta, e rtv:voltar NÃO tem', () => {
    // Os dois lados importam. Sem o segundo, deixar a resposta velha de
    // `rtv:voltar` para trás passaria despercebido e o bot mandaria texto E
    // pergunta no mesmo turno.
    for (const id of [...RTV_IDS, ...IDS_RTV2]) {
      if (ehTerminalRtv(id)) expect(RESPOSTA_POR_ID[id], `sem resposta: ${id}`).toBeTruthy()
    }
    expect(RESPOSTA_POR_ID['rtv:voltar']).toBeUndefined()
  })

  it('todo terminal tem tag, e rtv:voltar não', () => {
    for (const id of [...RTV_IDS, ...IDS_RTV2]) {
      if (ehTerminalRtv(id)) expect(TAG_POR_RESPOSTA[id], `sem tag: ${id}`).toBeTruthy()
    }
    expect(TAG_POR_RESPOSTA['rtv:voltar']).toBeUndefined()
  })

  it('ehIdRtv1 e ehIdRtv2 não se sobrepõem', () => {
    for (const id of RTV_IDS) {
      expect(ehIdRtv1(id), id).toBe(true)
      expect(ehIdRtv2(id), id).toBe(false)
    }
    for (const id of IDS_RTV2) {
      expect(ehIdRtv2(id), id).toBe(true)
      expect(ehIdRtv1(id), id).toBe(false)
    }
    expect(ehIdRtv1(null)).toBe(false)
    expect(ehIdRtv2(null)).toBe(false)
  })

  it('ehIdConhecido cobre os dois níveis', () => {
    expect(ehIdConhecido('rtv:voltar')).toBe(true)
    expect(ehIdConhecido('rtv2:preco')).toBe(true)
  })
})

describe('variantes de disparo', () => {
  const VARIANTES = Object.entries(TEMPLATES_RTV)

  it('são três', () => {
    expect(VARIANTES).toHaveLength(3)
  })

  it('a chave do registro é o nome do template', () => {
    // Fonte única: o script de criação e o montador de payload leem daqui, e
    // divergir entre chave e `nome` faria um submeter A e o outro procurar B.
    for (const [chave, t] of VARIANTES) expect(t.nome).toBe(chave)
  })

  it('cada variante passa na validação local da Meta', () => {
    for (const [nome, t] of VARIANTES) expect(validarTemplate(t), nome).toEqual([])
  })

  it('nenhum corpo abre ou fecha em variável', () => {
    for (const [nome, t] of VARIANTES) {
      const c = t.corpo.trim()
      expect(c.startsWith('{{'), nome).toBe(false)
      expect(c.endsWith('}}'), nome).toBe(false)
    }
  })

  it('cada corpo tem uma variável e um exemplo', () => {
    for (const [nome, t] of VARIANTES) {
      expect(t.corpo.match(/\{\{\d+\}\}/g), nome).toHaveLength(1)
      expect(t.exemplos, nome).toHaveLength(1)
    }
  })

  it('todas usam os mesmos três botões do nível 1', () => {
    for (const [nome, t] of VARIANTES) {
      expect(t.botoes.map((b) => b.texto), nome).toEqual(RTV_BOTOES.map((b) => b.titulo))
    }
  })

  it('nenhuma promete teste grátis ou devolução', () => {
    // Trava a §6.1: "testa por um mês" saiu do corpo porque o site não vende
    // trial, e sem isto a frase volta na próxima revisão de copy sem ninguém ver.
    for (const [nome, t] of VARIANTES) {
      expect(t.corpo, nome).not.toMatch(/gr[áa]tis|gratuit|devolu[çc][ãa]o|reembolso/i)
    }
  })

  it('nenhuma copy do ramo cita nome de persona', () => {
    const textos = [
      ...VARIANTES.map(([, t]) => t.corpo),
      ...RTV2.botoes.map((b) => RESPOSTA_POR_ID[b.id]),
      RTV2.corpo,
    ]
    for (const t of textos) expect(t).not.toMatch(/L[úu]cia|Clara|LucIA/i)
  })

  it('a copy do ramo segue as regras de escrita do gestor', () => {
    const textos = [
      ...VARIANTES.map(([, t]) => t.corpo),
      RTV2.corpo,
      RTV2.corpoRepetido,
      ...RTV2.botoes.map((b) => RESPOSTA_POR_ID[b.id]),
    ]
    for (const t of textos) {
      expect(t, 'sem travessão').not.toMatch(/—/)
      expect(t, 'sem markdown').not.toMatch(/\*|_{2}|#/)
      for (const linha of t.split('\n')) {
        if (linha.includes('http')) expect(linha.trim()).toMatch(/^https?:\/\/\S+$/)
      }
    }
  })
})
```

Acrescente ao `import` de `./roteiro` no topo: `RTV2`, `perguntaRtv2`,
`ehIdRtv1`, `ehIdRtv2`, `ehTerminalRtv`, `TEMPLATES_RTV`. E acrescente, como
import novo no topo do arquivo:

```ts
import { validarTemplate } from '../templates'
```

Remova `TEMPLATE_RTV` e `ehIdRtv` do import se estiverem lá e não forem mais
usados; os testes antigos que citavam `TEMPLATE_RTV` (o do corpo que não abre em
variável, o da variável única, o de persona, o de escrita) são **substituídos**
pelos equivalentes do bloco `variantes de disparo` acima. Apague os antigos.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/bot/roteiro.test.ts`
Expected: FAIL — `No "RTV2" export is defined on the module`.

- [ ] **Step 3: Implementar a triagem**

Em `src/lib/bot/roteiro.ts`, **substitua** o bloco que vai de
`export const RTV_IDS` até o fim de `ehIdRtv` (inclusive a constante
`TEMPLATE_RTV` inteira e a `const IDS_RTV`) por:

```ts
export const RTV_IDS = RTV_BOTOES.map((b) => b.id)

/** O terminal que desliga o lead de todo disparo futuro. */
export const ID_OPTOUT = 'rtv:sair'

/**
 * A TRIAGEM. Spec 2026-09-28 §3.3.
 *
 * Um toque não é qualificação. O cliente escreveu que a base "não comprou por
 * algum motivo" e que ele não sabe qual — esta pergunta é a que ele não
 * conseguiu fazer, e cada resposta arma a fala de abertura dele: preço é
 * objeção que a isenção resolve, conexão é suporte que ela não resolve, e
 * dúvida é falta de entendimento do produto.
 */
export const RTV2: Pergunta = {
  corpo: 'Boa. Me diz o que te segurou da primeira vez.',
  corpoRepetido: 'O que te segurou da primeira vez?',
  botoes: [
    { id: 'rtv2:preco', titulo: 'Foi o preço' },
    { id: 'rtv2:tecnico', titulo: 'Travei na conexão' },
    { id: 'rtv2:duvida', titulo: 'Não entendi direito' },
  ],
}

/**
 * Quem ABRE a triagem. Só `rtv:voltar`.
 *
 * Quem apertou "Tive um problema" tem um bloqueio concreto e a resposta já pede
 * que ele escreva qual; pôr um menu na frente disso é o oposto de atendimento.
 * Espelha `P2_POR_RAMO`, e é dele que `ehTerminalRtv` deriva quem fecha.
 */
export const RTV2_POR_RTV1: Record<string, Pergunta> = { 'rtv:voltar': RTV2 }

const IDS_RTV1 = new Set(RTV_IDS)
const IDS_RTV2 = new Set(RTV2.botoes.map((b) => b.id))

export function ehIdRtv1(id: string | null): boolean {
  return id !== null && IDS_RTV1.has(id)
}

export function ehIdRtv2(id: string | null): boolean {
  return id !== null && IDS_RTV2.has(id)
}

export function ehIdRtv(id: string | null): boolean {
  return ehIdRtv1(id) || ehIdRtv2(id)
}

export function perguntaRtv2(idRtv1: string): Pergunta | null {
  return RTV2_POR_RTV1[idRtv1] ?? null
}

/**
 * Fecha o roteiro do ramo. DERIVADO de quem abre, nunca escrito à mão: um botão
 * do nível 1 que ganhe triagem própria numa revisão futura sai desta lista
 * sozinho, em vez de continuar contando como terminal e calar o bot no meio da
 * própria pergunta.
 */
export function ehTerminalRtv(id: string | null): boolean {
  return ehIdRtv(id) && perguntaRtv2(id as string) === null
}
```

- [ ] **Step 4: Implementar as três variantes**

No lugar onde estava `TEMPLATE_RTV`, acrescente:

```ts
/**
 * As três variantes de disparo. Spec 2026-09-28 §4.
 *
 * OS MESMOS TRÊS BOTÕES NAS TRÊS, de propósito: com uma variável mudando por
 * vez, o que o cliente aprende é qual MENSAGEM funciona, não qual botão. Também
 * é o que mantém o mapeamento de payload trivial.
 *
 * ISENÇÃO É FATO COMERCIAL, NÃO COPY. O preço está publicado em
 * https://artha.ia.br e dá para conferir; a isenção de R$100 não está publicada
 * em lugar nenhum. Se o cliente mudar a oferta, estas strings mudam à mão.
 *
 * NENHUMA PROMETE TESTE NOVO. O site não vende trial, e "testa por um mês" lido
 * por quem teve trial expirado lê como período grátis. Spec §6.1, travado por
 * teste.
 */
function rascunhoRtv(nome: string, linhas: string[]) {
  return {
    nome,
    categoria: 'MARKETING' as const,
    idioma: 'pt_BR' as const,
    cabecalho: null,
    corpo: linhas.join('\n'),
    exemplos: ['João'],
    rodape: null,
    botoes: RTV_BOTOES.map((b) => ({ tipo: 'QUICK_REPLY' as const, texto: b.titulo })),
  }
}

export const TEMPLATES_RTV = {
  mkt_rtv_isencao_01: rascunhoRtv('mkt_rtv_isencao_01', [
    'Oi, {{1}}. Você conectou seu banco no Artha e parou no meio do caminho.',
    '',
    'Sua conta continua aqui, do jeito que você deixou.',
    '',
    'A taxa de adesão de R$100 a gente tirou pra você voltar. O primeiro mês sai R$97 em vez de R$197, e a gente te acompanha na hora de reconectar.',
    '',
    'Reconectar leva 2 minutos.',
  ]),

  mkt_rtv_trial_01: rascunhoRtv('mkt_rtv_trial_01', [
    'Oi, {{1}}. Seu teste do Artha terminou e você não chegou a continuar.',
    '',
    'Os bancos que você conectou continuam salvos, do jeito que você deixou.',
    '',
    'Pra voltar, a gente tirou a taxa de adesão de R$100. O primeiro mês sai R$97 em vez de R$197.',
    '',
    'Retomar é de onde você parou, não do zero.',
  ]),

  mkt_rtv_pergunta_01: rascunhoRtv('mkt_rtv_pergunta_01', [
    'Oi, {{1}}. Você sabe quanto gastou no mês passado?',
    '',
    'O Artha responde isso em 1 segundo. Ele soma suas contas e cartões sozinho, sem planilha nenhuma.',
    '',
    'Você chegou a conectar seu banco e parou no meio do caminho. Sua conta continua aqui.',
  ]),
}
```

- [ ] **Step 5: Trocar respostas e tags**

Em `RESPOSTA_POR_ID`, **remova** a entrada `'rtv:voltar'` inteira (ela agora faz
a pergunta de triagem, não responde) e acrescente, no lugar dela:

```ts
  // A triagem responde e entrega. Nenhuma das três afirma que a isenção já está
  // aplicada: quem libera é gente, porque não há mecanismo de cupom confirmado
  // pelo cliente. Spec 2026-09-26 §6.1.
  'rtv2:preco':
    'Entendi. Já passei para a equipe da Artha, que fecha a isenção com você e te acompanha na hora de reconectar.',

  'rtv2:tecnico':
    'Isso a gente resolve junto. Me conta em que banco você travou, que alguém da Artha olha o seu caso.',

  'rtv2:duvida':
    'Sem problema, é pra isso que a gente está aqui. Já passei para a equipe da Artha, que te explica como funciona e responde o que faltar.',
```

Em `TAG_POR_RESPOSTA`, **remova** `'rtv:voltar': 'rtv-quer-voltar'` e acrescente:

```ts
  'rtv2:preco': 'rtv-motivo-preco',
  'rtv2:tecnico': 'rtv-motivo-tecnico',
  'rtv2:duvida': 'rtv-motivo-duvida',
```

`ehIdConhecido` **não muda**: ele já chama `ehIdRtv`, que agora cobre os dois
níveis.

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/lib/bot/roteiro.test.ts`
Expected: PASS, todos.

Se um teste antigo ficar vermelho porque `TERMINAIS` deriva de `RTV_IDS` e agora
precisa dos ids da triagem também, ajuste a derivação acrescentando
`...RTV2.botoes.map((b) => b.id)` e **remova `rtv:voltar` dela**, com um
comentário dizendo que ele deixou de ser terminal. Não escreva a lista à mão.

- [ ] **Step 7: Commit**

```bash
git add src/lib/bot/roteiro.ts src/lib/bot/roteiro.test.ts
git commit -m 'Triagem no ramo rtv, e tres variantes de disparo no lugar de uma'
```

---

## Tarefa 2 — O motor aprende a triagem

**Files:**
- Modify: `src/lib/bot/estado.ts`
- Test: `src/lib/bot/estado.test.ts`

**Depende de T1.**

- [ ] **Step 1: Escrever os testes que falham**

O arquivo já tem os helpers `entrada()`, `botao(id)`, `doBot()`, `doHumano()`,
`doTemplate()`, `disparo()` e `doTemplateRtv(id)`. Use eles. Acrescente ao final
do `describe('proximoPasso', …)`:

```ts
  it('39. quem aperta Quero voltar recebe a triagem, não o fecho', () => {
    expect(proximoPasso([disparo(), doTemplateRtv('rtv:voltar')])).toEqual({
      acao: 'perguntar',
      pergunta: RTV2,
    })
  })

  it('40. responder a triagem encerra, carregando os dois ids', () => {
    expect(
      proximoPasso([disparo(), doTemplateRtv('rtv:voltar'), doBot(), botao('rtv2:preco')])
    ).toEqual({ acao: 'encerrar', idP1: 'rtv:voltar', idP2: 'rtv2:preco', comFecho: true })
  })

  it('41. depois da triagem respondida, texto livre cala', () => {
    expect(
      proximoPasso([
        disparo(),
        doTemplateRtv('rtv:voltar'),
        doBot(),
        botao('rtv2:preco'),
        doBot(),
        entrada({ content: 'obrigado' }),
      ]).acao
    ).toBe('calar')
  })

  it('42. quem abandona a triagem e escreve recebe a TRIAGEM de volta, não a p1', () => {
    // `rtv:voltar` não é id de p1, então sem carregar o rtv1 pendente o
    // fallback de texto livre devolvia a p1 de segmentação. Mesma família do
    // defeito consertado de manhã, num caminho novo.
    expect(
      proximoPasso([
        disparo(),
        doTemplateRtv('rtv:voltar'),
        doBot(),
        entrada({ content: 'nao sei explicar' }),
      ])
    ).toEqual({ acao: 'repetir', pergunta: RTV2 })
  })

  it('43. insistindo uma segunda vez, entrega a gente', () => {
    expect(
      proximoPasso([
        disparo(),
        doTemplateRtv('rtv:voltar'),
        doBot(),
        entrada({ content: 'nao sei' }),
        doBot(),
        entrada({ content: 'serio, nao sei' }),
      ])
    ).toEqual({ acao: 'encerrar', idP1: null, idP2: null, comFecho: false })
  })

  it('44. os outros dois do nível 1 continuam encerrando em um toque', () => {
    for (const id of ['rtv:problema', 'rtv:sair']) {
      expect(proximoPasso([disparo(), doTemplateRtv(id)])).toEqual({
        acao: 'encerrar',
        idP1: id,
        idP2: null,
        comFecho: true,
      })
    }
  })
```

Acrescente `RTV2` ao import de `./roteiro` no topo do arquivo.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/bot/estado.test.ts`
Expected: FAIL nos 39, 40, 42, 43. O 39 recebe `encerrar` em vez de `perguntar`;
o 42 recebe a `P1`.

- [ ] **Step 3: Trocar o import**

Em `src/lib/bot/estado.ts`, no import de `./roteiro`, troque `ehIdRtv` por
`ehIdRtv1`, `ehIdRtv2`, `ehTerminalRtv` e `perguntaRtv2`.

- [ ] **Step 4: O portão terminal passa a olhar só terminais**

Troque a condição do bloco que hoje é:

```ts
  if (ms.slice(0, -1).some((m) => m.direction === 'inbound' && ehIdRtv(m.button_id))) {
    return CALAR
  }
```

por:

```ts
  if (ms.slice(0, -1).some((m) => m.direction === 'inbound' && ehTerminalRtv(m.button_id))) {
    return CALAR
  }
```

E acrescente ao comentário logo acima, no final dele:

```
  // `ehTerminalRtv`, e não `ehIdRtv`: `rtv:voltar` ABRE a triagem. Contá-lo aqui
  // faria o toque no template calar o bot no meio da própria pergunta que ele
  // acabou de fazer. Spec 2026-09-28 §5.2a.
```

- [ ] **Step 5: A porta de campanha ramifica**

Troque o bloco:

```ts
  if (ehIdRtv(ultima.button_id)) {
    return { acao: 'encerrar', idP1: ultima.button_id, idP2: null, comFecho: true }
  }
```

por:

```ts
  // O `rtv:voltar` pendente, pelo mesmo `reduce` que deriva `idP1` mais abaixo.
  // Vem antes da porta porque a resposta da triagem tem de carregar junto qual
  // botão do template a abriu.
  const idRtv1 = ms.reduce<string | null>(
    (acc, m) => (ehIdRtv1(m.button_id) ? m.button_id : acc),
    null
  )

  if (ehIdRtv2(ultima.button_id)) {
    return { acao: 'encerrar', idP1: idRtv1, idP2: ultima.button_id, comFecho: true }
  }
  if (ehIdRtv1(ultima.button_id)) {
    const triagem = perguntaRtv2(ultima.button_id as string)
    if (triagem) return { acao: 'perguntar', pergunta: triagem }
    return { acao: 'encerrar', idP1: ultima.button_id, idP2: null, comFecho: true }
  }
```

- [ ] **Step 6: A repetição conhece a triagem**

Na última linha útil da função, troque:

```ts
  const pendente = idP1 ? (perguntaP2(idP1) ?? P1) : P1
```

por:

```ts
  // A triagem vem primeiro: quem parou nela não tem `idP1` nenhum, porque
  // `rtv:voltar` não é id de p1 — e sem esta linha o fallback devolvia a p1 de
  // segmentação para quem estava no meio da campanha. Spec §5.2c.
  const pendente = idRtv1
    ? (perguntaRtv2(idRtv1) ?? P1)
    : idP1
      ? (perguntaP2(idP1) ?? P1)
      : P1
```

- [ ] **Step 7: Rodar e ver passar**

Run: `npx vitest run src/lib/bot/estado.test.ts`

Expected: PASS, todos. **Confira nominalmente que 24, 25, 27, 28, 29, 33, 34, 35,
36, 37 e 38 continuam verdes.** O 35 e o 36 são os mais sensíveis: eles afirmam
que texto livre depois de um terminal `rtv` cala, e o portão que garante isso é
justamente o que mudou no passo 4. Se algum antigo ficar vermelho, não altere o
teste — revise a mudança.

- [ ] **Step 8: Commit**

```bash
git add src/lib/bot/estado.ts src/lib/bot/estado.test.ts
git commit -m 'Motor distingue botao que abre de botao que fecha no ramo rtv'
```

---

## Tarefa 3 — Registro nomeado, e a falha vira alta

**Files:**
- Modify: `src/lib/templates.ts`
- Test: `src/lib/templates.test.ts`

**Depende de T1.**

- [ ] **Step 1: Escrever os testes que falham**

Em `src/lib/templates.test.ts`, **substitua** o `describe('componentesDeBotao', …)`
que existe hoje por:

```ts
describe('componentesDeBotao', () => {
  it('monta um quick_reply por botão para cada variante registrada', () => {
    for (const nome of Object.keys(TEMPLATES_RTV)) {
      expect(componentesDeBotao(nome), nome).toEqual([
        { type: 'button', sub_type: 'quick_reply', index: '0', parameters: [{ type: 'payload', payload: 'rtv:voltar' }] },
        { type: 'button', sub_type: 'quick_reply', index: '1', parameters: [{ type: 'payload', payload: 'rtv:problema' }] },
        { type: 'button', sub_type: 'quick_reply', index: '2', parameters: [{ type: 'payload', payload: 'rtv:sair' }] },
      ])
    }
  })

  it('devolve lista vazia para template que não é de campanha', () => {
    // Lista vazia importa: é ela que mantém a defesa do erro 132018, porque
    // `enviarTemplate` só omite `components` quando a lista chega vazia.
    expect(componentesDeBotao('modelo_teste')).toEqual([])
    expect(componentesDeBotao('')).toEqual([])
  })

  it('LANÇA para nome de campanha fora do registro', () => {
    // Era o ponto único de falha do funil: sair sem payload faz a Meta usar o
    // título do botão como id, e os leads voltam todos para a p1 sem erro, sem
    // log e sem teste vermelho. `mkt_rtv_voce_sabe_01` está APPROVED na conta e
    // assina "Lúcia" — disparar ele à mão tem de falhar alto.
    expect(() => componentesDeBotao('mkt_rtv_voce_sabe_01')).toThrow(/TEMPLATES_RTV/)
    expect(() => componentesDeBotao('mkt_rtv_qualquer_coisa')).toThrow(/TEMPLATES_RTV/)
  })
})
```

Acrescente `TEMPLATES_RTV` ao import de `@/lib/bot/roteiro` no topo do arquivo de
teste (crie o import se não houver).

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/templates.test.ts`
Expected: FAIL — o terceiro teste não lança, e o primeiro reclama de
`TEMPLATES_RTV` indefinido.

- [ ] **Step 3: Implementar**

Em `src/lib/templates.ts`, troque o import de `./bot/roteiro` para:

```ts
import { PREFIXO_TEMPLATE_RTV, RTV_BOTOES, TEMPLATES_RTV } from './bot/roteiro'
```

E substitua a função `componentesDeBotao` inteira por:

```ts
/**
 * Os componentes de botão do envio, resolvidos pelo NOME do template.
 *
 * É esta função que faz o quick reply do disparo chegar no webhook como
 * `rtv:voltar` em vez da string "Quero voltar". O payload de um botão de
 * template não é definido na criação; ele é mandado a cada envio, e sem isto a
 * Meta usa o próprio título — que não é id de roteiro nenhum.
 *
 * O PAYLOAD SAI DE `RTV_BOTOES`, não do rascunho. São coisas diferentes: o
 * rascunho guarda `{ tipo, texto }`, que é a forma que a Meta aceita na criação,
 * e não carrega id nenhum. As três variantes compartilham os mesmos botões, então
 * o registro serve para responder "este nome é de campanha?".
 *
 * NOME DE CAMPANHA FORA DO REGISTRO LANÇA, e não devolve lista vazia. Lista
 * vazia aqui sairia sem payload, a Meta usaria o título do botão como id, e a
 * base inteira voltaria a cair na p1 — sem erro, sem log e sem teste vermelho.
 * Era o ponto único de falha deste funil. O `throw` sobe pelo try/catch de
 * `src/server/fila.ts`, que marca o agendamento como falho com esta mensagem em
 * vez de mandar a mensagem errada. Spec 2026-09-28 §5.4.
 */
export function componentesDeBotao(nomeDoTemplate: string): ComponenteEnvio[] {
  if (nomeDoTemplate in TEMPLATES_RTV) {
    return RTV_BOTOES.map((b, index) => ({
      type: 'button' as const,
      sub_type: 'quick_reply' as const,
      index: String(index),
      parameters: [{ type: 'payload' as const, payload: b.id }],
    }))
  }
  if (nomeDoTemplate.startsWith(PREFIXO_TEMPLATE_RTV)) {
    throw new Error(
      `componentesDeBotao: "${nomeDoTemplate}" parece template de campanha mas não está em ` +
        'TEMPLATES_RTV. Sairia sem payload e o bot devolveria a P1 para a base inteira.'
    )
  }
  return []
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/templates.test.ts`
Expected: PASS, todos, inclusive os antigos de `validarTemplate`.

Depois `npx tsc --noEmit`. Erros em arquivos de outros agentes em voo podem
aparecer; ignore e reporte.

- [ ] **Step 5: Commit**

```bash
git add src/lib/templates.ts src/lib/templates.test.ts
git commit -m 'Registro nomeado de templates, e template de campanha desconhecido lanca'
```

---

## Tarefa 4 — Quem qualifica é o terminal

**Files:**
- Modify: `src/server/bot/executar.ts`

**Depende de T1.**

Sem teste automatizado: o arquivo é `server-only` e fala com a Meta e o
PostgREST. O portão é `npx tsc --noEmit` e leitura.

- [ ] **Step 1: Trocar o import**

Em `src/server/bot/executar.ts`, no import de `@/lib/bot/roteiro`, troque
`ehIdRtv` por `ehTerminalRtv`.

- [ ] **Step 2: Trocar o cálculo de `qualificar`**

Troque a linha e o comentário que hoje são:

```ts
    // A porta de campanha qualifica SEM mexer em segmento: a coorte já nasce
    // `artha` na importação. Quem pediu para sair não é qualificação nenhuma, e
    // marcar como `qualificado` quem acabou de mandar parar seria mentira na
    // tela de quem atende.
    const qualificar = ehIdRtv(passo.idP1) && passo.idP1 !== ID_OPTOUT
```

por:

```ts
    // QUEM QUALIFICA É O TERMINAL, não o primeiro toque. Com a triagem, o id que
    // decide está em `idP2` — e `ehTerminalRtv` já exclui `rtv:voltar`, que abre
    // a pergunta em vez de fechar o roteiro. Quem toca no template e abandona na
    // triagem não é qualificado, que é o pedido inteiro desta onda.
    //
    // Sem mexer em segmento: a coorte já nasce `artha` na importação. E quem
    // pediu para sair não é qualificação nenhuma — marcar como `qualificado`
    // quem acabou de mandar parar seria mentira na tela de quem atende.
    const terminal = passo.idP2 ?? passo.idP1
    const qualificar = ehTerminalRtv(terminal) && terminal !== ID_OPTOUT
```

O resto do bloco — `segmento`, `tag`, a chamada a `qualificarLead` e o guard
`if (segmento || tag || qualificar)` — **não muda**. `TAG_POR_RESPOSTA` já
resolve por `idP2` antes de `idP1`, então a tag do motivo sai sozinha.

- [ ] **Step 3: Verificação por leitura**

Escreva no relatório o que acontece em cada caso, rastreando o código:

1. `rtv:voltar` sozinho (a triagem foi feita, ninguém respondeu ainda) — o passo
   é `perguntar`, então este bloco nem roda. Confirma?
2. `rtv2:preco` — qualifica? que tag? mexe em segmento?
3. `rtv:problema` — qualifica? (a resposta esperada é **sim**, decisão do gestor)
4. `rtv:sair` — qualifica? (esperado: **não**) grava opt-out aqui? (esperado:
   **não**, isso mora no webhook)
5. `p2:artha_preco` (porta orgânica) — comportamento mudou?

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erro no seu arquivo. Erros de outros agentes em voo podem aparecer;
ignore e reporte.

- [ ] **Step 5: Commit**

```bash
git add src/server/bot/executar.ts
git commit -m 'Qualifica quem responde a triagem, nao quem toca no template'
```

---

## Tarefa 5 — O script submete as três

**Files:**
- Modify: `scripts/criar-template.ts`

**Depende de T1.**

- [ ] **Step 1: Reescrever o script**

Substitua o conteúdo de `scripts/criar-template.ts` por:

```ts
// Submete as variantes de disparo à Meta para aprovação.
//
// Rodar:  npx tsx scripts/criar-template.ts            (as três)
//         npx tsx scripts/criar-template.ts mkt_rtv_trial_01   (só uma)
//
// Os rascunhos vêm de `src/lib/bot/roteiro.ts`, fonte única: o título do botão
// aparece no template aprovado E no payload que a fila manda, e duas fontes
// divergem em silêncio. `validarTemplate` roda antes de gastar cada chamada.
//
// NÃO PARA NA PRIMEIRA RECUSA. Uma variante recusada não pode impedir as outras
// duas de serem submetidas — cada aprovação é uma espera própria da Meta, e
// serializar as esperas por causa de uma recusa custa dias.
//
// NÃO usa `src/server/meta/client.ts`: aquele módulo é `server-only` e não
// carrega fora do Next.
import './env'
import { TEMPLATES_RTV } from '../src/lib/bot/roteiro'
import { validarTemplate } from '../src/lib/templates'

const token = process.env.WHATSAPP_ACCESS_TOKEN
const waba = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
const versao = process.env.GRAPH_API_VERSION || 'v21.0'

if (!token || !waba) {
  console.error('WHATSAPP_ACCESS_TOKEN e WHATSAPP_BUSINESS_ACCOUNT_ID são obrigatórias.')
  process.exit(1)
}

const pedido = process.argv[2]
const nomes = pedido ? [pedido] : Object.keys(TEMPLATES_RTV)

for (const nome of nomes) {
  if (!(nome in TEMPLATES_RTV)) {
    console.error(`"${nome}" não está em TEMPLATES_RTV. Disponíveis:`)
    for (const n of Object.keys(TEMPLATES_RTV)) console.error(`  ${n}`)
    process.exit(1)
  }
}

type Rascunho = (typeof TEMPLATES_RTV)[keyof typeof TEMPLATES_RTV]

function corpoDoPost(t: Rascunho): Record<string, unknown> {
  return {
    name: t.nome,
    language: t.idioma,
    category: t.categoria,
    components: [
      { type: 'BODY', text: t.corpo, example: { body_text: [t.exemplos] } },
      {
        type: 'BUTTONS',
        buttons: t.botoes.map((b) => ({ type: 'QUICK_REPLY', text: b.texto })),
      },
    ],
  }
}

async function submeter(t: Rascunho): Promise<boolean> {
  console.log('')
  console.log(`── ${t.nome} (${t.categoria}, ${t.idioma})`)
  console.log('')
  console.log(t.corpo)
  console.log('')
  console.log(t.botoes.map((b) => `[ ${b.texto} ]`).join(' '))
  console.log('')

  const erros = validarTemplate(t)
  if (erros.length > 0) {
    console.error('  Não passa na validação local, nem foi submetido:')
    for (const e of erros) console.error(`    ${e}`)
    return false
  }

  const resp = await fetch(`https://graph.facebook.com/${versao}/${waba!}/message_templates`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token!}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpoDoPost(t)),
  })
  const texto = await resp.text()

  if (!resp.ok) {
    console.error(`  A Meta recusou (${resp.status}):`)
    console.error(`  ${texto}`)
    return false
  }

  console.log(`  Submetido. ${texto}`)
  return true
}

async function main(): Promise<void> {
  let ok = 0
  for (const nome of nomes) {
    const sucesso = await submeter(TEMPLATES_RTV[nome as keyof typeof TEMPLATES_RTV])
    if (sucesso) ok += 1
  }

  console.log('')
  console.log(`Submetidas: ${ok} de ${nomes.length}`)
  console.log('A aprovação leva de minutos a alguns dias, e cada uma corre sozinha.')
  console.log('')

  // Sai com erro quando alguma não entrou, para o passo não parecer bem-sucedido
  // num script rodado dentro de outro.
  if (ok < nomes.length) process.exit(1)
}

void main()
```

- [ ] **Step 2: Verificar SEM submeter**

1. `npx tsc --noEmit` — sem erro no seu arquivo.
2. Confirme por leitura que as três passam em `validarTemplate`: nome só com
   minúsculas/números/underscore, uma variável `{{1}}` sequencial, um exemplo por
   variável, três `QUICK_REPLY` dentro do teto, nenhum botão URL.

**NÃO EXECUTE o script.** Submeter template é ação irreversível dentro da conta
de produção do cliente na Meta, e acontece num passo manual posterior com o
gestor presente. Se quiser provar que o corpo do POST está bem formado, imprima o
JSON num one-liner separado (`npx tsx -e "…"`) — não acrescente modo dry-run que
ninguém pediu.

- [ ] **Step 3: Commit**

```bash
git add scripts/criar-template.ts
git commit -m 'Script submete as tres variantes e nao para na primeira recusa'
```

---

## Tarefa 6 — Verificação e registro

**Files:**
- Modify: `ROADMAP.md`

- [ ] **Step 1: A suíte inteira e o build, uma vez só**

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Expected: os quatro limpos. Com o Supabase de pé desde 2026-09-28, os 14 testes
de paridade com o Postgres agora **passam** — não devem mais aparecer como falha.
Partindo de 322 (308 + 14), a contagem sobe com os testes novos das tarefas 1, 2
e 3.

Se algo falhar, conserte antes de seguir.

- [ ] **Step 2: Registrar no ROADMAP**

Em `ROADMAP.md`, acrescente antes de `## [NA FILA]`:

```markdown
## Concluído (2026-09-28) — triagem antes de qualificar

Um toque virava `qualificado`, e o gestor cortou: *"só uma mensagem >
qualificação, fica direto demais"*. Spec:
`docs/superpowers/specs/2026-09-28-triagem-e-variantes-design.md`.

O argumento é do próprio cliente. Ele escreveu que a coorte "não comprou por
algum motivo" e não sabe qual. A triagem pergunta isso, e cada resposta arma a
fala de abertura dele: preço é objeção que a isenção resolve, conexão é suporte
que ela não resolve, dúvida é falta de entendimento do produto.

`rtv:voltar` deixou de ser terminal e passou a abrir `RTV2`. Só os terminais
qualificam — mais `rtv:problema`, que o gestor mandou manter porque "tive um
problema" já é sinal concreto, diferente de "quero voltar", que é vago.

**O motor precisou aprender a diferença entre abrir e fechar.** Duas armadilhas
caíram junto: o portão de estado terminal contava `rtv:voltar` e calaria o bot no
meio da própria triagem; e o fallback de texto livre só conhecia `idP1`, então
quem abandonasse a triagem escrevendo recebia a P1 de segmentação. Era a mesma
família do defeito consertado de manhã, num caminho novo.

**Três variantes de disparo**, com os mesmos três botões de propósito: assim o
que se aprende é qual mensagem funciona, não qual botão. `mkt_rtv_isencao_01`,
`mkt_rtv_trial_01` e `mkt_rtv_pergunta_01`.

**O ponto único de falha do funil morreu.** Template começando em `mkt_rtv` que
não esteja em `TEMPLATES_RTV` agora **lança** em vez de sair sem payload. Antes,
um rename silenciava o funil inteiro: a Meta usaria o título do botão como id e a
base voltaria toda para a P1, sem erro, sem log e sem teste vermelho. Isso alcança
de propósito o `mkt_rtv_voce_sabe_01` que está `APPROVED` na conta assinando
"Lúcia".

**Quebra de comparabilidade:** número de qualificados antes e depois desta onda
não se compara. Passou a exigir a resposta da triagem.

**Correção de copy:** "Você conecta todos os seus bancos e testa por um mês" saiu
do corpo. Vinha do argumento do cliente, onde "testar por 1 mês" é o primeiro mês
**pago** de R$97 — o desconto é a isenção, não gratuidade. `artha.ia.br` não
vende trial em lugar nenhum, e lido por quem teve trial expirado aquilo lê como
período grátis. Um teste trava "grátis", "gratuito", "devolução" e "reembolso"
fora dos corpos.
```

- [ ] **Step 3: Commit**

```bash
git add ROADMAP.md
git commit -m 'ROADMAP registra a triagem, as tres variantes e a correcao da copy'
```

- [ ] **Step 4: Portões que continuam fora do código**

- [ ] **Migration 0003 no SQL Editor.** Verificado em 2026-09-28: as tabelas de
      `0001` e `0002` existem, mas `leads.optout_em` **não**. Sem ela
      `marcarOptout` estoura com `42703` e o botão "Não quero receber" não marca
      ninguém.
- [ ] Bucket `midia`, privado, no Storage.
- [ ] Cartão cadastrado na Meta.
- [ ] Deploy público, com o webhook apontado para `/api/webhook`.

- [ ] **Step 5: Verificação manual, depois dos portões**

- [ ] `npx tsx scripts/criar-template.ts` submete as três. Aguardar `APPROVED`.
- [ ] `IMPORT_CONFIRMO=sim npm run importar:leads leads-rtv.csv` — esperado 11
      gravados, 1 recusado (`551134980291`, Romario silva), impresso por nome.
- [ ] Disparo de uma variante para o número do gestor, com
      `filtro: { "tag": "rtv-lote-2026-09" }`.
- [ ] Apertar **Quero voltar** → chega a triagem, e o lead **ainda não** está
      `qualificado`.
- [ ] Apertar **Foi o preço** → chega a resposta, o lead vira `qualificado` com
      `rtv-motivo-preco`, e a conversa aparece na fila do Dashboard.
- [ ] Noutra conversa, apertar **Não quero receber** → `optout_em` preenchido, e
      uma segunda campanha não enfileira o lead.

---

## O que este plano não faz

- Terceiro nível. A triagem é uma pergunta, não formulário.
- Triagem depois de `rtv:problema`.
- Mexer na porta orgânica.
- Medir queda entre nível 1 e 2 com coluna própria — o `button_id` de cada
  mensagem já está gravado e a conta é derivável.
- Voltar `Disparos` e `Templates` ao menu.
- Tirar a conversa da fila depois do opt-out.
- Opt-out por texto livre.
