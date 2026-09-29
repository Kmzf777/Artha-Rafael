# Botões na conversa — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quem atende no CRM ver quais botões o bot ofereceu, e qual o lead
tocou — em todo o histórico, inclusive no que já está gravado.

**Architecture:** Os botões são **derivados** do roteiro, não gravados. O corpo
de uma pergunta do bot é string literal exata, então casar `content` contra as
perguntas conhecidas é igualdade, não heurística — e conserta retroativamente o
banco inteiro. O disparo passa a gravar o texto que o lead recebeu no lugar do
nome do template, que é o que faz o caminho de template, já construído, voltar a
funcionar.

**Tech Stack:** TypeScript, Vitest, React 19, Next.js App Router.

**Spec:** `docs/superpowers/specs/2026-09-29-botoes-na-conversa-design.md`

---

## Como rodar teste neste projeto

Durante as tarefas, **rode só o arquivo de teste da tarefa**. `npm test` e
`npm run build` rodam **uma vez só**, na Tarefa 6.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Tarefa |
| --- | --- | --- |
| `src/lib/conversationTypes.ts` | `Message` declara `enviado_por` e `button_id` | T1 |
| `src/lib/timeline.test.ts` · `src/mock/store.ts` · `src/hooks/useMessageSender.ts` | os três literais ganham os campos | T1 |
| `src/lib/templates.ts` + teste | `renderizarCorpo` | T2 |
| `src/lib/botoesDaConversa.ts` + teste | `mapearBotoes` — a régua | T3 |
| `src/server/fila.ts` | grava o corpo renderizado | T4 |
| `src/components/MessageBubble.tsx` · `MessageTimeline.tsx` | desenha e alimenta | T5 |
| `ROADMAP.md` | registro e verificação | T6 |

### Ondas

Regra do `CLAUDE.md` §5: agentes simultâneos nunca dividem arquivo.

| Onda | Em paralelo | Depende de |
| --- | --- | --- |
| 1 | **T1**, **T2** | — |
| 2 | **T3**, **T4** | T3 ← T1 · T4 ← T2 |
| 3 | **T5** | T3 |
| 4 | **T6** | tudo |

T5 pega os dois componentes junto de propósito: a prop é renomeada, e renomear
entre dois arquivos com dois agentes é exatamente a colisão que a regra proíbe.

---

## Tarefa 1 — O tipo de fio declara o que já chega

**Files:**
- Modify: `src/lib/conversationTypes.ts`
- Modify: `src/lib/timeline.test.ts`
- Modify: `src/mock/store.ts`
- Modify: `src/hooks/useMessageSender.ts`

`mensagensDoCard` faz `select('*')`, então `enviado_por` e `button_id` **já
viajam** até o cliente. Só não estão tipados, e sem eles a régua da T3 não tem
como aplicar a guarda de autoria nem casar o clicado por id.

- [ ] **Step 1: Declarar os campos**

Em `src/lib/conversationTypes.ts`, dentro do type `Message`, depois de
`reply_to_message_id`:

```ts
  /**
   * Autoria da saída: nome do humano, `'bot'`, ou `null` quando ninguém está
   * identificado. Já vinha do `select('*')` e não estava declarado.
   */
  enviado_por: string | null
  /**
   * Id do botão tocado. Só em mensagem de entrada.
   *   interactive.button_reply.id  → botão do bot
   *   button.payload               → quick reply de template
   */
  button_id: string | null
```

**Obrigatórios, não opcionais.** As colunas existem em toda linha e o
`select('*')` sempre as traz; opcional tornaria `undefined` um estado que o banco
nunca produz.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx tsc --noEmit`
Expected: três erros de `Property 'enviado_por' is missing`, em
`src/lib/timeline.test.ts`, `src/mock/store.ts` e `src/hooks/useMessageSender.ts`.

- [ ] **Step 3: Consertar os três literais**

Em `src/lib/timeline.test.ts`, no objeto da fábrica `msg`, logo depois de
`raw_payload: null,`:

```ts
    enviado_por: null,
    button_id: null,
```

Em `src/mock/store.ts`, no objeto de retorno, depois de
`reply_to_message_id: extra?.respondeA ?? null,`:

```ts
    enviado_por: null,
    button_id: null,
```

Em `src/hooks/useMessageSender.ts`, no literal `enviada`, depois de
`reply_to_message_id: extra.respondeA ?? null,`:

```ts
        enviado_por: null,
        button_id: null,
