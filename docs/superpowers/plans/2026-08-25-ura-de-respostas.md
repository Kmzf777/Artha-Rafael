# URA de respostas — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada botão do bot passa a entregar uma resposta própria em vez de todos caírem na mesma frase de espera.

**Architecture:** O roteiro é dado, não lógica. `src/lib/bot/roteiro.ts` é reescrito com a árvore nova, um mapa de resposta por id terminal e uma função pura que escolhe a mensagem. O motor de decisão `src/lib/bot/estado.ts` **não é tocado** — ele já devolve os ids terminais e nunca decidiu texto. `src/server/bot/executar.ts` troca duas constantes por duas chamadas.

**Tech Stack:** TypeScript, Vitest, Next.js 16 App Router. Sem dependência nova, sem migration, sem rota, sem componente.

**Spec:** `docs/superpowers/specs/2026-08-25-ura-de-respostas-design.md`

---

## Contexto que o implementador precisa

O bot vive dentro do webhook do WhatsApp. Três arquivos importam:

- `src/lib/bot/roteiro.ts` — o roteiro como **dado**. Perguntas, botões, ids, tags. Nenhuma decisão.
- `src/lib/bot/estado.ts` — `proximoPasso(mensagens)`, função **pura** do histórico. Devolve `{ acao: 'perguntar' | 'repetir' | 'encerrar' | 'calar', ... }`. **Não mexa neste arquivo.** Ele sustenta 29 testes e carrega as regras que o cliente comprou.
- `src/server/bot/executar.ts` — os efeitos colaterais. Trava de concorrência, checagem de janela de 24h, envio, gravação.

**A regra de ouro do projeto:** os ids são o contrato, os títulos são copy. Nunca roteie por título.

**Comandos:**

```bash
npm test                 # Vitest, suíte inteira
npx vitest run src/lib/bot/roteiro.test.ts    # um arquivo só
npx tsc --noEmit         # type-check
npm run lint             # ESLint
npm run build            # build de produção
```

`npm test` hoje dá **205 passando e 14 pulados**. Os 14 pulados são testes de paridade `tel_norm11` que esperam banco configurado — eles continuam pulados e isso é o esperado, não uma regressão.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade depois desta mudança |
| --- | --- |
| `src/lib/bot/roteiro.ts` | reescrito — árvore, respostas, `ENCAMINHA`, `mensagemTerminal` |
| `src/lib/bot/roteiro.test.ts` | invariantes da árvore e da copy |
| `src/lib/bot/estado.test.ts` | só os ids dos fixtures mudam; zero asserção de comportamento |
| `src/server/bot/executar.ts` | duas linhas |
| `src/lib/bot/estado.ts` | **intocado** |
| `CLAUDE.md` | correção do preço da Artha |
| `ROADMAP.md` | registro da entrega |

---

### Task 1: Invariantes novos do roteiro (vermelho de propósito)

Escreve o teste antes de existir o que ele testa. Ao fim desta task a suíte está **quebrada**, e isso é o resultado correto.

**Files:**
- Modify: `src/lib/bot/roteiro.test.ts`

- [ ] **Step 1: Substituir o arquivo de teste inteiro**

Escreva `src/lib/bot/roteiro.test.ts` com este conteúdo exato:

