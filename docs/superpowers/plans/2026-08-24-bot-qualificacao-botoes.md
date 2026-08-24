# Bot de qualificação por botões — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um bot de botões, sem IA, que qualifica quem escreve pela primeira vez para o número da Artha — separando B2C (Artha) de B2B (Dhana) — e um painel que deixa de falar de reativação e passa a falar de atendimento e qualificação.

**Architecture:** O bot vive dentro do webhook que já existe, no `after()` que roda depois da resposta 200. Nenhuma tabela de sessão: o passo do roteiro é função pura sobre o histórico de mensagens da conversa, em `src/lib/bot/`, testada sem banco. Uma tabela-trava de uma coluna cobre entrega simultânea da Meta. O painel muda de fonte de número, não de estrutura — `getMetrics()` já devolve tudo que as telas novas precisam.

**Tech Stack:** Next.js 16.2 (App Router, `after()`), TypeScript, Supabase Postgres, WhatsApp Cloud API (`type: interactive`), vitest.

**Spec:** `docs/superpowers/specs/2026-08-24-bot-qualificacao-botoes-design.md`

---

## Mapa de arquivos

### Onda A — o bot

| Arquivo | Responsabilidade |
| --- | --- |
| `supabase/migrations/0002_bot_qualificacao.sql` *(novo)* | Coluna `messages.button_id` e tabela `bot_acoes` |
| `src/lib/webhookParse.ts` | Passa a extrair o id do botão, além do título |
| `src/lib/webhookParse.test.ts` | Dois casos novos |
| `src/lib/bot/roteiro.ts` *(novo)* | O roteiro como dado: perguntas, ids, títulos, ramificação, mapas de id → segmento/tag. Puro, sem lógica de decisão |
| `src/lib/bot/roteiro.test.ts` *(novo)* | Invariantes da Cloud API: ≤3 botões, título ≤20 caracteres, ids únicos |
| `src/lib/bot/estado.ts` *(novo)* | `proximoPasso(mensagens)` — a única decisão do bot. Puro |
| `src/lib/bot/estado.test.ts` *(novo)* | Os 12 casos de comportamento |
| `src/server/meta/client.ts` | `enviarBotoes()` |
| `src/server/repo/mensagens.ts` | `historicoParaBot()`; `button_id` no tipo da linha; `atribuidoA` ignora `'bot'` |
| `src/server/repo/leads.ts` | `qualificarLead()` |
| `src/server/env.ts` | `botQualificacao` |
| `src/server/bot/executar.ts` *(novo)* | Orquestra: histórico → decisão → trava → envio → gravação |
| `src/app/api/webhook/route.ts` | Chama o bot dentro do `after()`, isolado em `try/catch` |

O corte entre `src/lib/bot/` e `src/server/bot/` é o do resto do projeto: regra pura de um lado, efeito colateral do outro. `estado.ts` não importa nada de `server/`, não toca banco e não conhece a Meta — é o que o torna testável em vitest sem infraestrutura.

### Onda B — o painel

| Arquivo | Responsabilidade |
| --- | --- |
| `src/components/Dashboard.tsx` | Banda e tiles trocam de fonte de número |
| `src/components/Reports.tsx` | Funil e tabela passam a medir leads, não campanhas |
| `src/app/(auth)/layout.tsx` | Copy e destaques |
| `CONTEXT.md` | O verbete Etapa |
| `ROADMAP.md` | Registro da entrega |

**Os dois conjuntos são disjuntos.** Nenhum arquivo aparece nas duas ondas. Podem rodar em paralelo, em agentes diferentes.

---

## Duas refinações da spec, decididas aqui

Registradas porque quem revisar vai comparar plano e spec:

**1. O gatilho vive dentro de `proximoPasso`, não fora dele.** A spec §3.1 descreve "sem inbound anterior" como condição de entrada. Mas a resposta do lead a um botão também chega como inbound — se a condição fosse checada em toda mensagem, o bot nunca passaria da primeira pergunta. A regra correta é: *quando o bot ainda não falou nesta conversa*, mais de um inbound significa que não é primeiro contato. Depois que o bot falou, o roteiro continua normalmente.

**2. `proximoPasso` não recebe `agora`.** Nada na decisão depende de tempo. A janela de 24h é checada no executor, imediatamente antes do envio, com `getWindowStatus` — que é onde ela pertence.

---

## Onda A — o bot

### Task 1: Migration

**Files:**
- Create: `supabase/migrations/0002_bot_qualificacao.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/0002_bot_qualificacao.sql
-- Bot de qualificação por botões. Spec 2026-08-24, §3.6 e §6.2.

-- O id do botão tocado. `content` continua guardando o TÍTULO, que é o que a
-- tela de Conversas mostra; o id é o que o roteiro usa para rotear, porque
-- título é copy e muda sem aviso.
--   interactive.button_reply.id  → mensagem interativa do bot
--   button.payload               → botão de resposta rápida de template
alter table messages add column if not exists button_id text;

-- Trava de concorrência do bot. NÃO é máquina de estados: guarda só o fato de
-- que aquele inbound já foi tratado. O estado do roteiro é derivado do
-- histórico de mensagens (§3.5).
--
-- A Meta reentrega quando a resposta demora mais que ~5s. Reentrega em série a
-- derivação resolve sozinha; duas entregas SIMULTÂNEAS leem o mesmo histórico
-- antes de qualquer uma escrever, e as duas mandariam o botão. O insert antes
-- do envio é o que serializa.
create table if not exists bot_acoes (
  inbound_message_id text primary key,
  criado_em timestamptz not null default now()
);

alter table bot_acoes enable row level security;
-- Sem policy: `deny all`, como todas as outras tabelas. O acesso é pelo
-- service role do servidor, que ignora RLS.
```

- [ ] **Step 2: Conferir que o padrão de RLS bate com o resto do schema**

Run: `grep -n "enable row level security" supabase/migrations/0001_schema.sql | head -3`
Expected: linhas mostrando o mesmo padrão em outras tabelas. Se `0001` usar uma
forma diferente (por exemplo `alter table ... force row level security`), copiar
a forma de lá em vez desta.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0002_bot_qualificacao.sql
git commit -m "Migration do bot: button_id em messages e a tabela-trava"
```

> **Nota para quem executa:** a migration NÃO é aplicada por este plano. O
> projeto Supabase ainda não tem credenciais (`ROADMAP.md`, bloqueio conhecido).
> O arquivo fica pronto para o SQL Editor quando o projeto existir.

---

### Task 2: O parser do webhook passa a guardar o id do botão

**Files:**
- Modify: `src/lib/webhookParse.ts`
- Test: `src/lib/webhookParse.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar ao fim de `src/lib/webhookParse.test.ts`:

```ts
describe('id do botão', () => {
  function envelope(mensagem: Record<string, unknown>) {
    return {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: '111' },
                contacts: [{ wa_id: '5534988861441', profile: { name: 'Rafael' } }],
                messages: [mensagem],
              },
            },
          ],
        },
      ],
    }
  }

  it('mensagem interativa guarda o id no button_id e o título no content', () => {
    const { mensagens } = parseWebhook(
      envelope({
        id: 'wamid.1',
        from: '5534988861441',
        timestamp: '1755000000',
        type: 'interactive',
        interactive: {
          type: 'button_reply',
          button_reply: { id: 'p1:artha', title: 'Minhas finanças' },
        },
      })
    )
    expect(mensagens[0].button_id).toBe('p1:artha')
    expect(mensagens[0].content).toBe('Minhas finanças')
  })

  it('botão de template guarda o payload no button_id', () => {
    const { mensagens } = parseWebhook(
      envelope({
        id: 'wamid.2',
        from: '5534988861441',
        timestamp: '1755000000',
        type: 'button',
        button: { payload: 'quero_voltar', text: 'Quero voltar' },
      })
    )
    expect(mensagens[0].button_id).toBe('quero_voltar')
    expect(mensagens[0].content).toBe('Quero voltar')
  })

  it('mensagem de texto não tem button_id', () => {
    const { mensagens } = parseWebhook(
      envelope({
        id: 'wamid.3',
        from: '5534988861441',
        timestamp: '1755000000',
        type: 'text',
        text: { body: 'oi' },
      })
    )
    expect(mensagens[0].button_id).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/lib/webhookParse.test.ts`
Expected: FAIL — `button_id` não existe em `MensagemRecebida` (erro de tipo) e o
valor é `undefined`.

- [ ] **Step 3: Implementar**

Em `src/lib/webhookParse.ts`, acrescentar o campo ao tipo:

```ts
export type MensagemRecebida = {
  message_id: string
  phone: string | null
  phone_id: string | null
  contact_name: string | null
  message_type: string
  content: string | null
  created_at: string
  media_id: string | null
  media_mime_type: string | null
  reply_to_message_id: string | null
  /**
   * O id do botão tocado. `content` guarda o TÍTULO, que é o que a tela mostra;
   * o id é o que o roteiro do bot usa para rotear. Título é copy e muda sem
   * aviso — rotear por ele quebraria o bot na primeira revisão de texto.
   */
  button_id: string | null
}
```

Acrescentar a função de extração, ao lado de `conteudo()`:

```ts
/** Id do botão: mensagem interativa usa `id`, botão de template usa `payload`. */
function idDoBotao(msg: Qualquer, tipo: string): string | null {
  if (tipo === 'button') return str(obj(msg.button)?.payload)
  if (tipo === 'interactive') {
    const i = obj(msg.interactive)
    return str(obj(i?.button_reply)?.id) ?? str(obj(i?.list_reply)?.id)
  }
  return null
}
```

E no `mensagens.push({ ... })`, acrescentar a última linha:

```ts
          reply_to_message_id: str(obj(msg.context)?.id),
          button_id: idDoBotao(msg, tipo),
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/lib/webhookParse.test.ts`
Expected: PASS, todos os casos — os antigos e os três novos.

- [ ] **Step 5: Gravar o campo no banco**

Em `src/app/api/webhook/route.ts`, dentro de `processar()`, acrescentar a linha
ao objeto passado para `inserirMensagem`:

```ts
      reply_to_message_id: m.reply_to_message_id,
      button_id: m.button_id,
    })
```

Em `src/server/repo/mensagens.ts`, acrescentar `button_id` ao tipo da linha:

```ts
type LinhaMensagem = MensagemFio & {
  status: DeliveryStatus | null
  lead_id: string | null
  enviado_por: string | null
  campanha_id: string | null
  button_id: string | null
}
```

- [ ] **Step 6: Type-check e commit**

Run: `npx tsc --noEmit && npx vitest run src/lib/webhookParse.test.ts`
Expected: sem erro; testes passando.

```bash
git add src/lib/webhookParse.ts src/lib/webhookParse.test.ts src/app/api/webhook/route.ts src/server/repo/mensagens.ts
git commit -m "Webhook guarda o id do botao, nao so o titulo"
```

---

### Task 3: O roteiro como dado

**Files:**
- Create: `src/lib/bot/roteiro.ts`
- Test: `src/lib/bot/roteiro.test.ts`

- [ ] **Step 1: Escrever o teste de invariantes**

```ts
// src/lib/bot/roteiro.test.ts
import { describe, it, expect } from 'vitest'
import {
  MAX_BOTOES,
  MAX_TITULO,
  P1,
  P2_POR_RAMO,
  perguntaP2,
  SEGMENTO_POR_P1,
  TAG_POR_RESPOSTA,
  ehIdConhecido,
} from './roteiro'

const TODAS = [P1, ...Object.values(P2_POR_RAMO)]

describe('limites da Cloud API', () => {
  it('nenhuma pergunta passa de 3 botões', () => {
    for (const p of TODAS) expect(p.botoes.length).toBeLessThanOrEqual(MAX_BOTOES)
  })

  it('nenhum título de botão passa de 20 caracteres', () => {
    for (const p of TODAS) {
      for (const b of p.botoes) expect(b.titulo.length).toBeLessThanOrEqual(MAX_TITULO)
    }
  })

  it('nenhum corpo passa de 1024 caracteres', () => {
    for (const p of TODAS) expect(p.corpo.length).toBeLessThanOrEqual(1024)
  })
})

describe('ids', () => {
  it('são únicos em todo o roteiro', () => {
    const ids = TODAS.flatMap((p) => p.botoes.map((b) => b.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('toda resposta terminal tem tag', () => {
    const terminais = [
      'p1:outro',
      ...Object.values(P2_POR_RAMO).flatMap((p) => p.botoes.map((b) => b.id)),
    ]
    for (const id of terminais) expect(TAG_POR_RESPOSTA[id]).toBeTruthy()
  })

  it('ehIdConhecido separa o que é do roteiro do que não é', () => {
    expect(ehIdConhecido('p1:artha')).toBe(true)
    expect(ehIdConhecido('p2:testou')).toBe(true)
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
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/lib/bot/roteiro.test.ts`
Expected: FAIL — `Cannot find module './roteiro'`.

- [ ] **Step 3: Escrever o roteiro**