```

`null` nos três: a mensagem otimista do operador não carrega autoria (a rota
grava `enviadoPor ?? null`), o mock não tem bot, e a fábrica do teste é a base
que cada caso sobrescreve.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx tsc --noEmit`
Expected: sem erro.

Run: `npx vitest run src/lib/timeline.test.ts`
Expected: PASS, todos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/conversationTypes.ts src/lib/timeline.test.ts src/mock/store.ts src/hooks/useMessageSender.ts
git commit -m 'Tipo de fio declara enviado_por e button_id, que o select ja trazia' -m 'Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>'
```

---

## Tarefa 2 — `renderizarCorpo`

**Files:**
- Modify: `src/lib/templates.ts`
- Test: `src/lib/templates.test.ts`

- [ ] **Step 1: O teste que falha**

Acrescente ao final de `src/lib/templates.test.ts`:

```ts
describe('renderizarCorpo', () => {
  it('substitui a variável pelo valor', () => {
    expect(renderizarCorpo('Oi, {{1}}. Tudo bem?', ['Rafael'])).toBe('Oi, Rafael. Tudo bem?')
  })

  it('substitui por posição, não por ordem de aparição', () => {
    expect(renderizarCorpo('{{2}} e {{1}}', ['um', 'dois'])).toBe('dois e um')
  })

  it('variável sem valor fica literal no texto', () => {
    // Apagar produziria um texto que NÃO é o que o lead recebeu, e a tela existe
    // para mostrar o que ele viu. Um {{2}} visível é sinal de campanha mal
    // montada, e esconder isso não conserta nada.
    expect(renderizarCorpo('Oi, {{1}}. Veja {{2}}.', ['Rafael'])).toBe('Oi, Rafael. Veja {{2}}.')
  })

  it('corpo sem variável volta igual', () => {
    expect(renderizarCorpo('Sem variável nenhuma.', ['Rafael'])).toBe('Sem variável nenhuma.')
  })

  it('lista vazia não altera nada', () => {
    expect(renderizarCorpo('Oi, {{1}}.', [])).toBe('Oi, {{1}}.')
  })
})
```

Acrescente `renderizarCorpo` ao import de `./templates` no topo do arquivo.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/templates.test.ts`
Expected: FAIL — `renderizarCorpo is not a function`.

- [ ] **Step 3: Implementar**

Em `src/lib/templates.ts`, acrescente logo depois de `contarVariaveis`:

```ts
/**
 * O corpo com as variáveis substituídas — o texto que o lead de fato recebeu.
 *
 * Existe porque a fila precisa gravar em `messages.content` o que saiu, e não o
 * nome do template. Ver spec 2026-09-29 §5.
 *
 * VARIÁVEL SEM VALOR FICA COMO ESTÁ. Apagá-la produziria um texto que não é o
 * que o lead viu, e a tela de conversa existe para mostrar a conversa como ela
 * aconteceu. Um `{{2}}` visível é sinal de campanha mal montada, e escondê-lo
 * não conserta a campanha.
 */
export function renderizarCorpo(corpo: string, variaveis: string[]): string {
  return corpo.replace(VARIAVEL, (bruto, n: string) => variaveis[Number(n) - 1] ?? bruto)
}
```

`VARIAVEL` já existe no arquivo.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/templates.test.ts`
Expected: PASS, todos, inclusive os antigos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/templates.ts src/lib/templates.test.ts
git commit -m 'renderizarCorpo: o texto que o lead recebeu, nao o molde' -m 'Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>'
```

---

## Tarefa 3 — A régua

**Files:**
- Create: `src/lib/botoesDaConversa.ts`
- Create: `src/lib/botoesDaConversa.test.ts`

**Depende de T1** (`Message.enviado_por` e `Message.button_id`).

- [ ] **Step 1: O teste que falha**