```ts
import { describe, it, expect } from 'vitest'
import {
  MAX_BOTOES,
  MAX_CORPO_INTERATIVO,
  MAX_CORPO_TEXTO,
  MAX_TITULO,
  P1,
  P2_POR_RAMO,
  perguntaP2,
  SEGMENTO_POR_P1,
  TAG_POR_RESPOSTA,
  RESPOSTA_POR_ID,
  ENCAMINHA,
  FECHO,
  REPETICAO,
  mensagemTerminal,
  ehIdConhecido,
} from './roteiro'

const TODAS = [P1, ...Object.values(P2_POR_RAMO)]

/**
 * Terminal é todo botão da p1 sem ramo em P2_POR_RAMO, mais todos os botões das
 * p2. DERIVADO da árvore, nunca escrito à mão: um ramo que vire terminal numa
 * revisão futura entra nesta lista sozinho, em vez de escapar em silêncio.
 */
const TERMINAIS = [
  ...P1.botoes.map((b) => b.id).filter((id) => !(id in P2_POR_RAMO)),
  ...Object.values(P2_POR_RAMO).flatMap((p) => p.botoes.map((b) => b.id)),
]

/** Travessão (U+2014) e meia-risca (U+2013). Hífen comum não conta. */
const TRAVESSAO = /[–—]/

describe('limites da Cloud API', () => {
  it('nenhuma pergunta passa de 3 botões', () => {
    for (const p of TODAS) expect(p.botoes.length).toBeLessThanOrEqual(MAX_BOTOES)
  })

  it('nenhum título de botão passa de 20 caracteres', () => {
    for (const p of TODAS) {
      for (const b of p.botoes) expect(b.titulo.length).toBeLessThanOrEqual(MAX_TITULO)
    }
  })

  it('nenhum corpo de pergunta passa do teto interativo', () => {
    for (const p of TODAS) {
      expect(p.corpo.length).toBeLessThanOrEqual(MAX_CORPO_INTERATIVO)
      if (p.corpoRepetido) {
        expect(p.corpoRepetido.length).toBeLessThanOrEqual(MAX_CORPO_INTERATIVO)
      }
    }
  })
})

describe('ids', () => {
  it('são únicos em todo o roteiro', () => {
    const ids = TODAS.flatMap((p) => p.botoes.map((b) => b.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ehIdConhecido separa o que é do roteiro do que não é', () => {
    expect(ehIdConhecido('p1:artha')).toBe(true)
    expect(ehIdConhecido('p2:artha_preco')).toBe(true)
    expect(ehIdConhecido('quero_voltar')).toBe(false)
    expect(ehIdConhecido(null)).toBe(false)
  })
})

describe('ramificação', () => {
  it('artha e dhana têm p2; outro não tem', () => {
    expect(perguntaP2('p1:artha')?.botoes).toHaveLength(3)
    expect(perguntaP2('p1:dhana')?.botoes).toHaveLength(3)
    expect(perguntaP2('p1:outro')).toBeNull()
  })

  it('só artha e dhana decidem segmento', () => {
    expect(SEGMENTO_POR_P1['p1:artha']).toBe('artha')
    expect(SEGMENTO_POR_P1['p1:dhana']).toBe('dhana')
    expect(SEGMENTO_POR_P1['p1:outro']).toBeUndefined()
  })
})

describe('saída terminal', () => {
  it('existe pelo menos um terminal de nível 1', () => {
    const terminaisP1 = P1.botoes.map((b) => b.id).filter((id) => !(id in P2_POR_RAMO))
    expect(terminaisP1).toContain('p1:outro')
  })

  it('todo id terminal ou responde, ou encaminha', () => {
    expect(TERMINAIS.length).toBeGreaterThan(0)
    for (const id of TERMINAIS) {
      const responde = id in RESPOSTA_POR_ID
      const encaminha = ENCAMINHA.has(id)
      expect(responde || encaminha, `${id} não responde nem encaminha`).toBe(true)
    }
  })

  it('nenhum id responde e encaminha ao mesmo tempo', () => {
    for (const id of Object.keys(RESPOSTA_POR_ID)) {
      expect(ENCAMINHA.has(id), `${id} está em RESPOSTA_POR_ID e em ENCAMINHA`).toBe(false)
    }
  })

  it('RESPOSTA_POR_ID e ENCAMINHA só falam de ids terminais', () => {
    const terminais = new Set(TERMINAIS)
    for (const id of [...Object.keys(RESPOSTA_POR_ID), ...ENCAMINHA]) {
      expect(terminais.has(id), `${id} não é um terminal da árvore`).toBe(true)
    }
  })

  it('toda resposta terminal tem tag', () => {
    for (const id of TERMINAIS) expect(TAG_POR_RESPOSTA[id]).toBeTruthy()
  })

  it('nenhuma resposta passa do teto de texto da Cloud API', () => {
    for (const texto of Object.values(RESPOSTA_POR_ID)) {
      expect(texto.length).toBeLessThanOrEqual(MAX_CORPO_TEXTO)
    }
    expect(FECHO.length).toBeLessThanOrEqual(MAX_CORPO_TEXTO)
  })
})

describe('mensagemTerminal', () => {
  it('devolve a resposta do id de nível 2', () => {
    expect(mensagemTerminal('p1:artha', 'p2:artha_preco')).toBe(RESPOSTA_POR_ID['p2:artha_preco'])
  })

  it('cai no id de nível 1 quando não há nível 2', () => {
    expect(mensagemTerminal('p1:outro', null)).toBe(FECHO)
  })

  it('devolve o fecho para quem encaminha', () => {
    expect(mensagemTerminal('p1:dhana', 'p2:dhana_demo')).toBe(FECHO)
    expect(mensagemTerminal('p1:dhana', 'p2:humano')).toBe(FECHO)
  })

  it('id desconhecido cai no fecho, nunca em silêncio', () => {
    expect(mensagemTerminal(null, null)).toBe(FECHO)
    expect(mensagemTerminal('p1:artha', 'p2:inexistente')).toBe(FECHO)
  })
})

describe('regras de escrita', () => {
  it('nenhuma copy usa travessão ou meia-risca', () => {
    const copy = [
      ...TODAS.flatMap((p) => [p.corpo, p.corpoRepetido ?? '']),
      ...TODAS.flatMap((p) => p.botoes.map((b) => b.titulo)),
      ...Object.values(RESPOSTA_POR_ID),
      FECHO,
      REPETICAO,
    ]
    for (const texto of copy) {
      expect(TRAVESSAO.test(texto), `travessão em: ${texto}`).toBe(false)
    }
  })

  it('o link de começar fica sozinho na linha, sem pontuação encostada', () => {
    const linhas = RESPOSTA_POR_ID['p2:artha_comecar'].split('\n')
    const linhaDoLink = linhas.find((l) => l.includes('https://'))
    expect(linhaDoLink).toBe('https://artha.ia.br')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/lib/bot/roteiro.test.ts`