```ts
// src/lib/bot/roteiro.ts
// O roteiro do bot de qualificação, como DADO. Sem decisão nenhuma aqui — quem
// decide é `estado.ts`. Spec 2026-08-24 §3.2.
//
// OS IDS SÃO O CONTRATO; OS TÍTULOS SÃO COPY. Trocar "Minhas finanças" por
// "Minhas contas" não pode mexer no roteamento, e é por isso que o webhook
// guarda `button_id` além do `content`.
//
// VOZ: institucional. "Aqui é da Artha", "equipe da Artha". Nenhum nome de
// persona — há três em circulação (Lúcia, Clara, LucIA) e a escolha é do
// cliente.
import type { Segmento } from '@/mock/types'

/** Autoria das mensagens do bot na coluna `messages.enviado_por`. */
export const AUTOR_BOT = 'bot'

/** Limites da Cloud API para `interactive.type = 'button'`. */
export const MAX_BOTOES = 3
export const MAX_TITULO = 20

export type Botao = { id: string; titulo: string }
export type Pergunta = { corpo: string; botoes: Botao[] }

export const P1: Pergunta = {
  corpo: 'Oi! Aqui é da Artha. Para te direcionar certo, me diz o que você procura:',
  botoes: [
    { id: 'p1:artha', titulo: 'Minhas finanças' },
    { id: 'p1:dhana', titulo: 'Sou planejador' },
    { id: 'p1:outro', titulo: 'Outro assunto' },
  ],
}

/** A p2 ramifica pela resposta da p1. `p1:outro` não tem p2: encerra ali. */
export const P2_POR_RAMO: Record<string, Pergunta> = {
  'p1:artha': {
    corpo: 'Você já usou a Artha?',
    botoes: [
      { id: 'p2:assinante', titulo: 'Já sou assinante' },
      { id: 'p2:testou', titulo: 'Já testei' },
      { id: 'p2:nunca', titulo: 'Nunca usei' },
    ],
  },
  'p1:dhana': {
    corpo: 'Quantos clientes você atende hoje?',
    botoes: [
      { id: 'p2:ate20', titulo: 'Até 20' },
      { id: 'p2:20a100', titulo: '20 a 100' },
      { id: 'p2:100mais', titulo: 'Mais de 100' },
    ],
  },
}

export const FECHO =
  'Perfeito, obrigado! Já passei para a equipe da Artha — em instantes alguém te responde por aqui.'

export const REPETICAO = 'Te respondo já! Só me diz primeiro:'

/** Só artha e dhana decidem segmento. `p1:outro` não qualifica ninguém. */
export const SEGMENTO_POR_P1: Record<string, Segmento> = {
  'p1:artha': 'artha',
  'p1:dhana': 'dhana',
}

/** Toda resposta terminal vira uma tag no lead. */
export const TAG_POR_RESPOSTA: Record<string, string> = {
  'p1:outro': 'outro-assunto',
  'p2:assinante': 'assinante',
  'p2:testou': 'ja-testou',
  'p2:nunca': 'nunca-usou',
  'p2:ate20': 'carteira-ate-20',
  'p2:20a100': 'carteira-20-100',
  'p2:100mais': 'carteira-100-mais',
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
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/lib/bot/roteiro.test.ts`
Expected: PASS, 8 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot/roteiro.ts src/lib/bot/roteiro.test.ts
git commit -m "Roteiro do bot como dado, com os limites da Cloud API testados"
```

---

### Task 4: A decisão — `proximoPasso`

**Files:**
- Create: `src/lib/bot/estado.ts`
- Test: `src/lib/bot/estado.test.ts`

Esta é a task central. Tudo que o bot decide está aqui, e nada aqui toca banco,
rede ou relógio.

- [ ] **Step 1: Escrever os testes**

```ts
// src/lib/bot/estado.test.ts
import { describe, it, expect } from 'vitest'
import { proximoPasso, type MensagemBot } from './estado'
import { AUTOR_BOT, P1, P2_POR_RAMO } from './roteiro'

// Relógio fixo: as mensagens só precisam de ordem, não de tempo real.
let t = 0
function ts(): string {
  t += 60_000
  return new Date(1_755_000_000_000 + t).toISOString()
}

function entrada(extra: Partial<MensagemBot> = {}): MensagemBot {
  return {
    direction: 'inbound',
    created_at: ts(),
    message_type: 'text',
    content: 'oi',
    button_id: null,
    enviado_por: null,
    ...extra,
  }
}

function botao(id: string): MensagemBot {
  return entrada({ message_type: 'interactive', content: 'x', button_id: id })
}

function doBot(): MensagemBot {
  return {
    direction: 'outbound',
    created_at: ts(),
    message_type: 'interactive',
    content: 'x',
    button_id: null,
    enviado_por: AUTOR_BOT,
  }
}

function doHumano(): MensagemBot {
  return { ...doBot(), enviado_por: 'operacao@artha.ia.br' }
}