Crie `src/lib/botoesDaConversa.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { AUTOR_BOT, P1, P2_POR_RAMO, REPETICAO, RTV2 } from './bot/roteiro'
import { mapearBotoes } from './botoesDaConversa'
import type { Message } from './conversationTypes'
import type { Template } from '@/mock/types'

let n = 0
function msg(over: Partial<Message>): Message {
  n += 1
  return {
    id: `m${n}`,
    message_id: `wamid.${n}`,
    phone: '34988861441',
    phone_id: '1',
    bsuid: null,
    contact_name: null,
    message_type: 'text',
    content: null,
    direction: 'inbound',
    created_at: `2026-09-29T12:00:${String(n).padStart(2, '0')}Z`,
    raw_payload: null,
    media_id: null,
    media_mime_type: null,
    media_storage_path: null,
    reply_to_message_id: null,
    enviado_por: null,
    button_id: null,
    ...over,
  }
}

const pergunta = (corpo: string) =>
  msg({ direction: 'outbound', message_type: 'interactive', content: corpo, enviado_por: AUTOR_BOT })
const toque = (id: string, titulo: string) =>
  msg({ message_type: 'interactive', button_id: id, content: titulo })

const TEMPLATE: Template = {
  nome: 'mkt_rtv_isencao_01',
  categoria: 'MARKETING',
  idioma: 'pt_BR',
  corpo: 'Oi, {{1}}. Volte para o Artha.',
  botoes: ['Quero voltar', 'Tive um problema', 'Não quero receber'],
  status: 'aprovado',
}

describe('mapearBotoes — pergunta do bot', () => {
  it('1. o corpo da p1 devolve os três rótulos, na ordem', () => {
    const p = pergunta(P1.corpo)
    expect(mapearBotoes([p], []).get(p.id)?.rotulos).toEqual(P1.botoes.map((b) => b.titulo))
  })

  it('2. a forma de repetição devolve os mesmos rótulos', () => {
    const p = pergunta(`${REPETICAO}\n\n${P1.corpoRepetido}`)
    expect(mapearBotoes([p], []).get(p.id)?.rotulos).toEqual(P1.botoes.map((b) => b.titulo))
  })

  it('3. repetição do nível 2 depois de p1:artha devolve os botões da Artha', () => {
    const artha = P2_POR_RAMO['p1:artha']
    const hist = [
      pergunta(P1.corpo),
      toque('p1:artha', 'Minhas finanças'),
      pergunta(artha.corpo),
      msg({ content: 'texto solto' }),
      pergunta(`${REPETICAO}\n\n${artha.corpoRepetido}`),
    ]
    const alvo = hist[hist.length - 1]
    expect(mapearBotoes(hist, []).get(alvo.id)?.rotulos).toEqual(artha.botoes.map((b) => b.titulo))
  })

  it('4. a MESMA repetição depois de p1:dhana devolve os botões da Dhana', () => {
    // 3 e 4 são o par que prova a desambiguação. Os dois ramos têm
    // `corpoRepetido` IDÊNTICO e botões diferentes; um teste sozinho não prova
    // nada, porque passaria por acidente.
    const dhana = P2_POR_RAMO['p1:dhana']
    const hist = [
      pergunta(P1.corpo),
      toque('p1:dhana', 'Sou planejador'),
      pergunta(dhana.corpo),
      msg({ content: 'texto solto' }),
      pergunta(`${REPETICAO}\n\n${dhana.corpoRepetido}`),
    ]
    const alvo = hist[hist.length - 1]
    expect(mapearBotoes(hist, []).get(alvo.id)?.rotulos).toEqual(dhana.botoes.map((b) => b.titulo))
  })

  it('5. repetição ambígua sem nenhum p1 antes não devolve botões', () => {
    const p = pergunta(`${REPETICAO}\n\n${P2_POR_RAMO['p1:artha'].corpoRepetido}`)
    expect(mapearBotoes([p], []).has(p.id)).toBe(false)
  })

  it('6. corpo desconhecido não devolve botões', () => {
    const p = pergunta('Uma frase que o roteiro nunca disse.')
    expect(mapearBotoes([p], []).has(p.id)).toBe(false)
  })

  it('7. interativa que não é do bot não devolve botões, mesmo casando o corpo', () => {
    // Disparo simulado e envio manual usam `interactive` sem autoria de bot.
    // Dar botões de roteiro a eles seria inventar o que a pessoa recebeu.
    const p = msg({
      direction: 'outbound',
      message_type: 'interactive',
      content: P1.corpo,
      enviado_por: null,
    })
    expect(mapearBotoes([p], []).has(p.id)).toBe(false)
  })

  it('8. o clicado sai do id do próximo inbound, não do texto', () => {
    const p = pergunta(P1.corpo)
    const t = toque('p1:artha', 'ROTULO QUE NAO EXISTE')
    expect(mapearBotoes([p, t], []).get(p.id)?.clicado).toBe('Minhas finanças')
  })

  it('9. sem id conhecido no próximo inbound, clicado é null', () => {
    const p = pergunta(P1.corpo)
    expect(mapearBotoes([p, msg({ content: 'escrevi à mão' })], []).get(p.id)?.clicado).toBeNull()
  })

  it('10. a triagem do ramo de campanha também é reconhecida', () => {
    const p = pergunta(RTV2.corpo)
    expect(mapearBotoes([p], []).get(p.id)?.rotulos).toEqual(RTV2.botoes.map((b) => b.titulo))
  })

  it('11. os corpos de primeira vez são distintos entre si', () => {
    // O índice é um Map por corpo. Se duas perguntas passarem a ter o mesmo
    // corpo, a última vence EM SILÊNCIO e a bolha mostra os botões da outra —
    // que é exatamente o modo de falha que a desambiguação do `corpoRepetido`
    // existe para evitar. Este teste vigia o outro índice, o que hoje não tem
    // colisão e por isso não tem defesa em runtime.
    const corpos = [P1, ...Object.values(P2_POR_RAMO), RTV2].map((p) => p.corpo)
    expect(new Set(corpos).size).toBe(corpos.length)
  })
})

describe('mapearBotoes — disparo de template', () => {
  it('12. corpo que casa o template devolve botões e nome', () => {
    const d = msg({
      direction: 'outbound',
      message_type: 'template',
      content: 'Oi, Rafael. Volte para o Artha.',
    })
    const r = mapearBotoes([d], [TEMPLATE]).get(d.id)
    expect(r?.rotulos).toEqual(TEMPLATE.botoes)
    expect(r?.nomeTemplate).toBe('mkt_rtv_isencao_01')
  })

  it('13. corpo que não casa nada não devolve botões', () => {
    const d = msg({ direction: 'outbound', message_type: 'template', content: 'mkt_rtv_isencao_01' })
    expect(mapearBotoes([d], [TEMPLATE]).has(d.id)).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/botoesDaConversa.test.ts`