Expected: FAIL. O erro é de import — `MAX_CORPO_INTERATIVO`, `MAX_CORPO_TEXTO`, `RESPOSTA_POR_ID`, `ENCAMINHA` e `mensagemTerminal` ainda não existem em `roteiro.ts`.

Se falhar por outro motivo, pare e leia o erro. Não siga.

- [ ] **Step 3: Commit**

```bash
git add src/lib/bot/roteiro.test.ts
git commit -m "Testes primeiro: todo botao terminal ou responde, ou encaminha"
```

---

### Task 2: A árvore nova

Reescreve o roteiro e ajusta os ids nos fixtures do motor. Os dois arquivos precisam ir juntos para a suíte voltar ao verde.

**Files:**
- Modify: `src/lib/bot/roteiro.ts` (reescrita completa)
- Modify: `src/lib/bot/estado.test.ts` (só ids)

- [ ] **Step 1: Substituir `src/lib/bot/roteiro.ts` inteiro**

```ts
// O roteiro do bot, como DADO. Sem decisão nenhuma aqui — quem decide é
// `estado.ts`. Spec 2026-08-25 §3.
//
// OS IDS SÃO O CONTRATO; OS TÍTULOS SÃO COPY. Trocar "Minhas finanças" por
// "Minhas contas" não pode mexer no roteamento, e é por isso que o webhook
// guarda `button_id` além do `content`.
//
// VOZ: institucional. "Aqui é da Artha", "equipe da Artha". Nenhum nome de
// persona — há três em circulação (Lúcia, Clara, LucIA) e a escolha é do
// cliente.
//
// ESCRITA: sem travessão, sem dois-pontos introduzindo frase, sem markdown, e
// link sozinho na linha. São regras do gestor e estão travadas por teste.
import type { Segmento } from '@/mock/types'

/** Autoria das mensagens do bot na coluna `messages.enviado_por`. */
export const AUTOR_BOT = 'bot'

/** Limites da Cloud API para `interactive.type = 'button'`. */
export const MAX_BOTOES = 3
export const MAX_TITULO = 20
export const MAX_CORPO_INTERATIVO = 1024
/** Teto do corpo de uma mensagem de texto simples. */
export const MAX_CORPO_TEXTO = 4096

export type Botao = { id: string; titulo: string }

export type Pergunta = {
  corpo: string
  /**
   * O mesmo texto sem a saudação, usado quando o bot repete a pergunta porque a
   * pessoa escreveu em vez de apertar. Sem isto o menu 1 dá um segundo "Oi!" na
   * mesma conversa, que é o que faz a URA parecer quebrada. Spec §4.4.
   */
  corpoRepetido?: string
  botoes: Botao[]
}

export const P1: Pergunta = {
  corpo: 'Oi! Aqui é da Artha. Me diz o que você procura.',
  corpoRepetido: 'O que você procura?',
  botoes: [
    { id: 'p1:artha', titulo: 'Minhas finanças' },
    { id: 'p1:dhana', titulo: 'Sou planejador' },
    { id: 'p1:outro', titulo: 'Falar com alguém' },
  ],
}

/** A p2 ramifica pela resposta da p1. `p1:outro` não tem p2: encerra ali. */
export const P2_POR_RAMO: Record<string, Pergunta> = {
  'p1:artha': {
    corpo: 'Boa. O que você quer saber?',
    corpoRepetido: 'O que você quer saber?',
    botoes: [
      { id: 'p2:artha_como', titulo: 'Como funciona' },
      { id: 'p2:artha_preco', titulo: 'Preços' },
      { id: 'p2:artha_comecar', titulo: 'Quero começar' },
    ],
  },
  'p1:dhana': {
    corpo: 'Certo. O que você quer saber?',
    corpoRepetido: 'O que você quer saber?',
    botoes: [
      { id: 'p2:dhana_como', titulo: 'Como funciona' },
      { id: 'p2:dhana_demo', titulo: 'Ver demonstração' },
      { id: 'p2:humano', titulo: 'Falar com alguém' },
    ],
  },
}

/**
 * O que sai quando a pessoa aperta. Spec §3.4.
 *
 * PREÇO É FATO COMERCIAL, NÃO COPY. A fonte é https://artha.ia.br, lido em
 * 2026-08-25, e inclui a taxa de adesão de R$100 que o CLAUDE.md omitia. Quando
 * o preço mudar no site, esta string tem de mudar junto: não há nada ligando os
 * dois, e o bot afirmando valor errado para cliente real é reclamação, não bug.
 *
 * Dhana não tem resposta de preço porque não há valor de Dhana publicado em
 * lugar nenhum. Quem pergunta preço de Dhana chega em gente.
 */
export const RESPOSTA_POR_ID: Record<string, string> = {
  'p2:artha_como':
    'A Artha conecta seus bancos, cartões e investimentos uma vez e atualiza tudo sozinha, todo dia.\n\n' +
    'Suas contas de várias instituições ficam num lugar só, sem planilha e sem digitar nada.',

  'p2:artha_preco':
    'No plano mensal são R$197 no primeiro mês e R$97 por mês depois. Os R$100 da entrada são a taxa de adesão.\n\n' +
    'No anual são R$997 pagos de uma vez, sem adesão.',

  'p2:artha_comecar':
    'Ótimo. É por aqui.\n\n' +
    'https://artha.ia.br\n\n' +
    'Você conecta seus bancos por lá. Se travar em algum passo, é só escrever aqui.',

  'p2:dhana_como':
    'A Dhana é a plataforma que você usa para acompanhar seus clientes. ' +
    'Cada um conecta as contas dele e você enxerga a carteira inteira num lugar só, sem pedir extrato para ninguém.',
}

/**
 * Terminais que não respondem nada e entregam a conversa a gente. Spec §3.5.
 *
 * Existe como conjunto explícito, e não como "o que sobra de RESPOSTA_POR_ID",
 * para que esquecer de escrever uma resposta seja um teste vermelho em vez de
 * um encaminhamento silencioso.
 */
export const ENCAMINHA = new Set(['p1:outro', 'p2:dhana_demo', 'p2:humano'])

export const FECHO =
  'Perfeito, obrigado! Já passei para a equipe da Artha, e em instantes alguém te responde por aqui.'

export const REPETICAO = 'Te respondo já. Antes me ajuda com uma coisa.'

/** Só artha e dhana decidem segmento. `p1:outro` não qualifica ninguém. */
export const SEGMENTO_POR_P1: Record<string, Segmento> = {
  'p1:artha': 'artha',
  'p1:dhana': 'dhana',
}

/** Toda resposta terminal vira uma tag no lead. */
export const TAG_POR_RESPOSTA: Record<string, string> = {
  'p1:outro': 'quer-humano',
  'p2:artha_como': 'quer-saber-como',
  'p2:artha_preco': 'quer-saber-preco',
  'p2:artha_comecar': 'quer-comecar',
  'p2:dhana_como': 'dhana-quer-saber-como',
  'p2:dhana_demo': 'dhana-quer-demo',
  'p2:humano': 'quer-humano',
}

const IDS_P1 = new Set(P1.botoes.map((b) => b.id))
const IDS_P2 = new Set(Object.values(P2_POR_RAMO).flatMap((p) => p.botoes.map((b) => b.id)))

export function ehIdP1(id: string | null): boolean {
  return id !== null && IDS_P1.has(id)
}

export function ehIdP2(id: string | null): boolean {
  return id !== null && IDS_P2.has(id)
}

/** Um id que o roteiro não conhece veio de campanha antiga ou de roteiro trocado. */
export function ehIdConhecido(id: string | null): boolean {
  return ehIdP1(id) || ehIdP2(id)
}

export function perguntaP2(idP1: string): Pergunta | null {
  return P2_POR_RAMO[idP1] ?? null
}

/**
 * A mensagem que fecha o roteiro. Spec §4.3.
 *
 * `idP2 ?? idP1` porque `p1:outro` termina no nível 1 e não tem idP2. O
 * fallback para FECHO cobre quem encaminha e qualquer id que entre na árvore sem
 * resposta: falha para a frase de espera, nunca para o silêncio.
 *
 * Mora aqui, e não dentro de `executar.ts`, para ser testável sem banco, sem
 * Meta e sem `server-only`.
 */
export function mensagemTerminal(idP1: string | null, idP2: string | null): string {
  const id = idP2 ?? idP1
  return (id ? RESPOSTA_POR_ID[id] : undefined) ?? FECHO
}
```