describe('proximoPasso', () => {
  it('1. conversa vazia devolve calar', () => {
    expect(proximoPasso([]).acao).toBe('calar')
  })

  it('2. primeiro inbound de todos pergunta a p1', () => {
    const passo = proximoPasso([entrada()])
    expect(passo).toEqual({ acao: 'perguntar', pergunta: P1 })
  })

  it('3. quem já tinha escrito antes não vê o bot', () => {
    const passo = proximoPasso([entrada(), entrada()])
    expect(passo.acao).toBe('calar')
  })

  it('4. resposta p1:artha leva à p2 do ramo Artha', () => {
    const passo = proximoPasso([entrada(), doBot(), botao('p1:artha')])
    expect(passo).toEqual({ acao: 'perguntar', pergunta: P2_POR_RAMO['p1:artha'] })
  })

  it('5. resposta p1:dhana leva à p2 do ramo Dhana', () => {
    const passo = proximoPasso([entrada(), doBot(), botao('p1:dhana')])
    expect(passo).toEqual({ acao: 'perguntar', pergunta: P2_POR_RAMO['p1:dhana'] })
  })

  it('6. p1:outro encerra com fecho, sem p2', () => {
    const passo = proximoPasso([entrada(), doBot(), botao('p1:outro')])
    expect(passo).toEqual({
      acao: 'encerrar',
      idP1: 'p1:outro',
      idP2: null,
      comFecho: true,
    })
  })

  it('7. resposta da p2 encerra com fecho e carrega os dois ids', () => {
    const passo = proximoPasso([
      entrada(),
      doBot(),
      botao('p1:artha'),
      doBot(),
      botao('p2:testou'),
    ])
    expect(passo).toEqual({
      acao: 'encerrar',
      idP1: 'p1:artha',
      idP2: 'p2:testou',
      comFecho: true,
    })
  })

  it('8. texto livre na primeira vez repete a pergunta pendente', () => {
    const passo = proximoPasso([entrada(), doBot(), entrada({ content: 'quanto custa?' })])
    expect(passo).toEqual({ acao: 'repetir', pergunta: P1 })
  })

  it('9. texto livre na segunda vez entrega ao humano, em silêncio', () => {
    const passo = proximoPasso([
      entrada(),
      doBot(),
      entrada({ content: 'quanto custa?' }),
      doBot(),
      entrada({ content: 'me responde' }),
    ])
    expect(passo).toEqual({ acao: 'encerrar', idP1: null, idP2: null, comFecho: false })
  })

  it('10. texto livre depois da p1 repete a p2, não a p1', () => {
    const passo = proximoPasso([
      entrada(),
      doBot(),
      botao('p1:artha'),
      doBot(),
      entrada({ content: 'depende' }),
    ])
    expect(passo).toEqual({ acao: 'repetir', pergunta: P2_POR_RAMO['p1:artha'] })
  })

  it('11. botão válido depois de uma repetição segue o roteiro', () => {
    const passo = proximoPasso([
      entrada(),
      doBot(),
      entrada({ content: 'quanto custa?' }),
      doBot(),
      botao('p1:artha'),
    ])
    expect(passo).toEqual({ acao: 'perguntar', pergunta: P2_POR_RAMO['p1:artha'] })
  })

  it('12. operador que fala uma vez desliga o bot para sempre', () => {
    const passo = proximoPasso([entrada(), doBot(), doHumano(), botao('p1:artha')])
    expect(passo.acao).toBe('calar')
  })

  it('13. id de botão fora do roteiro entrega ao humano, em silêncio', () => {
    const passo = proximoPasso([entrada(), doBot(), botao('quero_voltar')])
    expect(passo).toEqual({ acao: 'encerrar', idP1: null, idP2: null, comFecho: false })
  })

  it('14. roteiro completo não fala de novo', () => {
    const passo = proximoPasso([
      entrada(),
      doBot(),
      botao('p1:artha'),
      doBot(),
      botao('p2:testou'),
      doBot(),
    ])
    expect(passo.acao).toBe('calar')
  })

  it('15. última mensagem sendo do bot é reentrega da Meta: cala', () => {
    expect(proximoPasso([entrada(), doBot()]).acao).toBe('calar')
  })

  it('16. ordem do histórico não importa: ordena por created_at', () => {
    const a = entrada()
    const b = doBot()
    const c = botao('p1:artha')
    expect(proximoPasso([c, a, b])).toEqual({
      acao: 'perguntar',
      pergunta: P2_POR_RAMO['p1:artha'],
    })
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/lib/bot/estado.test.ts`
Expected: FAIL — `Cannot find module './estado'`.

- [ ] **Step 3: Implementar**

```ts
// src/lib/bot/estado.ts
// A ÚNICA decisão do bot, como função pura do histórico da conversa.
// Spec 2026-08-24 §3.5.
//
// Não há tabela de sessão. O passo do roteiro é derivado das mensagens, pelo
// mesmo princípio que `janela24h`, `timeline` e `getMetrics` já seguem. Isso dá
// de graça a idempotência que o webhook exige: a Meta reentrega quando a
// resposta demora, e reprocessar o mesmo histórico devolve a mesma decisão.
//
// Sem relógio: nada aqui depende de tempo. A janela de 24h é do executor.
import {
  AUTOR_BOT,
  P1,
  ehIdConhecido,
  ehIdP1,
  ehIdP2,
  perguntaP2,
  type Pergunta,
} from './roteiro'

/**
 * A forma mínima de mensagem que a decisão precisa — o mesmo padrão de
 * `MensagemJanela` em `janela24h.ts`. Declarar o mínimo mantém o módulo puro e
 * o teste construível à mão.
 */
export type MensagemBot = {
  direction: 'inbound' | 'outbound'
  created_at: string
  message_type: string
  content: string | null
  button_id: string | null
  enviado_por: string | null
}

export type Passo =
  | { acao: 'perguntar'; pergunta: Pergunta }
  | { acao: 'repetir'; pergunta: Pergunta }
  | { acao: 'encerrar'; idP1: string | null; idP2: string | null; comFecho: boolean }
  | { acao: 'calar' }

const CALAR: Passo = { acao: 'calar' }

/** Quantas vezes o bot pode insistir antes de entregar ao humano. */
const TETO_DE_INSISTENCIA = 1

function ehDoBot(m: MensagemBot): boolean {
  return m.direction === 'outbound' && m.enviado_por === AUTOR_BOT
}

function ehDeHumano(m: MensagemBot): boolean {
  return m.direction === 'outbound' && m.enviado_por !== AUTOR_BOT
}

export function proximoPasso(mensagens: MensagemBot[]): Passo {
  const ms = [...mensagens].sort((a, b) => a.created_at.localeCompare(b.created_at))
  if (ms.length === 0) return CALAR

  // Um operador que falou uma vez desliga o bot naquela conversa para sempre.
  // Vem antes de tudo: é a regra que o cliente comprou quando desligou o robô
  // dele por ele responder onde não devia.
  if (ms.some(ehDeHumano)) return CALAR

  // O bot só reage à última mensagem, e só se ela for do lead. Se a última é
  // dele mesmo, não há nada a responder — é reentrega da Meta.
  const ultima = ms[ms.length - 1]
  if (ultima.direction !== 'inbound') return CALAR

  // O bot ainda não falou: é aqui que o gatilho de primeiro contato mora. Mais
  // de um inbound significa que essa pessoa já escreveu antes, e quem já
  // escreveu não vê o bot. Depois que o bot fala, o roteiro continua — a
  // resposta ao botão também chega como inbound.
  if (!ms.some(ehDoBot)) {
    const entradas = ms.filter((m) => m.direction === 'inbound').length
    return entradas > 1 ? CALAR : { acao: 'perguntar', pergunta: P1 }
  }

  // A última resposta VÁLIDA do lead define onde o roteiro está.
  const idP1 = ms.reduce<string | null>((acc, m) => (ehIdP1(m.button_id) ? m.button_id : acc), null)

  const id = ultima.button_id
  if (ehIdP2(id)) return { acao: 'encerrar', idP1, idP2: id, comFecho: true }
  if (id === 'p1:outro') return { acao: 'encerrar', idP1: id, idP2: null, comFecho: true }
  if (ehIdP1(id)) {
    const p2 = perguntaP2(id!)
    if (p2) return { acao: 'perguntar', pergunta: p2 }
    return { acao: 'encerrar', idP1: id, idP2: null, comFecho: true }
  }
  // Botão que o roteiro não conhece: campanha antiga ou roteiro trocado no meio.
  // `idP1` vai junto: se a p1 já tinha sido respondida, o segmento é informação
  // boa e jogá-la fora não ajuda ninguém.
  if (id !== null) return { acao: 'encerrar', idP1, idP2: null, comFecho: false }

  // Texto livre. Quantas vezes o bot já falou desde a última resposta válida?
  // Contar mensagens do bot no histórico inteiro daria a resposta errada quando
  // o lead já avançou o roteiro antes de começar a escrever.
  const ultimaValida = ms.reduce<number>(
    (acc, m, i) => (m.direction === 'inbound' && ehIdConhecido(m.button_id) ? i : acc),
    -1
  )
  const falasDoBot = ms.filter((m, i) => i > ultimaValida && ehDoBot(m)).length

  if (falasDoBot > TETO_DE_INSISTENCIA) {
    return { acao: 'encerrar', idP1, idP2: null, comFecho: false }
  }

  const pendente = idP1 ? (perguntaP2(idP1) ?? P1) : P1
  return { acao: 'repetir', pergunta: pendente }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/lib/bot/estado.test.ts`
Expected: PASS, 16 testes.

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm test -- --run`
Expected: tudo passando; nenhuma regressão nos testes que já existiam.

- [ ] **Step 6: Commit**

```bash
git add src/lib/bot/estado.ts src/lib/bot/estado.test.ts
git commit -m "proximoPasso: a decisao do bot derivada do historico"
```

---

### Task 5: Envio interativo na Cloud API

**Files:**
- Modify: `src/server/meta/client.ts`

Sem teste automatizado: a função é uma chamada HTTP, e o projeto não tem mock da
Graph. A validação de limites é o que a torna segura, e ela é coberta pelo teste
de invariantes do roteiro (Task 3).

- [ ] **Step 1: Implementar**

Acrescentar depois de `enviarTexto`, em `src/server/meta/client.ts`:

```ts
/**
 * Mensagem com botões de resposta. Só vale DENTRO da janela de 24h — quem checa
 * é o chamador, como em `enviarTexto`.
 *
 * Os limites são validados aqui e estouram antes da chamada: descobrir "3 botões
 * no máximo" por `MetaError` em produção custa uma conversa perdida, e o erro da
 * Graph para isto não diz qual botão é o problema.
 */
export async function enviarBotoes(
  para: string,
  corpo: string,
  botoes: { id: string; titulo: string }[]
): Promise<RespostaEnvio> {
  if (botoes.length === 0 || botoes.length > 3) {
    throw new Error(`enviarBotoes: a Cloud API aceita de 1 a 3 botões, recebi ${botoes.length}`)
  }
  for (const b of botoes) {
    if (b.titulo.length > 20) {
      throw new Error(`enviarBotoes: título "${b.titulo}" passa de 20 caracteres`)
    }
  }

  return (await chamar(`${env.phoneNumberId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: para,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: corpo },
        action: {
          buttons: botoes.map((b) => ({
            type: 'reply',
            reply: { id: b.id, title: b.titulo },
          })),
        },
      },
    }),
  })) as RespostaEnvio
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erro.