Expected: FAIL — o módulo não existe.

- [ ] **Step 3: Implementar**

Crie `src/lib/botoesDaConversa.ts`:

```ts
// Quais botões cada bolha ofereceu, e qual o lead tocou.
//
// DERIVADO, não gravado. O corpo de uma pergunta do bot é string literal exata
// — diferente do template, não tem variável — então casar `content` contra o
// roteiro é igualdade, não heurística. E derivar conserta o histórico inteiro
// que já está no banco, coisa que gravar no envio não faria.
//
// A FALHA É MUDA, NUNCA ERRADA: corpo que não casa devolve bolha sem botão, que
// é o comportamento de antes desta onda. Spec 2026-09-29 §3.1.
import type { Template } from '@/mock/types'
import {
  AUTOR_BOT,
  ehIdP1,
  P1,
  P2_POR_RAMO,
  REPETICAO,
  RTV2,
  type Botao,
  type Pergunta,
} from './bot/roteiro'
import type { Message } from './conversationTypes'

export type BotoesDaBolha = {
  /** Rótulos na ordem em que foram oferecidos. */
  rotulos: string[]
  /** O rótulo que o lead tocou, quando tocou. */
  clicado: string | null
  /** Nome do template, quando a bolha é um disparo. `null` para o bot. */
  nomeTemplate: string | null
}

/** Toda pergunta que o bot sabe fazer. DERIVADA, nunca escrita à mão. */
const PERGUNTAS: Pergunta[] = [P1, ...Object.values(P2_POR_RAMO), RTV2]

/** Corpo da primeira vez. Os corpos são distintos entre si. */
const POR_CORPO = new Map(PERGUNTAS.map((p) => [p.corpo, p]))

/**
 * Corpo de repetição → perguntas que o produzem. É LISTA, não valor único: os
 * dois ramos do nível 2 têm `corpoRepetido` idêntico ("O que você quer saber?")
 * e conjuntos de botões diferentes. Ver §4.2 da spec.
 */
const POR_REPETICAO = new Map<string, Pergunta[]>()
for (const p of PERGUNTAS) {
  const chave = `${REPETICAO}\n\n${p.corpoRepetido}`
  POR_REPETICAO.set(chave, [...(POR_REPETICAO.get(chave) ?? []), p])
}

/** O corpo do template tem no máximo um `{{1}}`; o resto casa literalmente. */
function corpoCasa(corpo: string, conteudo: string): boolean {
  const partes = corpo.split('{{1}}')
  if (partes.length !== 2) return corpo === conteudo
  const [inicio, fim] = partes
  return (
    conteudo.length >= inicio.length + fim.length &&
    conteudo.startsWith(inicio) &&
    conteudo.endsWith(fim)
  )
}

/**
 * A pergunta que produziu este corpo. `ramo` é o último `p1:*` respondido antes
 * da bolha, e só é consultado quando o corpo é ambíguo.
 */
function perguntaDoCorpo(corpo: string, ramo: string | null): Pergunta | null {
  const direta = POR_CORPO.get(corpo)
  if (direta) return direta

  const candidatas = POR_REPETICAO.get(corpo)
  if (!candidatas) return null
  if (candidatas.length === 1) return candidatas[0]

  // Ambígua. Sem o ramo, calar é a única resposta honesta: mostrar os botões da
  // Dhana para quem está na Artha é mentira na tela.
  if (!ramo) return null
  const doRamo = P2_POR_RAMO[ramo]
  return doRamo && candidatas.includes(doRamo) ? doRamo : null
}

/**
 * O título do botão cujo ID casa o próximo inbound.
 *
 * ID É CONTRATO, TÍTULO É COPY — a regra que `roteiro.ts` declara no cabeçalho.
 * Casar pelo id deixa a marcação imune a troca de rótulo, e é mais forte que o
 * caminho de template, que só conhece títulos.
 */
function tituloClicado(botoes: Botao[], mensagens: Message[], i: number): string | null {
  const proximo = mensagens.slice(i + 1).find((m) => m.direction === 'inbound')
  if (!proximo?.button_id) return null
  return botoes.find((b) => b.id === proximo.button_id)?.titulo ?? null
}

export function mapearBotoes(
  mensagens: Message[],
  templates: Template[]
): Map<string, BotoesDaBolha> {
  const mapa = new Map<string, BotoesDaBolha>()
  let ramo: string | null = null

  mensagens.forEach((msg, i) => {
    // O ramo é carregado enquanto se percorre, do mesmo jeito que `proximoPasso`
    // carrega `idP1`. Atualiza antes de resolver a bolha: a resposta do lead
    // nunca é a mesma mensagem que a pergunta do bot.
    if (msg.direction === 'inbound' && ehIdP1(msg.button_id)) ramo = msg.button_id

    if (msg.direction !== 'outbound' || !msg.content) return

    if (msg.message_type === 'interactive' && msg.enviado_por === AUTOR_BOT) {
      const pergunta = perguntaDoCorpo(msg.content, ramo)
      if (!pergunta) return
      mapa.set(msg.id, {
        rotulos: pergunta.botoes.map((b) => b.titulo),
        clicado: tituloClicado(pergunta.botoes, mensagens, i),
        nomeTemplate: null,
      })
      return
    }

    if (msg.message_type === 'template') {
      const conteudo = msg.content
      const template = templates.find((t) => corpoCasa(t.corpo, conteudo))
      if (!template) return
      // O clicado do template casa por TEXTO, não por id: aqui só se conhecem
      // os títulos, e é o título que a Meta manda como conteúdo do toque.
      const proximo = mensagens.slice(i + 1).find((m) => m.direction === 'inbound')
      const clicado =
        proximo?.message_type === 'button' &&
        proximo.content &&
        template.botoes.includes(proximo.content)
          ? proximo.content
          : null
      mapa.set(msg.id, { rotulos: template.botoes, clicado, nomeTemplate: template.nome })
    }
  })

  return mapa
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/botoesDaConversa.test.ts`
Expected: PASS, os treze.