- [ ] **Step 2: Rodar o teste do roteiro e confirmar que passa**

Run: `npx vitest run src/lib/bot/roteiro.test.ts`
Expected: PASS, todos.

- [ ] **Step 3: Confirmar que o motor ficou vermelho pelos ids antigos**

Run: `npx vitest run src/lib/bot/estado.test.ts`
Expected: FAIL. Os fixtures ainda usam `p2:testou` e `p2:ate20`, que deixaram de existir. Isso confirma que o roteiro trocou de verdade.

- [ ] **Step 4: Trocar os ids nos fixtures de `src/lib/bot/estado.test.ts`**

Só ids. **Nenhuma asserção de comportamento muda.** Se alguma precisar mudar para passar, o motor foi tocado sem querer e a mudança está errada — pare e revise.

```bash
sed -i 's/p2:testou/p2:artha_preco/g; s/p2:ate20/p2:dhana_demo/g' src/lib/bot/estado.test.ts
```

Confere que só sobraram ids válidos:

```bash
grep -c "p2:testou\|p2:ate20" src/lib/bot/estado.test.ts
grep -c "p2:artha_preco\|p2:dhana_demo" src/lib/bot/estado.test.ts
```

Expected: `0` no primeiro, `7` no segundo. Se o segundo não der 7, a substituição
pegou menos linhas do que devia e falta id.

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm test`
Expected: **205 passando, 14 pulados.** Os 14 pulados são paridade `tel_norm11` esperando banco, e continuam pulados.

- [ ] **Step 6: Commit**

```bash
git add src/lib/bot/roteiro.ts src/lib/bot/estado.test.ts
git commit -m "Arvore nova: o nivel 2 pergunta o que a pessoa quer saber"
```

---

### Task 3: O executor entrega a resposta certa

**Files:**
- Modify: `src/server/bot/executar.ts` (linhas 6, 49-51, 70-79)

- [ ] **Step 1: Trocar o import da linha 6**

De:

```ts
import { AUTOR_BOT, FECHO, REPETICAO, SEGMENTO_POR_P1, TAG_POR_RESPOSTA } from '@/lib/bot/roteiro'
```

Para:

```ts
import {
  AUTOR_BOT,
  mensagemTerminal,
  REPETICAO,
  SEGMENTO_POR_P1,
  TAG_POR_RESPOSTA,
} from '@/lib/bot/roteiro'
```

`FECHO` sai daqui porque `mensagemTerminal` já o devolve quando é o caso.

- [ ] **Step 2: Usar `corpoRepetido` na repetição**

Encontre este bloco:

```ts
  if (passo.acao === 'perguntar' || passo.acao === 'repetir') {
    const corpo =
      passo.acao === 'repetir' ? `${REPETICAO}\n\n${passo.pergunta.corpo}` : passo.pergunta.corpo
```

Substitua por:

```ts
  if (passo.acao === 'perguntar' || passo.acao === 'repetir') {
    // Na repetição vai o corpo sem saudação, quando o roteiro oferecer um: o
    // menu 1 abre com "Oi! Aqui é da Artha" e repetir isso dá um segundo olá na
    // mesma conversa. Spec §4.4.
    const corpo =
      passo.acao === 'repetir'
        ? `${REPETICAO}\n\n${passo.pergunta.corpoRepetido ?? passo.pergunta.corpo}`
        : passo.pergunta.corpo
```

- [ ] **Step 3: Escolher a mensagem terminal pelo id**

Encontre este bloco no fim de `executarBot`:

```ts
  if (passo.comFecho) {
    const resposta = await enviarTexto(gatilho.phone, FECHO)
    await gravarSaida(gatilho, resposta.messages[0]?.id ?? null, FECHO, 'text')
  }
```

Substitua por:

```ts
  if (passo.comFecho) {
    // A resposta é escolhida pelo id que encerrou o roteiro, não é mais uma
    // constante. Quem apertou "Preços" recebe preço; quem pediu gente recebe o
    // fecho. Spec §4.3.
    const texto = mensagemTerminal(passo.idP1, passo.idP2)
    const resposta = await enviarTexto(gatilho.phone, texto)
    await gravarSaida(gatilho, resposta.messages[0]?.id ?? null, texto, 'text')
  }
```

- [ ] **Step 4: Atualizar o comentário que ficou desatualizado**

Logo acima do bloco `if (gatilho.leadId)` existe este comentário. A razão continua valendo, só o nome da coisa mudou: não é mais "o fecho", é "a resposta".

De:

```ts
  // encerrar. A qualificação vem ANTES do fecho de propósito: o fecho é
  // cortesia, a qualificação é o produto inteiro do bot. A trava de `bot_acoes`
```

Para:

```ts
  // encerrar. A qualificação vem ANTES da resposta de propósito: a resposta é
  // cortesia, a qualificação é o produto inteiro do bot. A trava de `bot_acoes`
```

O resto do comentário fica intacto.

- [ ] **Step 5: Type-check e suíte**

Run: `npx tsc --noEmit`
Expected: sem saída, código 0.

Run: `npm test`
Expected: 205 passando, 14 pulados.

- [ ] **Step 6: Commit**

```bash
git add src/server/bot/executar.ts
git commit -m "Aperta X sai X: o executor escolhe a resposta pelo id terminal"
```

---

### Task 4: Corrigir o preço no CLAUDE.md e registrar no ROADMAP

O `CLAUDE.md` diz "R$97/mês ou R$997/ano" e omite a taxa de adesão de R$100. Enquanto era contexto de demo, não fazia mal. Agora é a fonte de uma string que sai no WhatsApp de cliente real.

**Files:**
- Modify: `CLAUDE.md:55`
- Modify: `ROADMAP.md`

- [ ] **Step 1: Corrigir a linha 55 do `CLAUDE.md`**

De:

```
| **Artha** | B2C, pessoa física | Open Finance. R$97/mês ou R$997/ano |
```

Para:

```
| **Artha** | B2C, pessoa física | Open Finance. Mensal R$197 no 1º mês (adesão de R$100) e R$97 depois; anual R$997 sem adesão |
```

- [ ] **Step 2: Registrar a entrega no `ROADMAP.md`**

Insira esta seção **imediatamente antes** da linha `## [NA FILA]`:

```markdown
## Concluído (2026-08-25) — URA de respostas

O bot deixou de ser formulário de triagem. Os sete finais do roteiro caíam todos
na mesma frase de espera: aperta X, sai "aguarde um humano". Agora cada id
terminal entrega texto próprio. Spec:
`docs/superpowers/specs/2026-08-25-ura-de-respostas-design.md`.

O nível 2 trocou de propósito. Era "Você já usou a Artha?" e "Quantos clientes
você atende?", perguntas que serviam à operação; passou a ser "O que você quer
saber?", que serve a quem apertou e qualifica igual. Quem aperta "Quero começar"
vale mais que quem responde "já testei".

`src/lib/bot/estado.ts` não foi tocado: o motor já devolvia os ids terminais e
nunca decidiu texto. A mudança inteira é dado em `roteiro.ts` mais duas linhas
em `executar.ts`.

**Dívida que nasce aqui:** o bot passou a afirmar preço. A fonte é
`https://artha.ia.br`, lida em 2026-08-25, e `RESPOSTA_POR_ID['p2:artha_preco']`
é uma string literal. Nada liga as duas pontas — quando o preço mudar no site,
alguém tem de trocar a string à mão. O `CLAUDE.md` foi corrigido junto: ele dizia
"R$97/mês" e omitia a taxa de adesão de R$100.

**Ainda em aberto:** Dhana não tem preço público em lugar nenhum, então o ramo do
planejador não tem botão de preço e quem pergunta chega em gente.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md ROADMAP.md
git commit -m "Preco da Artha inclui a adesao de R\$100, que o CLAUDE.md omitia"
```

---

### Task 5: Portões

Nenhuma afirmação de "pronto" antes destes quatro comandos passarem, com a saída na tela.

**Files:** nenhum

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: sem erro.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem saída, código 0.

- [ ] **Step 3: Testes**

Run: `npm test`
Expected: **205 passando, 14 pulados.** Se o número de passando subiu, foram os testes novos do roteiro e está certo — reporte o número real. Se algum dos 29 de `estado.test.ts` falhou, o motor foi tocado e a mudança está errada.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build completo sem erro.

- [ ] **Step 5: Varredura de conformidade**

```bash
grep -rn "Lúcia\|Clara\|LucIA" src/lib/bot/ src/server/bot/
```

Expected: **nenhuma linha.** Nome de persona em copy é proibido pelo `CLAUDE.md`.

```bash
grep -n "R\$97\|R\$997\|R\$197" src/lib/bot/roteiro.ts
```

Expected: uma linha só, a de `p2:artha_preco`, com os três valores.

---

## Verificação manual (depende do número WABA)

Não bloqueia o merge. O número WABA continua pendente no ROADMAP, e estes passos
só rodam quando ele existir. `!reset` limpa o telefone entre as passadas.

1. `Minhas finanças` → `Preços` devolve o texto de preço. O lead fica `segmento: artha`, `stage: qualificado`, tag `quer-saber-preco`.
2. `Minhas finanças` → `Quero começar` devolve o link clicável, sozinho na linha.
3. `Sou planejador` → `Ver demonstração` devolve o fecho. Lead fica `segmento: dhana`, tag `dhana-quer-demo`.
4. `Falar com alguém` no menu 1 devolve o fecho sem passar pelo menu 2.
5. Escrever texto em vez de apertar repete a pergunta **sem repetir o "Oi!"**, e na segunda vez entrega ao humano em silêncio.