- [ ] **Step 3: Commit**

```bash
git add src/server/meta/client.ts
git commit -m "enviarBotoes: mensagem interativa com botoes de resposta"
```

---

### Task 6: O que o repositório precisa oferecer

**Files:**
- Modify: `src/server/repo/mensagens.ts`
- Modify: `src/server/repo/leads.ts`
- Modify: `src/server/env.ts`

- [ ] **Step 1: Histórico na forma que o bot consome**

Em `src/server/repo/mensagens.ts`, acrescentar depois de `mensagensDoCard`:

```ts
/**
 * Histórico de uma conversa na forma mínima que `proximoPasso` consome.
 *
 * Não reusa `mensagensDoCard`: aquela devolve `MensagemUI`, que não declara
 * `enviado_por` nem `button_id` — justamente os dois campos de que a decisão do
 * bot depende. Selecionar as colunas certas aqui é mais honesto que confiar em
 * campos que vêm no runtime mas não no tipo.
 */
export async function historicoParaBot(
  phone: string,
  phoneId: string | null
): Promise<MensagemBot[]> {
  let q = db()
    .from('messages')
    .select('direction,created_at,message_type,content,button_id,enviado_por')
    .eq('phone', phone)
    .order('created_at', { ascending: true })
  q = phoneId ? q.eq('phone_id', phoneId) : q.is('phone_id', null)

  const { data, error } = await q
  if (error) throw new Error(`historicoParaBot: ${error.message}`)
  return (data ?? []) as MensagemBot[]
}
```

E o import no topo do arquivo:

```ts
import type { MensagemBot } from '@/lib/bot/estado'
```

- [ ] **Step 2: O bot não atribui a conversa**

Ainda em `src/server/repo/mensagens.ts`, na montagem dos cards (procure por
`card.atribuidoA = linha.enviado_por`), trocar a condição:

```ts
    } else if (card.atribuidoA === null && linha.enviado_por && linha.enviado_por !== AUTOR_BOT) {
      // Não existe coluna de atribuição no schema. O sinal honesto disponível é
      // `enviado_por`: quem respondeu à mão por último é quem está atendendo.
      //
      // O bot é a exceção: ele não atende ninguém. Se contasse aqui, toda
      // conversa que ele tocasse apareceria com operador atribuído e sairia da
      // fila de quem deveria assumi-la.
      card.atribuidoA = linha.enviado_por
    }
```

E o import:

```ts
import { AUTOR_BOT } from '@/lib/bot/roteiro'
```

- [ ] **Step 3: Aplicar a qualificação no lead**

Em `src/server/repo/leads.ts`, acrescentar ao fim:

```ts
/**
 * Grava o resultado do roteiro do bot. Spec 2026-08-24 §3.4.
 *
 * `segmento` só vem quando a p1 decidiu um (artha ou dhana). Em `p1:outro`
 * ninguém foi qualificado: entra a tag e nada mais, e a etapa fica como estava.
 *
 * As tags são unidas, não substituídas — o lead pode ter vindo de importação
 * com tags próprias, e o bot não é dono da coluna.
 */
export async function qualificarLead(
  id: string,
  dados: { segmento?: Lead['segmento']; tag?: string }
): Promise<void> {
  const atual = await buscarLead(id)
  if (!atual) return

  const patch: Record<string, unknown> = { ultima_interacao_em: new Date().toISOString() }
  if (dados.segmento) {
    patch.segmento = dados.segmento
    patch.stage = 'qualificado'
  }
  if (dados.tag && !atual.tags.includes(dados.tag)) {
    patch.tags = [...atual.tags, dados.tag]
  }

  const { error } = await db().from('leads').update(patch).eq('id', id)
  if (error) throw new Error(`qualificarLead: ${error.message}`)
}
```

- [ ] **Step 4: A chave de desligamento**

Em `src/server/env.ts`, acrescentar ao objeto `env`:

```ts
  get botQualificacao() {
    // Padrão DESLIGADO de propósito: um deploy sem a variável configurada não
    // pode começar a mandar mensagem automática para a base do cliente.
    return (process.env.BOT_QUALIFICACAO ?? 'off') === 'on'
  },
```

- [ ] **Step 5: Type-check e testes**

Run: `npx tsc --noEmit && npm test -- --run`
Expected: sem erro; todos os testes passando.

- [ ] **Step 6: Commit**

```bash
git add src/server/repo/mensagens.ts src/server/repo/leads.ts src/server/env.ts
git commit -m "Repo e env do bot: historico, qualificacao e chave de desligamento"
```

---

### Task 7: O executor e a ligação com o webhook

**Files:**
- Create: `src/server/bot/executar.ts`
- Modify: `src/app/api/webhook/route.ts`

- [ ] **Step 1: Escrever o executor**