Run: `npx tsc --noEmit`
Expected: sem erro no seu arquivo. Erro em `src/server/fila.ts` é do agente em
voo da T4 — ignore e reporte.

- [ ] **Step 5: Commit**

```bash
git add src/lib/botoesDaConversa.ts src/lib/botoesDaConversa.test.ts
git commit -m 'Regua dos botoes da conversa, derivada do roteiro' -m 'Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>'
```

---

## Tarefa 4 — A fila grava o texto

**Files:**
- Modify: `src/server/fila.ts`

**Depende de T2** (`renderizarCorpo`).

- [ ] **Step 1: Imports**

Em `src/server/fila.ts`, troque o import de `@/lib/templates` para:

```ts
import { componentesDeBotao, renderizarCorpo, type ComponenteEnvio } from '@/lib/templates'
```

E acrescente, junto dos outros imports de repo:

```ts
import { listarTemplates } from '@/server/repo/templates'
```

Confirme o caminho lendo os imports que já existem no arquivo — se os vizinhos
usam caminho relativo, siga o idioma deles.

- [ ] **Step 2: Ler os corpos uma vez por lote**

Logo depois de reservar o lote e antes do laço de envio, acrescente:

```ts
  // Uma leitura por LOTE, não por agendamento: o corpo é o mesmo para todos os
  // envios da mesma campanha, e buscar por lead multiplicaria a consulta por 20.
  const corpoPorNome = new Map((await listarTemplates()).map((t) => [t.nome, t.corpo]))
```