```ts
// src/server/bot/executar.ts
// O efeito colateral do bot. Toda decisão está em `src/lib/bot/estado.ts`; aqui
// só existe ordem de operações. Spec 2026-08-24 §3.6 e §4.2.
import 'server-only'
import { proximoPasso } from '@/lib/bot/estado'
import { AUTOR_BOT, FECHO, REPETICAO, SEGMENTO_POR_P1, TAG_POR_RESPOSTA } from '@/lib/bot/roteiro'
import { getWindowStatus } from '@/lib/janela24h'
import { env } from '../env'
import { enviarBotoes, enviarTexto } from '../meta/client'
import { qualificarLead } from '../repo/leads'
import { historicoParaBot, inserirMensagem } from '../repo/mensagens'
import { db } from '../supabase'

type Gatilho = {
  messageId: string
  phone: string | null
  phoneId: string | null
  leadId: string | null
}

/**
 * Trava de concorrência. A derivação do estado resolve reentrega em série; duas
 * entregas SIMULTÂNEAS leem o mesmo histórico antes de qualquer uma escrever, e
 * as duas mandariam o botão. Conflito de chave primária significa que outra
 * entrega já cuidou desta mensagem.
 */
async function tomarATrava(inboundMessageId: string): Promise<boolean> {
  const { error } = await db().from('bot_acoes').insert({ inbound_message_id: inboundMessageId })
  if (!error) return true
  if (error.code === '23505') return false
  throw new Error(`tomarATrava: ${error.message}`)
}

export async function executarBot(gatilho: Gatilho): Promise<void> {
  if (!env.botQualificacao) return
  if (!gatilho.phone) return

  const historico = await historicoParaBot(gatilho.phone, gatilho.phoneId)
  const passo = proximoPasso(historico)
  if (passo.acao === 'calar') return

  // A janela deveria estar sempre aberta — o gatilho é uma mensagem de entrada.
  // A checagem custa uma comparação e evita descobrir em produção que existe um
  // caminho onde a premissa não valia.
  if (!getWindowStatus(historico, new Date()).isOpen) return

  if (!(await tomarATrava(gatilho.messageId))) return

  if (passo.acao === 'perguntar' || passo.acao === 'repetir') {
    const corpo =
      passo.acao === 'repetir' ? `${REPETICAO}\n\n${passo.pergunta.corpo}` : passo.pergunta.corpo
    const resposta = await enviarBotoes(gatilho.phone, corpo, passo.pergunta.botoes)
    await gravarSaida(gatilho, resposta.messages[0]?.id ?? null, corpo, 'interactive')
    return
  }

  // encerrar
  if (passo.comFecho) {
    const resposta = await enviarTexto(gatilho.phone, FECHO)
    await gravarSaida(gatilho, resposta.messages[0]?.id ?? null, FECHO, 'text')
  }

  if (gatilho.leadId) {
    const segmento = passo.idP1 ? SEGMENTO_POR_P1[passo.idP1] : undefined
    const tag = passo.idP2
      ? TAG_POR_RESPOSTA[passo.idP2]
      : passo.idP1
        ? TAG_POR_RESPOSTA[passo.idP1]
        : undefined
    if (segmento || tag) await qualificarLead(gatilho.leadId, { segmento, tag })
  }
}

async function gravarSaida(
  gatilho: Gatilho,
  messageId: string | null,
  conteudo: string,
  tipo: string
): Promise<void> {
  await inserirMensagem({
    message_id: messageId,
    lead_id: gatilho.leadId,
    phone: gatilho.phone,
    phone_id: gatilho.phoneId,
    content: conteudo,
    message_type: tipo,
    direction: 'outbound',
    created_at: new Date().toISOString(),
    enviado_por: AUTOR_BOT,
  })
}
```

- [ ] **Step 2: Ligar no webhook**

Em `src/app/api/webhook/route.ts`, no import:

```ts
import { executarBot } from '@/server/bot/executar'
```

E dentro de `processar()`, ao fim do corpo do `for (const m of mensagens)`, logo
depois do bloco `if (lead) { ... }`:

```ts
    // Bot de qualificação. Isolado no seu próprio try/catch: uma falha aqui não
    // pode impedir a marcação do evento como processado nem derrubar o
    // tratamento das outras mensagens do mesmo payload.
    try {
      await executarBot({
        messageId: m.message_id,
        phone: m.phone,
        phoneId: m.phone_id,
        leadId: lead?.id ?? null,
      })
    } catch (e) {
      console.error('[bot] falha ao executar', m.message_id, e)
    }
```

- [ ] **Step 3: Type-check, lint, testes e build**

Run: `npx tsc --noEmit && npm run lint && npm test -- --run && npm run build`
Expected: os quatro limpos.

- [ ] **Step 4: Documentar a variável de ambiente**

Acrescentar ao fim de `.env.local.example`:

```
# Bot de qualificação por botões. 'on' liga; qualquer outro valor desliga.
# Padrão desligado: deploy sem esta variável não manda mensagem automática.
BOT_QUALIFICACAO=off
```

- [ ] **Step 5: Commit**

```bash
git add src/server/bot/executar.ts src/app/api/webhook/route.ts
git commit -m "Executor do bot ligado no webhook, isolado em try/catch"
```

---

## Onda B — o painel

Arquivos disjuntos da Onda A. Pode rodar em paralelo.

### Task 8: Dashboard

**Files:**
- Modify: `src/components/Dashboard.tsx`

- [ ] **Step 1: Trocar os tiles**

Substituir os quatro `<Tile>` (procure por `rotulo="Leads na base"`) por:

```tsx
          <Tile
            rotulo="Leads na base"
            valor={NUM.format(metrics.totalLeads)}
            nota="Cadastro completo da operação"
            atraso={0}
          />
          <Tile
            rotulo="Fila de atendimento"
            valor={NUM.format(metrics.conversas.filaAtendimento)}
            nota="Conversas aguardando resposta"
            atraso={60}
          />
          <Tile
            rotulo="Conversas"
            valor={NUM.format(metrics.conversas.total)}
            nota={`${NUM.format(metrics.conversas.janelaAberta)} com janela de 24h aberta`}
            atraso={120}
          />
          <Tile
            rotulo="Qualificados"
            valor={NUM.format(metrics.porEtapa.qualificado)}
            nota="Produto e momento identificados"
            atraso={180}
          />
```

Sai "Assinantes ativos" e sai "Receita recorrente": as duas medem uma base de
assinantes que não existe.

- [ ] **Step 2: Trocar a banda invertida**

Substituir o conteúdo do `<CardContent className="px-8">` por:

```tsx
            <div className="min-w-0">
              <p className="t-caption text-on-ink opacity-70">Leads qualificados</p>
              <p className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="t-display-xxl tabular text-accent-on-ink">
                  {NUM.format(metrics.porEtapa.qualificado)}
                </span>
                <span className="t-display-md text-on-ink">
                  leads com produto e momento identificados
                </span>
              </p>
              <p className="mt-3 max-w-prose t-body-md text-on-ink opacity-75">
                {NUM.format(metrics.porSegmento.artha)} para a Artha e{' '}
                {NUM.format(metrics.porSegmento.dhana)} para a Dhana — separados na entrada,
                antes de o operador abrir a conversa.
              </p>
            </div>
```

O papel do acento não muda: continua sendo o número-herói (papel 3 da lista
fechada), continua em `--accent-on-ink` por causa da polaridade invertida da
banda, e continua sem carregar estado semântico.

- [ ] **Step 3: Atualizar o comentário do topo do arquivo**

Procure o bloco que fala dos "612 inativos" (por volta da linha 24) e substitua
por:

```tsx
// Todo número desta tela sai de `useMetrics()`, que deriva do mesmo dataset que
// as outras telas leem. Nenhum número é digitado aqui.
```

- [ ] **Step 4: Conferir que não sobrou copy de reativação**

Run: `grep -n "reativa\|inativ\|Receita recorrente\|recuper" src/components/Dashboard.tsx`
Expected: nenhuma saída.

- [ ] **Step 5: Lint, type-check e build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: os três limpos.

- [ ] **Step 6: Commit**

```bash
git add src/components/Dashboard.tsx
git commit -m "Dashboard mede qualificacao, nao reativacao"
```

---

### Task 9: Relatórios

**Files:**
- Modify: `src/components/Reports.tsx`

A tela hoje mede campanha: enviados, entregues, respondidos, convertidos. Com
Disparos fora do menu, ela mede o vazio. Passa a medir leads e atendimento.

**Os componentes de desenho não mudam:** `barra()`, `Funil`, `BarraTaxa` e
`Tile` ficam como estão. O que muda é a fonte dos números.

- [ ] **Step 1: Trocar os imports e o cabeçalho**

Remover o import de `useCampanhas` e o de `Tag`, e trocar o bloco de constantes
do topo (`ALVO`) — ele só servia para campanha. O import de `ROTULO_SEGMENTO`
continua, agora para a tabela de segmentos.

```tsx
import { useMetrics } from '@/hooks/useMetrics'
import { ROTULO_SEGMENTO } from '@/lib/segmentos'
import type { Segmento } from '@/mock/types'
```

Trocar o comentário do topo do arquivo:

```tsx
// Relatórios — atendimento e qualificação.
//
// REGRA DURA DESTE ARQUIVO: nenhum número é digitado. Tudo sai de `useMetrics()`,
// a mesma agregação derivada que alimenta o Dashboard — assim as duas telas não
// têm como divergir uma da outra.
//
// GRÁFICO: SVG inline, no máximo 3 séries, série primária em `--accent`, rótulo
// direto na série. O funil desta tela tem UMA série, e a trilha atrás dela é
// cromo recessivo — não é uma segunda série, é o papel de uma linha de grade.
```

E o `<header>`:

```tsx
      <header className="reveal-rise">
        <h1 className="t-display-xl text-ink">Relatórios</h1>
        <p className="mt-3 max-w-prose t-body-md text-body">
          Como os leads entram, onde eles param e quanto a operação conversa.
        </p>
      </header>
```

- [ ] **Step 2: Trocar o corpo do componente**

Substituir tudo de `export default function Reports() {` até o fim do arquivo:

```tsx
export default function Reports() {
  const { metrics } = useMetrics()

  const semLeads = metrics.totalLeads === 0

  const etapas: Etapa[] = [
    { rotulo: 'Novos', valor: metrics.porEtapa.novo, nota: 'Ainda sem contato' },
    { rotulo: 'Contatados', valor: metrics.porEtapa.contatado, nota: 'Conversa iniciada' },
    {
      rotulo: 'Qualificados',
      valor: metrics.porEtapa.qualificado,
      nota: 'Produto e momento identificados',
    },
    { rotulo: 'Convertidos', valor: metrics.porEtapa.convertido, nota: 'Assinatura fechada' },
    { rotulo: 'Perdidos', valor: metrics.porEtapa.perdido, nota: 'Sem interesse' },
  ]

  const segmentos = (Object.keys(ROTULO_SEGMENTO) as Segmento[])
    .map((s) => ({
      segmento: s,
      total: metrics.porSegmento[s],
      fatia: metrics.totalLeads > 0 ? metrics.porSegmento[s] / metrics.totalLeads : 0,
    }))
    .sort((a, b) => b.total - a.total)

  return (
    <div className="h-full overflow-y-auto px-8 py-8">
      <header className="reveal-rise">
        <h1 className="t-display-xl text-ink">Relatórios</h1>
        <p className="mt-3 max-w-prose t-body-md text-body">
          Como os leads entram, onde eles param e quanto a operação conversa.
        </p>
      </header>

      <section
        aria-label="Resumo da operação"
        className="reveal-rise mt-8 grid grid-cols-2 gap-4 xl:grid-cols-4"
        style={{ animationDelay: '60ms' }}
      >
        <Tile
          rotulo="Leads na base"
          valor={inteiro.format(metrics.totalLeads)}
          nota="Cadastro completo"
        />
        <Tile
          rotulo="Qualificados"
          valor={inteiro.format(metrics.porEtapa.qualificado)}
          nota={`${porcento.format(
            metrics.totalLeads > 0 ? metrics.porEtapa.qualificado / metrics.totalLeads : 0
          )} da base`}
        />
        <Tile
          rotulo="Conversas"
          valor={inteiro.format(metrics.conversas.total)}
          nota={`${inteiro.format(metrics.conversas.filaAtendimento)} na fila`}
        />
        <Tile
          rotulo="Mensagens"
          valor={inteiro.format(metrics.mensagens.total)}
          nota={`${inteiro.format(metrics.mensagens.recebidas)} recebidas`}
        />
      </section>

      <Card className="reveal-rise mt-6" style={{ animationDelay: '120ms' }}>
        <CardHeader>
          <CardTitle>Funil de leads</CardTitle>
          <CardDescription>
            Onde a base está parada. A trilha clara atrás de cada barra é o total de leads —
            o vazio é quem ainda não chegou naquela etapa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {semLeads ? (
            <p className="py-6 t-body-sm text-mute">
              Nenhum lead cadastrado ainda. O funil aparece assim que a primeira conversa
              chegar.
            </p>
          ) : (
            <Funil etapas={etapas} base={metrics.totalLeads} />
          )}
        </CardContent>
      </Card>

      <Card className="reveal-rise mt-6" style={{ animationDelay: '180ms' }}>
        <CardHeader>
          <CardTitle>Leads por produto</CardTitle>
          <CardDescription>
            A separação que o bot faz na entrada: quem procura a Artha, quem é planejador
            financeiro e quem chegou por outro assunto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {semLeads ? (
            <p className="py-6 t-body-sm text-mute">
              Nenhum lead cadastrado ainda.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead>Fatia da base</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {segmentos.map((linha) => (
                  <TableRow key={linha.segmento}>
                    <TableCell className="t-body-sm-strong">
                      {ROTULO_SEGMENTO[linha.segmento]}
                    </TableCell>
                    <TableCell className="text-right tabular">
                      {inteiro.format(linha.total)}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-3">
                        <BarraTaxa taxa={linha.fatia} />
                        <span className="tabular">{porcentoFixo.format(linha.fatia)}</span>
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Toda a base</TableCell>
                  <TableCell className="text-right tabular">
                    {inteiro.format(metrics.totalLeads)}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-3">
                      <BarraTaxa taxa={1} />
                      <span className="tabular">{porcentoFixo.format(1)}</span>
                    </span>
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Limpar imports e constantes que sobraram**

Três coisas ficam órfãs com a troca e precisam sair:

- `import { Tag } from '@/components/ui/chip'`
- `import { useCampanhas } from '@/hooks/useCampanhas'`
- a constante `ALVO` (o `Record<Segmento | 'todos', string>` do topo)

Ficam: `Card`/`CardContent`/`CardHeader`/`CardTitle`/`CardDescription`, toda a
família de `Table` incluindo `TableFooter`, `useMetrics`, `ROTULO_SEGMENTO`,
`Segmento`, e os três formatadores (`inteiro`, `porcento`, `porcentoFixo`).

Run: `npm run lint`
Expected: limpo.

- [ ] **Step 4: Conferir que não sobrou copy de campanha**

Run: `grep -n "campanha\|Campanha\|reativa\|disparo" src/components/Reports.tsx`
Expected: nenhuma saída.

- [ ] **Step 5: Type-check e build**

Run: `npx tsc --noEmit && npm run build`
Expected: os dois limpos.

- [ ] **Step 6: Commit**

```bash
git add src/components/Reports.tsx
git commit -m "Relatorios medem leads e atendimento, nao campanhas"
```

---

### Task 10: Tela de login

**Files:**
- Modify: `src/app/(auth)/layout.tsx`

- [ ] **Step 1: Trocar os destaques**

Substituir a constante `DESTAQUES`:

```tsx
const DESTAQUES = [
  { titulo: 'Conversas', nota: 'Janela de 24h à vista' },
  { titulo: 'Leads', nota: 'Produto e etapa de cada um' },
  { titulo: 'Relatórios', nota: 'Funil e volume de atendimento' },
] as const
```

Reativação e Disparos saíram do menu; anunciar as duas na porta de entrada é
prometer tela que não existe.

- [ ] **Step 2: Trocar o texto do painel**

Substituir o bloco do título e do parágrafo:

```tsx
          <p className="t-display-xl">Todo lead começa por uma conversa.</p>
          <p className="mt-4 t-body-lg opacity-75">
            Atendimento e qualificação por WhatsApp em um só lugar, com a API oficial da
            Meta e o histórico de cada pessoa à vista.
          </p>