- [ ] **Step 3: Gravar o texto no lugar do nome**

Dentro do laço, troque `content: a.template,` por `content: conteudo,` e
acrescente, logo antes do objeto `linha`:

```ts
      // O TEXTO QUE O LEAD RECEBEU, não o nome do template. O CRM existe para
      // mostrar a conversa como ela aconteceu, e `mkt_rtv_isencao_01` numa bolha
      // não é conversa nenhuma. É também o que permite a timeline casar o
      // disparo com o template cadastrado e desenhar os botões.
      //
      // Template ausente do cache local (sync não rodado) cai no nome, como
      // antes. Pior que o ideal, igual ao presente, nunca mentira.
      const molde = corpoPorNome.get(a.template)
      const conteudo = molde ? renderizarCorpo(molde, variaveis) : a.template
```

`variaveis` já está no escopo, montado algumas linhas acima.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erro no seu arquivo. Erros em `src/lib/botoesDaConversa.ts` ou nos
componentes são de agentes em voo — ignore e reporte.

- [ ] **Step 5: Verificação por leitura**

Escreva no relatório:

1. `listarTemplates()` é chamada **uma vez**, fora do laço?
2. Um template ausente do cache deixa `content` com o nome, sem estourar?
3. A régua de `podeDisparar` e a montagem de `componentesDeBotao` continuam
   intocadas?

- [ ] **Step 6: Commit**

```bash
git add src/server/fila.ts
git commit -m 'Disparo grava o texto que o lead recebeu, nao o nome do template' -m 'Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>'
```

---

## Tarefa 5 — A bolha desenha, a timeline alimenta

**Files:**
- Modify: `src/components/MessageBubble.tsx`
- Modify: `src/components/conversations/MessageTimeline.tsx`

**Depende de T3.** Os dois arquivos vão juntos porque a prop é renomeada entre
eles.

- [ ] **Step 1: A bolha**

Em `src/components/MessageBubble.tsx`:

Troque, no type `MessageBubbleProps`:

```ts
  /** Botões do template disparado — só quando a bolha é `template`. */
  botoesTemplate?: readonly string[]
```

por:

```ts
  /** Rótulos dos botões que esta bolha ofereceu, do template ou do roteiro. */
  botoes?: readonly string[]
```

Troque `botoesTemplate,` por `botoes,` na desestruturação dos parâmetros.

Troque a condição da lista:

```tsx
        {ehTemplate && botoesTemplate && botoesTemplate.length > 0 && (
```

por:

```tsx
        {botoes && botoes.length > 0 && (
```

e, dentro dela, `botoesTemplate.map(` por `botoes.map(`.

Ajuste o comentário acima da lista, que hoje diz "Botões do template":

```tsx
        {/* Os botões que a bolha ofereceu — quick reply de template ou botão do
            roteiro. O que o lead tocou aparece marcado; os demais recuam por
            opacidade, não por cor — a régua de estado sem matiz vale aqui. */}
```

A legenda "Template · nome" **continua** condicionada a `ehTemplate`. Pergunta do
bot não ganha etiqueta: a polaridade da bolha já diz de quem é, e um rótulo a
mais só polui.

- [ ] **Step 2: A timeline**

Em `src/components/conversations/MessageTimeline.tsx`:

**Apague** a função `corpoCasa`, o type `Disparo` e a função `mapearDisparos`
inteiros. Eles foram para `src/lib/botoesDaConversa.ts`.

Acrescente aos imports:

```ts
import { mapearBotoes } from '@/lib/botoesDaConversa'
```

Troque a linha do `useMemo`:

```ts
  const disparos = useMemo(() => mapearDisparos(mensagens, templates), [mensagens, templates])
```

por:

```ts
  const botoes = useMemo(() => mapearBotoes(mensagens, templates), [mensagens, templates])
```

E, dentro do `map` das mensagens, troque:

```tsx
              const disparo = disparos.get(msg.id)
```

por:

```tsx
              const daBolha = botoes.get(msg.id)
```

e as três props:

```tsx
                    botoes={daBolha?.rotulos}
                    nomeTemplate={daBolha?.nomeTemplate ?? null}
                    botaoClicado={daBolha?.clicado ?? null}
```

- [ ] **Step 3: Type-check e lint**

Run: `npx tsc --noEmit`
Expected: sem erro.

Run: `npm run lint`
Expected: limpo. Se sobrar import não usado (`Template` continua usado na prop;
`corpoCasa` sai junto com a função), o lint acusa — remova o que ficou morto.

- [ ] **Step 4: Verificação por leitura**

Escreva no relatório:

1. A lista de botões desenha agora para `interactive` além de `template`?
2. A legenda "Template · nome" continua só para `template`?
3. Sobrou algum uso de `botoesTemplate` em qualquer arquivo?
   (`grep -rn botoesTemplate src/` tem de voltar vazio.)

- [ ] **Step 5: Commit**

```bash
git add src/components/MessageBubble.tsx src/components/conversations/MessageTimeline.tsx
git commit -m 'A bolha desenha botao de qualquer origem, e a timeline usa a regua nova' -m 'Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>'
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

Expected: os quatro limpos. Partindo de 340 passando, a contagem sobe com os
testes das tarefas 2 e 3.

- [ ] **Step 2: Registrar no ROADMAP**

Acrescente antes de `## [NA FILA]`:

```markdown
## Concluído (2026-09-29) — botões na conversa

O gestor: *"em conversas, as mensagens enviadas pelo bot de botão não mostra as
opções de botão que foram enviadas ao lead, para quem está usando o crm fica
confuso"*. Spec:
`docs/superpowers/specs/2026-09-29-botoes-na-conversa-design.md`.

Eram **dois** defeitos com o mesmo sintoma. O bot nunca gravou os botões —
`gravarSaida` grava só `content`. E o disparo gravava o NOME do template em
`content`, então a bolha mostrava `mkt_rtv_isencao_01` como texto da mensagem, e
o casamento com o template comparava corpo contra nome e nunca achava.

**Os botões são derivados do roteiro, não gravados.** O corpo de uma pergunta do
bot é string literal exata, então casar é igualdade, não heurística — e derivar
conserta retroativamente todo o histórico que já está no banco, coisa que gravar
no envio não faria. A falha é muda, nunca errada: corpo que não casa devolve
bolha sem botão, que é o comportamento anterior.

**Uma ambiguidade real teve de ser resolvida.** Os dois ramos do nível 2 têm
`corpoRepetido` idêntico ("O que você quer saber?") e botões diferentes. Casar só
por texto mostraria os botões da Dhana para quem está na Artha. A desambiguação
usa o último `p1:*` respondido antes da bolha, o mesmo sinal que `proximoPasso`
carrega como `idP1`.

**O clicado casa por id, não por texto**, no caminho do bot. Id é contrato,
título é copy.

**A fila passa a gravar o texto renderizado.** `renderizarCorpo` substitui as
variáveis, e variável sem valor fica literal — apagá-la produziria um texto que
não é o que o lead recebeu.

**Contrato de dado:** mensagem antiga de disparo continua com o nome, nova com o
texto. A régua resolve cada uma pelo que ela tem, e não há migração de
histórico — nenhuma campanha real saiu pela fila ainda.
```

- [ ] **Step 3: Commit**

```bash
git add ROADMAP.md
git commit -m 'ROADMAP registra os botoes na conversa' -m 'Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>'
```

- [ ] **Step 4: Verificação na tela, com o gestor**

- [ ] Abrir Conversas na conversa de teste e ver, sob a pergunta do bot, os três
      botões com o tocado marcado.
- [ ] Conferir nos dois temas, e que o alvo de toque das linhas segue em 44px.

---

## O que este plano não faz

- Guardar botão no banco, coluna nova ou migration.
- Migrar o `content` de disparos antigos.
- Legenda de "resposta ao botão" para toque em mensagem interativa.
- Trocar copy do roteiro para desfazer a ambiguidade do `corpoRepetido`.
- Mexer no desenho da bolha além da condição de renderizar e do nome da prop.