```

- [ ] **Step 3: Atualizar o comentário do topo do arquivo**

O bloco de comentário fala das "três superfícies que o cliente vai ver a seguir".
Continua verdadeiro — são outras três. Não precisa mexer, exceto se citar
Reativação nominalmente; nesse caso, trocar pelos nomes novos.

Run: `grep -n "Reativa\|reativa\|inativ\|Disparo" "src/app/(auth)/layout.tsx"`
Expected: nenhuma saída.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: limpo.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(auth)/layout.tsx"
git commit -m "Login fala de atendimento, nao de base inativa"
```

---

### Task 11: Documentação e verificação final

**Files:**
- Modify: `CONTEXT.md`
- Modify: `ROADMAP.md`

- [ ] **Step 1: O verbete Etapa**

Em `CONTEXT.md`, substituir o corpo do verbete **Etapa**:

```markdown
**Etapa** (funil):
Posição do lead no funil comercial: novo → contatado → qualificado → convertido, ou perdido. Muda por ação do operador **ou pelo bot de qualificação**, que marca `qualificado` ao fim do roteiro de botões. Nenhuma outra automação a move.
_Avoid_: status (que é do plano), fase, estágio
```

- [ ] **Step 2: Registrar a entrega no ROADMAP**

Em `ROADMAP.md`, acrescentar uma seção antes de `## [NA FILA]`:

```markdown
## Em execução (2026-08-24) — bot de qualificação por botões

Automação de botões no modelo da Mar Azul demonstrado na reunião de 10/08: sem
IA, dentro do webhook, sem cron. Duas perguntas — produto (Artha ou Dhana) e
momento — disparadas no primeiro contato de cada telefone. Spec:
`docs/superpowers/specs/2026-08-24-bot-qualificacao-botoes-design.md`.

O painel deixou de falar de reativação junto: não há base inativa, e o eixo
passou para atendimento e qualificação.

Bloqueios herdados: a migration `0002_bot_qualificacao.sql` precisa ser aplicada
quando o projeto Supabase existir, e o teste ponta a ponta depende do número
WABA que a reunião deixou pendente no chip novo.
```

- [ ] **Step 3: Varredura de conformidade**

Run:
```bash
grep -rn "reativa\|Reativa\|inativ\|Inativ" --include="*.tsx" src/components/Dashboard.tsx src/components/Reports.tsx src/components/Conversations.tsx src/components/Leads.tsx src/components/AccountInfo.tsx "src/app/(auth)/layout.tsx"
```
Expected: nenhuma saída em copy visível. Comentário de código explicando a régua
de `ehInativo` pode ficar — a regra continua existindo em `src/lib/regras.ts` e
alimenta `/api/reativacao`, que a tela de Leads ainda usa.

- [ ] **Step 4: Suíte completa**

Run: `npx tsc --noEmit && npm run lint && npm test -- --run && npm run build`
Expected: os quatro limpos. `npm test` deve mostrar os 226 testes anteriores mais
os 19 novos (3 do parser, 8 do roteiro, 16 do estado, menos os que já contavam).

- [ ] **Step 5: Commit**

```bash
git add CONTEXT.md ROADMAP.md
git commit -m "CONTEXT e ROADMAP: a Etapa passa a mudar pelo bot"
```

---

## Verificação manual — quando o número WABA existir

Não faz parte deste plano. Fica registrado porque é o que fecha os critérios 15 a
20 da spec e depende do chip novo:

1. `BOT_QUALIFICACAO=on` na Vercel, com redeploy.
2. Mensagem de um telefone desconhecido → chegam os três botões da p1.
3. Tocar "Minhas finanças" → chega a p2 do ramo Artha.
4. Tocar "Já testei" → chega o fecho, e a tela de Leads mostra o lead com
   segmento `artha`, etapa `qualificado` e a tag `ja-testou`.
5. A conversa aparece na fila de atendimento **sem** operador atribuído.
6. Escrever texto em vez de tocar botão → uma repetição; texto de novo →
   silêncio.
7. `BOT_QUALIFICACAO` fora de `on` → nenhuma mensagem automática.
