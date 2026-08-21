# Artha System — backend real (B1+B2+B3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` para executar tarefa a tarefa. Os passos usam checkbox (`- [ ]`).
>
> **ATENÇÃO — sem git.** O CLAUDE.md declara que o projeto não é repositório git nesta fase. **Não rode `git init`, `git add` nem `git commit`.** Onde a disciplina pediria commit, o passo é rodar a verificação e conferir a saída.

**Goal:** trocar o store em memória por Postgres (Supabase), pôr o número +55 34 9211-4080 enviando e recebendo pela Cloud API, e construir o motor de disparo com criação interna de templates.

**Architecture:** browser → rotas do App Router (`src/app/api/*`) → repositório (`src/server/repo/*`) → Supabase Postgres com `service_role`. O browser nunca fala com o Supabase. As regras puras de `src/lib/*` não mudam — continuam sendo a régua única. A forma "de fio" de `src/lib/conversationTypes.ts` **é** o schema da tabela `messages`, o que faz a tela de Conversas acender trocando só o `queryFn`.

**Tech Stack:** Next.js 16.2 (App Router), React 19, TypeScript, `@supabase/supabase-js`, `@tanstack/react-query`, Vitest, WhatsApp Cloud API v21.0.

**Spec:** `docs/superpowers/specs/2026-08-20-artha-backend-real-design.md`

---

## Estrutura de arquivos

Criados:

| Arquivo | Responsabilidade |
| --- | --- |
| `supabase/migrations/0001_schema.sql` | schema completo, copiável no SQL Editor |
| `src/lib/telefoneCasos.ts` | casos canônicos de telefone, compartilhados JS↔SQL |
| `src/lib/statusEntrega.ts` | ordem monotônica de status de entrega |
| `src/lib/webhookParse.ts` | parse puro do payload da Meta |
| `src/lib/templates.ts` | validação de template antes de submeter |
| `src/lib/regras.ts` | regras de negócio movidas de `src/mock/metrics.ts` |
| `src/server/env.ts` | leitura validada de variáveis de ambiente |
| `src/server/supabase.ts` | client `service_role`, singleton |
| `src/server/meta/assinatura.ts` | HMAC-SHA256 do webhook |
| `src/server/meta/client.ts` | cliente da Cloud API |
| `src/server/repo/*.ts` | leads, mensagens, conversas, campanhas, agendamentos, templates |
| `src/app/api/**/route.ts` | rotas |
| `src/components/Templates.tsx` | décima aba |
| `scripts/seed.ts` | carrega `src/mock/db.ts` no banco |

Modificados: `src/hooks/*` (só `queryFn`), `src/lib/tabs.ts`, `src/app/(app)/page.tsx`, `src/components/Sidebar.tsx`, `src/mock/metrics.ts` (vira reexport), `package.json`, `.gitignore`, `TREE.md`, `ROADMAP.md`.

---

## Onda A — regras puras (nenhum bloqueio externo)

### Task 1: Casos canônicos de telefone

A spec §2.1 exige que `telNorm11()` e `tel_norm11(text)` do Postgres concordem. Para provar isso, os dois testes precisam ler a **mesma** lista de casos.

**Files:**
- Create: `src/lib/telefoneCasos.ts`
- Modify: `src/lib/telNorm11.test.ts`

- [ ] **Step 1: Criar a lista compartilhada**

```ts
// src/lib/telefoneCasos.ts
// Casos canônicos de normalização de telefone. Lidos por DOIS testes:
// `telNorm11.test.ts` (JS) e `tel_norm11.integration.test.ts` (Postgres).
// Divergência entre as duas implementações é falha de build — ver spec §2.1.

export type CasoTelefone = { entrada: string | null; esperado: string | null; porque: string }

export const CASOS_TELEFONE: CasoTelefone[] = [
  // Canário Vilssom: o wa_id da Meta vem sem o nono dígito.
  { entrada: '553791235196', esperado: '37991235196', porque: 'wa_id inbound sem 9º' },
  { entrada: '37991235196', esperado: '37991235196', porque: 'fila, 11 dígitos' },
  { entrada: '5537991235196', esperado: '37991235196', porque: 'DDI + 9º' },
  { entrada: '3791235196', esperado: '37991235196', porque: 'nacional sem 9º' },
  { entrada: '+55 (37) 99123-5196', esperado: '37991235196', porque: 'formatado' },

  // Canário 2026-08-20: enviamos 5534988861441, a Meta devolveu wa_id 553488861441.
  { entrada: '5534988861441', esperado: '34988861441', porque: 'número de teste, enviado' },
  { entrada: '553488861441', esperado: '34988861441', porque: 'wa_id devolvido pela Meta' },
  { entrada: '34988861441', esperado: '34988861441', porque: 'nacional com 9º' },

  // Fixo nunca ganha 9º dígito fabricado: criaria um celular inexistente.
  { entrada: '553432451234', esperado: null, porque: 'fixo com DDI' },
  { entrada: '3432451234', esperado: null, porque: 'fixo nacional' },

  // Não reconhecível.
  { entrada: '', esperado: null, porque: 'vazio' },
  { entrada: null, esperado: null, porque: 'nulo' },
  { entrada: '123', esperado: null, porque: 'curto demais' },
  { entrada: '12345678901234', esperado: null, porque: 'longo demais' },
]
```

- [ ] **Step 2: Reescrever o teste JS para consumir a lista**

Substituir todo o conteúdo de `src/lib/telNorm11.test.ts` por:

```ts
import { describe, expect, it } from 'vitest'
import { telNorm11 } from './phoneUtils'
import { CASOS_TELEFONE } from './telefoneCasos'

describe('telNorm11 — deve espelhar tel_norm11(text) do Postgres', () => {
  for (const caso of CASOS_TELEFONE) {
    it(`${JSON.stringify(caso.entrada)} → ${JSON.stringify(caso.esperado)} (${caso.porque})`, () => {
      expect(telNorm11(caso.entrada)).toBe(caso.esperado)
    })
  }
})
```

- [ ] **Step 3: Rodar e conferir**

Rodar: `npm test -- src/lib/telNorm11.test.ts`
Esperado: **14 testes passam.** Se `5534988861441 → 34988861441` falhar, `telNorm11` está errada e é ela que muda, não o caso.

---

### Task 2: Status de entrega monotônico

Critério de aceitação 5 da spec: `sent` chegando depois de `read` não rebaixa a bolha. A Meta entrega callbacks fora de ordem.

**Files:**
- Create: `src/lib/statusEntrega.ts`
- Test: `src/lib/statusEntrega.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/lib/statusEntrega.test.ts
import { describe, expect, it } from 'vitest'
import { avancarStatus, statusDaMeta } from './statusEntrega'

describe('avancarStatus — status só avança, nunca retrocede', () => {
  it('avança na ordem normal', () => {
    expect(avancarStatus(null, 'enviado')).toBe('enviado')
    expect(avancarStatus('enviado', 'entregue')).toBe('entregue')
    expect(avancarStatus('entregue', 'lido')).toBe('lido')
  })

  it('ignora callback atrasado que rebaixaria', () => {
    expect(avancarStatus('lido', 'enviado')).toBe('lido')
    expect(avancarStatus('lido', 'entregue')).toBe('lido')
    expect(avancarStatus('entregue', 'enviado')).toBe('entregue')
  })

  it('falha vence qualquer estado e é terminal', () => {
    expect(avancarStatus('enviado', 'falhou')).toBe('falhou')
    expect(avancarStatus('lido', 'falhou')).toBe('falhou')
    expect(avancarStatus('falhou', 'lido')).toBe('falhou')
    expect(avancarStatus('falhou', 'entregue')).toBe('falhou')
  })
})

describe('statusDaMeta — traduz o vocabulário do webhook', () => {
  it('mapeia os quatro estados', () => {
    expect(statusDaMeta('sent')).toBe('enviado')
    expect(statusDaMeta('delivered')).toBe('entregue')
    expect(statusDaMeta('read')).toBe('lido')
    expect(statusDaMeta('failed')).toBe('falhou')
  })

  it('devolve null para o que não conhece', () => {
    expect(statusDaMeta('deleted')).toBeNull()
    expect(statusDaMeta('')).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Rodar: `npm test -- src/lib/statusEntrega.test.ts`
Esperado: FALHA — `Failed to resolve import "./statusEntrega"`.

- [ ] **Step 3: Implementar**

```ts
// src/lib/statusEntrega.ts
// A Meta entrega callbacks de status FORA DE ORDEM: um `sent` atrasado pode
// chegar depois de um `read`. Sem esta régua, a bolha rebaixa na tela e o
// operador acha que a mensagem não foi lida. Ver spec §6.2.
import type { DeliveryStatus } from '@/mock/types'

/** Posição no caminho. `falhou` é terminal e vence tudo. */
const RANK: Record<DeliveryStatus, number> = {
  enviado: 1,
  entregue: 2,
  lido: 3,
  falhou: 4,
}

/** Devolve o status que deve ficar gravado. Nunca retrocede. */
export function avancarStatus(
  atual: DeliveryStatus | null,
  novo: DeliveryStatus
): DeliveryStatus {
  if (atual === null) return novo
  return RANK[novo] > RANK[atual] ? novo : atual
}

const DA_META: Record<string, DeliveryStatus> = {
  sent: 'enviado',
  delivered: 'entregue',
  read: 'lido',
  failed: 'falhou',
}

/** Traduz o `status` do webhook. Desconhecido → null (ignorar, não adivinhar). */
export function statusDaMeta(bruto: string): DeliveryStatus | null {
  return DA_META[bruto] ?? null
}
```

- [ ] **Step 4: Rodar e conferir**

Rodar: `npm test -- src/lib/statusEntrega.test.ts`
Esperado: **5 testes passam** (16 asserções).

---

### Task 3: Parse puro do payload do webhook

Isolar o parse da Meta numa função pura torna o webhook testável sem banco nem rede.

**Files:**
- Create: `src/lib/webhookParse.ts`
- Test: `src/lib/webhookParse.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/lib/webhookParse.test.ts
import { describe, expect, it } from 'vitest'
import { parseWebhook } from './webhookParse'

const ENTRADA_TEXTO = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '1440374588143232',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '553492114080', phone_number_id: '1305873789266362' },
            contacts: [{ profile: { name: 'Rafael Recidive' }, wa_id: '553488861441' }],
            messages: [
              {
                from: '553488861441',
                id: 'wamid.ABC',
                timestamp: '1787200000',
                type: 'text',
                text: { body: 'Quero saber mais' },
              },
            ],
          },
        },
      ],
    },
  ],
}

const ENTRADA_STATUS = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '1440374588143232',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '553492114080', phone_number_id: '1305873789266362' },
            statuses: [
              { id: 'wamid.ABC', status: 'read', timestamp: '1787200100', recipient_id: '553488861441' },
            ],
          },
        },
      ],
    },
  ],
}

describe('parseWebhook — mensagens de entrada', () => {
  it('extrai a mensagem de texto com telefone normalizado', () => {
    const r = parseWebhook(ENTRADA_TEXTO)
    expect(r.mensagens).toHaveLength(1)
    const m = r.mensagens[0]
    expect(m.message_id).toBe('wamid.ABC')
    // O `from` vem com 12 dígitos; gravamos os 11 canônicos. Ver spec §2.1.
    expect(m.phone).toBe('34988861441')
    expect(m.phone_id).toBe('1305873789266362')
    expect(m.contact_name).toBe('Rafael Recidive')
    expect(m.message_type).toBe('text')
    expect(m.content).toBe('Quero saber mais')
    expect(m.created_at).toBe(new Date(1787200000 * 1000).toISOString())
    expect(m.media_id).toBeNull()
  })

  it('não devolve status quando o payload é de mensagem', () => {
    expect(parseWebhook(ENTRADA_TEXTO).statuses).toHaveLength(0)
  })
})

describe('parseWebhook — callbacks de status', () => {
  it('extrai o status casado por wamid', () => {
    const r = parseWebhook(ENTRADA_STATUS)
    expect(r.mensagens).toHaveLength(0)
    expect(r.statuses).toEqual([{ message_id: 'wamid.ABC', status: 'lido' }])
  })
})

describe('parseWebhook — botão, mídia e ruído', () => {
  it('lê o texto do botão como conteúdo', () => {
    const payload = structuredClone(ENTRADA_TEXTO)
    payload.entry[0].changes[0].value.messages[0] = {
      from: '553488861441',
      id: 'wamid.BTN',
      timestamp: '1787200000',
      type: 'button',
      button: { text: 'Quero voltar', payload: 'REATIVAR' },
    } as never
    const m = parseWebhook(payload).mensagens[0]
    expect(m.message_type).toBe('button')
    expect(m.content).toBe('Quero voltar')
  })

  it('registra media_id e mime na imagem, sem baixar nada', () => {
    const payload = structuredClone(ENTRADA_TEXTO)
    payload.entry[0].changes[0].value.messages[0] = {
      from: '553488861441',
      id: 'wamid.IMG',
      timestamp: '1787200000',
      type: 'image',
      image: { id: '999', mime_type: 'image/jpeg', caption: 'meu extrato' },
    } as never
    const m = parseWebhook(payload).mensagens[0]
    expect(m.media_id).toBe('999')
    expect(m.media_mime_type).toBe('image/jpeg')
    expect(m.content).toBe('meu extrato')
  })

  it('devolve vazio para payload sem entry, sem estourar', () => {
    expect(parseWebhook({})).toEqual({ mensagens: [], statuses: [] })
    expect(parseWebhook(null)).toEqual({ mensagens: [], statuses: [] })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Rodar: `npm test -- src/lib/webhookParse.test.ts`
Esperado: FALHA — módulo não existe.

- [ ] **Step 3: Implementar**

```ts
// src/lib/webhookParse.ts
// Parse PURO do payload do webhook da Meta. Sem banco, sem rede — para que o
// contrato do webhook seja testável sem infraestrutura. Ver spec §6.2.
import type { DeliveryStatus } from '@/mock/types'
import { telNorm11 } from './phoneUtils'
import { statusDaMeta } from './statusEntrega'

/** Mensagem de entrada já na forma de fio de `conversationTypes.ts`. */
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
}

export type StatusRecebido = { message_id: string; status: DeliveryStatus }

export type WebhookParseado = { mensagens: MensagemRecebida[]; statuses: StatusRecebido[] }

type Qualquer = Record<string, unknown>

function obj(v: unknown): Qualquer | null {
  return typeof v === 'object' && v !== null ? (v as Qualquer) : null
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}
function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

/** Conteúdo textual por tipo. O que não tem texto vira null (a mídia carrega o resto). */
function conteudo(msg: Qualquer, tipo: string): string | null {
  switch (tipo) {
    case 'text':
      return str(obj(msg.text)?.body)
    case 'button':
      return str(obj(msg.button)?.text)
    case 'interactive': {
      const i = obj(msg.interactive)
      return str(obj(i?.button_reply)?.title) ?? str(obj(i?.list_reply)?.title)
    }
    case 'image':
    case 'video':
    case 'document':
      return str(obj(msg[tipo])?.caption)
    default:
      return null
  }
}

/** Mídia por tipo. Áudio e sticker não têm caption, mas têm id e mime. */
function midia(msg: Qualquer, tipo: string): { id: string | null; mime: string | null } {
  const comMidia = ['image', 'video', 'audio', 'document', 'sticker']
  if (!comMidia.includes(tipo)) return { id: null, mime: null }
  const m = obj(msg[tipo])
  return { id: str(m?.id), mime: str(m?.mime_type) }
}

export function parseWebhook(payload: unknown): WebhookParseado {
  const mensagens: MensagemRecebida[] = []
  const statuses: StatusRecebido[] = []

  const raiz = obj(payload)
  if (!raiz) return { mensagens, statuses }

  for (const entrada of arr(raiz.entry)) {
    for (const mudanca of arr(obj(entrada)?.changes)) {
      const valor = obj(obj(mudanca)?.value)
      if (!valor) continue

      const phoneId = str(obj(valor.metadata)?.phone_number_id)

      // Nome do contato: vem em `contacts`, casado por wa_id.
      const nomePorWaId = new Map<string, string>()
      for (const c of arr(valor.contacts)) {
        const contato = obj(c)
        const waId = str(contato?.wa_id)
        const nome = str(obj(contato?.profile)?.name)
        if (waId && nome) nomePorWaId.set(waId, nome)
      }

      for (const m of arr(valor.messages)) {
        const msg = obj(m)
        const id = str(msg?.id)
        const from = str(msg?.from)
        if (!msg || !id) continue

        const tipo = str(msg.type) ?? 'unknown'
        const { id: mediaId, mime } = midia(msg, tipo)
        const ts = Number(msg.timestamp)

        mensagens.push({
          message_id: id,
          // Gravamos os 11 dígitos canônicos: o `from` da Meta pode vir sem o
          // nono dígito e a conversa racharia em dois cards. Spec §2.1.
          phone: from ? (telNorm11(from) ?? from) : null,
          phone_id: phoneId,
          contact_name: from ? (nomePorWaId.get(from) ?? null) : null,
          message_type: tipo,
          content: conteudo(msg, tipo),
          created_at: new Date((Number.isFinite(ts) ? ts : 0) * 1000).toISOString(),
          media_id: mediaId,
          media_mime_type: mime,
          reply_to_message_id: str(obj(msg.context)?.id),
        })
      }

      for (const s of arr(valor.statuses)) {
        const st = obj(s)
        const id = str(st?.id)
        const bruto = str(st?.status)
        if (!id || !bruto) continue
        const traduzido = statusDaMeta(bruto)
        if (traduzido) statuses.push({ message_id: id, status: traduzido })
      }
    }
  }

  return { mensagens, statuses }
}
```

- [ ] **Step 4: Rodar e conferir**

Rodar: `npm test -- src/lib/webhookParse.test.ts`
Esperado: **6 testes passam.**

---

### Task 4: Validação de template antes de submeter

O teste de envio real devolveu `132018 — Button at index 0 of type Url does not require parameters`. A tela de criação (Task 17) tem de pegar isso antes da Meta.

**Files:**
- Create: `src/lib/templates.ts`
- Test: `src/lib/templates.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/lib/templates.test.ts
import { describe, expect, it } from 'vitest'
import { contarVariaveis, parametrosDoTemplate, validarTemplate, type RascunhoTemplate } from './templates'

const BASE: RascunhoTemplate = {
  nome: 'reativacao_agosto',
  categoria: 'MARKETING',
  idioma: 'pt_BR',
  cabecalho: null,
  corpo: 'Oi, {{1}}. Faz {{2}} dias que você não entra na Artha.',
  exemplos: ['Rafael', '90'],
  rodape: null,
  botoes: [],
}

describe('contarVariaveis', () => {
  it('conta variáveis distintas', () => {
    expect(contarVariaveis('Oi, {{1}}. Faz {{2}} dias.')).toBe(2)
    expect(contarVariaveis('Oi, {{1}}. Tudo bem, {{1}}?')).toBe(1)
    expect(contarVariaveis('Sem variável')).toBe(0)
  })
})

describe('validarTemplate — nome', () => {
  it('aceita minúsculas com underscore', () => {
    expect(validarTemplate(BASE)).toEqual([])
  })

  it('recusa maiúsculas, espaço e hífen', () => {
    expect(validarTemplate({ ...BASE, nome: 'Reativacao Agosto' })).toContain(
      'O nome só aceita letras minúsculas, números e underscore.'
    )
    expect(validarTemplate({ ...BASE, nome: 'reativacao-agosto' })).toContain(
      'O nome só aceita letras minúsculas, números e underscore.'
    )
  })
})

describe('validarTemplate — variáveis e exemplos', () => {
  it('exige um exemplo por variável', () => {
    expect(validarTemplate({ ...BASE, exemplos: ['Rafael'] })).toContain(
      'O corpo tem 2 variáveis e 1 exemplo. Preencha um exemplo para cada.'
    )
  })

  it('recusa variáveis fora de sequência', () => {
    expect(validarTemplate({ ...BASE, corpo: 'Oi, {{1}} e {{3}}.', exemplos: ['a', 'b'] })).toContain(
      'As variáveis precisam ser sequenciais a partir de {{1}}.'
    )
  })

  it('recusa corpo vazio', () => {
    expect(validarTemplate({ ...BASE, corpo: '   ', exemplos: [] })).toContain(
      'O corpo não pode ficar vazio.'
    )
  })
})

describe('validarTemplate — botões', () => {
  it('recusa variável em botão URL estático', () => {
    const erros = validarTemplate({
      ...BASE,
      botoes: [{ tipo: 'URL', texto: 'Abrir', url: 'https://arthafp.com.br/painel' }],
    })
    expect(erros).toEqual([])
  })

  it('aceita URL com sufixo variável e exige exemplo', () => {
    const erros = validarTemplate({
      ...BASE,
      botoes: [{ tipo: 'URL', texto: 'Abrir', url: 'https://arthafp.com.br/{{1}}' }],
    })
    expect(erros).toContain('O botão "Abrir" usa {{1}} na URL e precisa de um exemplo.')
  })

  it('recusa mais de três botões de resposta rápida', () => {
    const botoes = ['a', 'b', 'c', 'd'].map((t) => ({ tipo: 'QUICK_REPLY' as const, texto: t }))
    expect(validarTemplate({ ...BASE, botoes })).toContain(
      'No máximo 3 botões de resposta rápida.'
    )
  })
})

describe('parametrosDoTemplate — monta o componente de envio', () => {
  it('monta só o body quando o botão URL é estático', () => {
    // Reproduz o erro 132018 encontrado no teste real: botão URL estático NÃO
    // aceita parâmetro. Mandar `button` aqui é o que a Meta recusou.
    const componentes = parametrosDoTemplate(
      { ...BASE, botoes: [{ tipo: 'URL', texto: 'Abrir', url: 'https://arthafp.com.br/painel' }] },
      ['Rafael', '90']
    )
    expect(componentes).toEqual([
      { type: 'body', parameters: [{ type: 'text', text: 'Rafael' }, { type: 'text', text: '90' }] },
    ])
  })

  it('inclui o parâmetro do botão quando a URL tem variável', () => {
    const componentes = parametrosDoTemplate(
      { ...BASE, botoes: [{ tipo: 'URL', texto: 'Abrir', url: 'https://arthafp.com.br/{{1}}' }] },
      ['Rafael', '90'],
      ['painel']
    )
    expect(componentes).toContainEqual({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: 'painel' }],
    })
  })

  it('omite o body quando o template não tem variáveis', () => {
    expect(parametrosDoTemplate({ ...BASE, corpo: 'Aviso fixo.', exemplos: [] }, [])).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Rodar: `npm test -- src/lib/templates.test.ts`
Esperado: FALHA — módulo não existe.

- [ ] **Step 3: Implementar**

```ts
// src/lib/templates.ts
// Regras de template da Cloud API, puras e testadas. Existem para pegar
// localmente o que a Meta recusaria — o erro 132018 encontrado no teste real de
// 2026-08-20 é o caso-canário. Ver spec §7.1.

export type BotaoTemplate =
  | { tipo: 'QUICK_REPLY'; texto: string }
  | { tipo: 'URL'; texto: string; url: string }
  | { tipo: 'PHONE_NUMBER'; texto: string; telefone: string }

export type RascunhoTemplate = {
  nome: string
  categoria: 'MARKETING' | 'UTILITY'
  idioma: 'pt_BR'
  cabecalho: string | null
  corpo: string
  exemplos: string[]
  rodape: string | null
  botoes: BotaoTemplate[]
}

const VARIAVEL = /\{\{(\d+)\}\}/g

/** Índices distintos de variável, em ordem crescente. */
function indices(texto: string): number[] {
  const vistos = new Set<number>()
  for (const m of texto.matchAll(VARIAVEL)) vistos.add(Number(m[1]))
  return [...vistos].sort((a, b) => a - b)
}

export function contarVariaveis(texto: string): number {
  return indices(texto).length
}

export function validarTemplate(t: RascunhoTemplate): string[] {
  const erros: string[] = []

  if (!/^[a-z0-9_]+$/.test(t.nome)) {
    erros.push('O nome só aceita letras minúsculas, números e underscore.')
  }

  if (t.corpo.trim() === '') {
    erros.push('O corpo não pode ficar vazio.')
  } else {
    const idx = indices(t.corpo)
    const sequencial = idx.every((n, i) => n === i + 1)
    if (!sequencial) erros.push('As variáveis precisam ser sequenciais a partir de {{1}}.')
    if (idx.length !== t.exemplos.length) {
      const plural = t.exemplos.length === 1 ? 'exemplo' : 'exemplos'
      erros.push(
        `O corpo tem ${idx.length} variáveis e ${t.exemplos.length} ${plural}. Preencha um exemplo para cada.`
      )
    }
  }

  const quickReplies = t.botoes.filter((b) => b.tipo === 'QUICK_REPLY')
  if (quickReplies.length > 3) erros.push('No máximo 3 botões de resposta rápida.')

  for (const b of t.botoes) {
    // Botão URL com variável exige exemplo; botão URL estático NÃO aceita
    // parâmetro nenhum — foi exatamente isso que a Meta recusou com 132018.
    if (b.tipo === 'URL' && contarVariaveis(b.url) > 0) {
      erros.push(`O botão "${b.texto}" usa {{1}} na URL e precisa de um exemplo.`)
    }
  }

  return erros
}

type Parametro = { type: 'text'; text: string }
export type ComponenteEnvio =
  | { type: 'body'; parameters: Parametro[] }
  | { type: 'button'; sub_type: 'url'; index: string; parameters: Parametro[] }

/**
 * Monta os `components` do POST /messages. Componente vazio é OMITIDO: mandar
 * `button` para um botão URL estático é o erro 132018.
 */
export function parametrosDoTemplate(
  t: RascunhoTemplate,
  valoresDoCorpo: string[],
  valoresDeBotao: string[] = []
): ComponenteEnvio[] {
  const componentes: ComponenteEnvio[] = []

  if (valoresDoCorpo.length > 0) {
    componentes.push({
      type: 'body',
      parameters: valoresDoCorpo.map((text) => ({ type: 'text', text })),
    })
  }

  t.botoes.forEach((b, index) => {
    if (b.tipo !== 'URL') return
    if (contarVariaveis(b.url) === 0) return
    const valor = valoresDeBotao.shift()
    if (valor === undefined) return
    componentes.push({
      type: 'button',
      sub_type: 'url',
      index: String(index),
      parameters: [{ type: 'text', text: valor }],
    })
  })

  return componentes
}
```

- [ ] **Step 4: Rodar e conferir**

Rodar: `npm test -- src/lib/templates.test.ts`
Esperado: **12 testes passam.**

---

### Task 5: Mover as regras de negócio para fora de `src/mock/`

`ehInativo`, `diasSemAcesso`, `recorteReativacao` e `getMetrics` são regra de negócio morando num diretório chamado "mock". Spec §5.2.

**Files:**
- Create: `src/lib/regras.ts`
- Modify: `src/mock/metrics.ts`
- Test: `src/mock/metrics.test.ts` (deve continuar passando **sem edição**)

- [ ] **Step 1: Ler o que existe antes de mover**

Rodar: `cat src/mock/metrics.ts`
Este é um **move**, não uma reescrita. Copie o corpo das funções sem alterar lógica.

- [ ] **Step 2: Criar `src/lib/regras.ts`**

Mover para lá, na íntegra: `FAIXAS_SEM_ACESSO`, `FaixaSemAcesso`, `DIAS_SEM_ACESSO_INATIVO`, `diasSemAcesso`, `ehAtivo`, `ehInativo`, `FiltroRecorte`, `recorteReativacao`, `Metrics`, `getMetrics`.

Duas mudanças de assinatura, e só estas:
- O parâmetro `agora` deixa de ter default `agoraDemo()` e passa a ser **obrigatório** — o servidor passa `new Date()`, o teste passa a âncora. Assim `src/lib/` não depende de `src/mock/`.
- `getMetrics` e `recorteReativacao` recebem `leads: Lead[]` como primeiro parâmetro em vez de lerem `LEADS` do módulo.

O import de `Lead` fica `import type { Lead } from '@/mock/types'`.

- [ ] **Step 3: `src/mock/metrics.ts` vira adaptador**

```ts
// src/mock/metrics.ts
// As regras mudaram para `src/lib/regras.ts` (spec §5.2) — elas são regra de
// negócio e o servidor precisa delas sem arrastar o dataset fictício junto.
// Este módulo permanece como adaptador: aplica o dataset e a âncora da demo,
// preservando a assinatura que os testes e as telas já usam.
import { agoraDemo, LEADS } from './db'
import * as regras from '@/lib/regras'
import type { Lead } from './types'

export { FAIXAS_SEM_ACESSO, DIAS_SEM_ACESSO_INATIVO } from '@/lib/regras'
export type { FaixaSemAcesso, FiltroRecorte, Metrics } from '@/lib/regras'

export function diasSemAcesso(lead: Lead, agora: Date = agoraDemo()): number {
  return regras.diasSemAcesso(lead, agora)
}
export function ehAtivo(lead: Lead, agora: Date = agoraDemo()): boolean {
  return regras.ehAtivo(lead, agora)
}
export function ehInativo(lead: Lead, agora: Date = agoraDemo()): boolean {
  return regras.ehInativo(lead, agora)
}
export function recorteReativacao(
  filtro: regras.FiltroRecorte = {},
  agora: Date = agoraDemo()
): Lead[] {
  return regras.recorteReativacao(LEADS, filtro, agora)
}
export function getMetrics(agora: Date = agoraDemo()): regras.Metrics {
  return regras.getMetrics(LEADS, agora)
}
```

Se as assinaturas originais de `ehAtivo`/`ehInativo` não recebiam `agora`, mantenha exatamente como estavam — o adaptador existe para **não** quebrar chamadores.

- [ ] **Step 4: Rodar a suíte inteira**

Rodar: `npm test`
Esperado: **todos os testes existentes passam sem edição.** `src/mock/metrics.test.ts` é a prova de que o move preservou comportamento. Se ele falhar, o move mudou lógica — desfaça e refaça.

- [ ] **Step 5: Conferir que a regra não importa mais o mock**

Rodar: `grep -n "mock/db\|from './db'" src/lib/regras.ts`
Esperado: **nenhuma saída.** `src/lib/regras.ts` só pode importar `type` de `@/mock/types`.

---

## Onda B — infraestrutura de servidor

### Task 6: Dependências e ambiente

**Files:**
- Modify: `package.json`, `.gitignore`
- Create: `.env.local.example`, `src/server/env.ts`

- [ ] **Step 1: Instalar**

Rodar: `npm install @supabase/supabase-js` e `npm install -D tsx dotenv`

- [ ] **Step 2: Escrever `.env.local.example`**

```bash
# Meta / WhatsApp Cloud API — valores verificados em 2026-08-20
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=1305873789266362
WHATSAPP_BUSINESS_ACCOUNT_ID=1440374588143232
GRAPH_API_VERSION=v21.0
META_APP_ID=2874700529566559
META_APP_SECRET=
WEBHOOK_VERIFY_TOKEN=vistra_artha_2026

# Supabase — o browser NUNCA usa a service role. Sem prefixo NEXT_PUBLIC_.
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Worker de disparo
CRON_SECRET=
# Conversas iniciadas por 24h. A API não expõe o degrau para este token;
# 250 é o degrau conservador. Ver spec §7.3.
DISPARO_LIMITE_DIARIO=250

TENANT_NAME=artha
```

- [ ] **Step 3: Garantir que segredo não vaza**

Rodar: `grep -n "env" .gitignore`
Se `.env*.local` não estiver listado, acrescentar `.env*.local` e `.env`.

- [ ] **Step 4: Escrever `src/server/env.ts`**

```ts
// src/server/env.ts
// Leitura validada de ambiente. Falha ALTO no boot em vez de devolver
// `undefined` que só estoura três camadas abaixo, dentro de um fetch pra Meta.
import 'server-only'

function obrigatorio(nome: string): string {
  const v = process.env[nome]
  if (!v) throw new Error(`Variável de ambiente ausente: ${nome}. Veja .env.local.example.`)
  return v
}

export const env = {
  get supabaseUrl() { return obrigatorio('NEXT_PUBLIC_SUPABASE_URL') },
  get supabaseServiceKey() { return obrigatorio('SUPABASE_SERVICE_ROLE_KEY') },
  get whatsappToken() { return obrigatorio('WHATSAPP_ACCESS_TOKEN') },
  get phoneNumberId() { return obrigatorio('WHATSAPP_PHONE_NUMBER_ID') },
  get wabaId() { return obrigatorio('WHATSAPP_BUSINESS_ACCOUNT_ID') },
  get graphVersion() { return process.env.GRAPH_API_VERSION ?? 'v21.0' },
  get appSecret() { return obrigatorio('META_APP_SECRET') },
  get verifyToken() { return obrigatorio('WEBHOOK_VERIFY_TOKEN') },
  get cronSecret() { return obrigatorio('CRON_SECRET') },
  get limiteDiario() { return Number(process.env.DISPARO_LIMITE_DIARIO ?? '250') },
}
```

- [ ] **Step 5: Instalar `server-only`**

Rodar: `npm install server-only`
Esperado: instala. Este pacote faz o **build quebrar** se um módulo de servidor for importado por componente de cliente — é a rede de proteção contra a service key vazar no bundle.

---

### Task 7: Migration do schema

**Files:**
- Create: `supabase/migrations/0001_schema.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/0001_schema.sql
-- Artha System — schema do backend real. Spec §4.
-- Copiável inteiro no SQL Editor do Supabase; a CLI não é necessária.

-- ─── tel_norm11: espelho EXATO de telNorm11() em src/lib/phoneUtils.ts ───────
-- Spec §2.1. Divergência entre as duas racha a conversa em dois cards.
create or replace function tel_norm11(t text) returns text
-- `set search_path` fecha o aviso `function_search_path_mutable` do linter do
-- Supabase. SET não afeta a imutabilidade, então a coluna gerada segue válida.
language plpgsql immutable set search_path = pg_catalog, pg_temp as $$
declare clean text; national text;
begin
  if t is null then return null; end if;
  clean := regexp_replace(t, '\D', '', 'g');
  if left(clean, 2) = '55' and length(clean) in (12, 13) then
    national := substr(clean, 3);
  else
    national := clean;
  end if;
  if length(national) = 11 then return national; end if;
  -- Fixo (assinante começando em 2-5) NUNCA ganha 9º dígito fabricado.
  if length(national) = 10 and substr(national, 3, 1) ~ '[6-9]' then
    return substr(national, 1, 2) || '9' || substr(national, 3);
  end if;
  return null;
end;
$$;

-- ─── leads ───────────────────────────────────────────────────────────────────
create table if not exists leads (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  telefone      text not null,
  tel_norm      text generated always as (tel_norm11(telefone)) stored,
  email         text,
  segmento      text not null default 'artha' check (segmento in ('artha','dhana','lucia')),
  stage         text not null default 'novo'
                check (stage in ('novo','contatado','qualificado','convertido','perdido')),
  plano_status  text not null default 'trial_expirado'
                check (plano_status in ('ativo','cancelado','trial_expirado','inadimplente')),
  plano_valor   numeric,
  ultimo_acesso_em    timestamptz,
  primeiro_contato_em timestamptz not null default now(),
  ultima_interacao_em timestamptz not null default now(),
  cidade        text,
  tags          text[] not null default '{}',
  notas         text,
  criado_em     timestamptz not null default now()
);
create unique index if not exists leads_tel_norm_uk on leads (tel_norm) where tel_norm is not null;
create index if not exists leads_stage_idx on leads (stage);
create index if not exists leads_segmento_idx on leads (segmento);
create index if not exists leads_ultimo_acesso_idx on leads (ultimo_acesso_em);

-- ─── messages: as colunas SÃO a forma de fio de conversationTypes.ts ─────────
create table if not exists messages (
  id                uuid primary key default gen_random_uuid(),
  message_id        text unique,               -- wamid: idempotência do webhook
  lead_id           uuid references leads(id) on delete set null,
  phone             text,                      -- SEMPRE os 11 dígitos canônicos
  phone_id          text,
  bsuid             text,
  contact_name      text,
  message_type      text not null default 'text',
  content           text,
  direction         text not null check (direction in ('inbound','outbound')),
  created_at        timestamptz not null default now(),
  raw_payload       jsonb,
  media_id          text,
  media_mime_type   text,
  media_storage_path text,
  reply_to_message_id text,
  status            text check (status in ('enviado','entregue','lido','falhou')),
  enviado_por       text,
  campanha_id       uuid
);
create index if not exists messages_card_idx on messages (phone_id, phone, created_at desc);
create index if not exists messages_lead_idx on messages (lead_id, created_at desc);
create index if not exists messages_inbound_idx on messages (phone, created_at desc)
  where direction = 'inbound';

-- ─── conversation_reads: não-lidas por card ─────────────────────────────────
create table if not exists conversation_reads (
  key         text primary key,               -- (bsuid ?? phone) || '::' || (phone_id ?? '')
  lido_ate    timestamptz not null default now()
);

-- ─── campanhas ───────────────────────────────────────────────────────────────
create table if not exists campanhas (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  template       text not null,
  segmento_alvo  text not null default 'todos',
  criada_em      timestamptz not null default now(),
  criada_por     text
);

-- ─── agendamentos: a fila de disparo ────────────────────────────────────────
create table if not exists agendamentos (
  id             uuid primary key default gen_random_uuid(),
  lead_id        uuid not null references leads(id) on delete cascade,
  campanha_id    uuid references campanhas(id) on delete cascade,
  template       text not null,
  variaveis      jsonb not null default '[]',
  agendado_para  timestamptz not null default now(),
  status         text not null default 'pendente'
                 check (status in ('pendente','enviando','enviado','falhou','cancelado')),
  tentativas     int not null default 0,
  erro           text,
  message_id     text,
  atualizado_em  timestamptz not null default now()
);
create index if not exists agendamentos_fila_idx on agendamentos (status, agendado_para);
-- Um lead não entra duas vezes na MESMA campanha. Critério de aceitação 8.
create unique index if not exists agendamentos_campanha_lead_uk
  on agendamentos (campanha_id, lead_id) where campanha_id is not null;

-- ─── templates: cache local do que existe na Meta ───────────────────────────
create table if not exists templates (
  nome        text primary key,
  meta_id     text,
  categoria   text not null check (categoria in ('MARKETING','UTILITY','AUTHENTICATION')),
  idioma      text not null default 'pt_BR',
  corpo       text not null,
  componentes jsonb not null default '[]',
  botoes      text[] not null default '{}',
  status      text not null default 'pendente'
              check (status in ('aprovado','pendente','rejeitado','pausado')),
  motivo_rejeicao text,
  sincronizado_em timestamptz
);

-- ─── quick_replies ───────────────────────────────────────────────────────────
create table if not exists quick_replies (
  id       uuid primary key default gen_random_uuid(),
  shortcut text not null unique,
  message  text not null
);

-- ─── webhook_events: payload cru, idempotência e depuração ──────────────────
create table if not exists webhook_events (
  id           uuid primary key default gen_random_uuid(),
  payload      jsonb not null,
  recebido_em  timestamptz not null default now(),
  processado_em timestamptz,
  erro         text
);
create index if not exists webhook_events_recebido_idx on webhook_events (recebido_em desc);

-- ─── reservar_agendamentos: a trava que impede disparo duplo ────────────────
-- `for update skip locked` é o que faz duas execuções sobrepostas do worker não
-- pegarem a mesma linha. Critério de aceitação 8.
create or replace function reservar_agendamentos(limite int)
returns setof agendamentos
language plpgsql as $$
begin
  -- Reaper. Um worker que morre entre reservar e enviar deixa a linha presa em
  -- 'enviando': nenhuma execução futura a recupera e o disparo some em
  -- silêncio. Cinco minutos é folga larga sobre o maxDuration de 60s da rota.
  update agendamentos
     set status = 'pendente', atualizado_em = now()
   where status = 'enviando'
     and atualizado_em < now() - interval '5 minutes';

  return query
  update agendamentos a
     set status = 'enviando', atualizado_em = now()
   where a.id in (
     select id from agendamentos
      where status = 'pendente' and agendado_para <= now()
      order by agendado_para
      limit limite
      for update skip locked
   )
  returning a.*;
end;
$$;

-- ─── RLS: deny all. Todo acesso é servidor, com service_role. Spec §8. ──────
alter table leads              enable row level security;
alter table messages           enable row level security;
alter table conversation_reads enable row level security;
alter table campanhas          enable row level security;
alter table agendamentos       enable row level security;
alter table templates          enable row level security;
alter table quick_replies      enable row level security;
alter table webhook_events     enable row level security;
```

- [ ] **Step 2: Aplicar**

Colar o arquivo inteiro no SQL Editor do projeto Supabase e executar.
Esperado: `Success. No rows returned`.

Se `NEXT_PUBLIC_SUPABASE_URL` ainda não existir (bloqueio 1 da spec §9), **pare aqui e siga para a Task 8** — as tarefas seguintes são escritas e revisadas sem banco; só a execução de ponta a ponta espera.

- [ ] **Step 3: Provar a paridade da normalização**

```sql
select tel_norm11('553488861441') as devolvido_pela_meta,   -- 34988861441
       tel_norm11('5534988861441') as enviado_por_nos,      -- 34988861441
       tel_norm11('553432451234') as fixo;                  -- null
```
Esperado: as duas primeiras colunas iguais a `34988861441`, a terceira `null`.
Se divergir de `CASOS_TELEFONE` (Task 1), a função SQL está errada.

---

### Task 8: Client do Supabase

**Files:**
- Create: `src/server/supabase.ts`

- [ ] **Step 1: Escrever**

```ts
// src/server/supabase.ts
// Client de SERVIDOR, com service_role. O browser nunca importa este módulo —
// `server-only` faz o build quebrar se alguém tentar. Spec §3.2.
import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from './env'

let client: SupabaseClient | null = null

export function db(): SupabaseClient {
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return client
}
```

- [ ] **Step 2: Conferir que o type-check passa**

Rodar: `npx tsc --noEmit`
Esperado: sem erro em `src/server/supabase.ts`.

---

### Task 9: Assinatura do webhook

Critério de aceitação 3: assinatura inválida → 401 e zero linhas gravadas.

**Files:**
- Create: `src/server/meta/assinatura.ts`
- Test: `src/server/meta/assinatura.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/server/meta/assinatura.test.ts
import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { assinaturaConfere } from './assinatura'

const SEGREDO = 'segredo_de_teste'
const CORPO = '{"object":"whatsapp_business_account","entry":[]}'

function assinar(corpo: string, segredo = SEGREDO): string {
  return 'sha256=' + createHmac('sha256', segredo).update(corpo).digest('hex')
}

describe('assinaturaConfere', () => {
  it('aceita a assinatura correta', () => {
    expect(assinaturaConfere(CORPO, assinar(CORPO), SEGREDO)).toBe(true)
  })

  it('recusa corpo adulterado', () => {
    expect(assinaturaConfere(CORPO + ' ', assinar(CORPO), SEGREDO)).toBe(false)
  })

  it('recusa assinatura feita com outro segredo', () => {
    expect(assinaturaConfere(CORPO, assinar(CORPO, 'outro'), SEGREDO)).toBe(false)
  })

  it('recusa header ausente, vazio ou sem o prefixo sha256=', () => {
    expect(assinaturaConfere(CORPO, null, SEGREDO)).toBe(false)
    expect(assinaturaConfere(CORPO, '', SEGREDO)).toBe(false)
    expect(assinaturaConfere(CORPO, 'abc123', SEGREDO)).toBe(false)
  })

  it('recusa hex de tamanho errado sem estourar', () => {
    expect(assinaturaConfere(CORPO, 'sha256=dead', SEGREDO)).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Rodar: `npm test -- src/server/meta/assinatura.test.ts`
Esperado: FALHA — módulo não existe.

- [ ] **Step 3: Implementar**

```ts
// src/server/meta/assinatura.ts
// Verificação de X-Hub-Signature-256. Sem isto, qualquer um injeta mensagem no
// painel com um POST. Spec §6.2 e §8.
import { createHmac, timingSafeEqual } from 'node:crypto'

export function assinaturaConfere(
  corpoCru: string,
  header: string | null,
  segredo: string
): boolean {
  if (!header?.startsWith('sha256=')) return false

  const recebida = Buffer.from(header.slice('sha256='.length), 'hex')
  const esperada = createHmac('sha256', segredo).update(corpoCru).digest()

  // timingSafeEqual estoura se os tamanhos diferirem — compare antes.
  if (recebida.length !== esperada.length) return false
  return timingSafeEqual(recebida, esperada)
}
```

- [ ] **Step 4: Rodar e conferir**

Rodar: `npm test -- src/server/meta/assinatura.test.ts`
Esperado: **5 testes passam.**

---

### Task 10: Cliente da Cloud API

**Files:**
- Create: `src/server/meta/client.ts`

- [ ] **Step 1: Escrever**

```ts
// src/server/meta/client.ts
// Cliente da WhatsApp Cloud API. Único lugar que fala com graph.facebook.com.
import 'server-only'
import { env } from '../env'
import type { ComponenteEnvio } from '@/lib/templates'

export class MetaError extends Error {
  constructor(readonly codigo: number, readonly detalhe: string) {
    super(`Meta ${codigo}: ${detalhe}`)
  }
}

async function chamar(caminho: string, init?: RequestInit): Promise<unknown> {
  const url = `https://graph.facebook.com/${env.graphVersion}/${caminho}`
  const resp = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.whatsappToken}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    cache: 'no-store',
  })
  const json = (await resp.json()) as Record<string, never>
  if (!resp.ok) {
    const erro = (json.error ?? {}) as { code?: number; message?: string; error_data?: { details?: string } }
    throw new MetaError(erro.code ?? resp.status, erro.error_data?.details ?? erro.message ?? 'erro desconhecido')
  }
  return json
}

type RespostaEnvio = { messages: { id: string }[]; contacts: { wa_id: string }[] }

/** Texto livre. Só vale dentro da janela de 24h — quem checa é o chamador. */
export async function enviarTexto(para: string, texto: string): Promise<RespostaEnvio> {
  return (await chamar(`${env.phoneNumberId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: para,
      type: 'text',
      text: { preview_url: false, body: texto },
    }),
  })) as RespostaEnvio
}

/** Template aprovado. Único envio possível fora da janela de 24h. */
export async function enviarTemplate(
  para: string,
  nome: string,
  componentes: ComponenteEnvio[],
  idioma = 'pt_BR'
): Promise<RespostaEnvio> {
  const template: Record<string, unknown> = { name: nome, language: { code: idioma } }
  // Componente vazio é OMITIDO: mandar `components: []` é o erro 132018.
  if (componentes.length > 0) template.components = componentes

  return (await chamar(`${env.phoneNumberId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ messaging_product: 'whatsapp', to: para, type: 'template', template }),
  })) as RespostaEnvio
}

export async function listarTemplatesDaMeta(): Promise<unknown> {
  return chamar(`${env.wabaId}/message_templates?fields=name,status,category,language,components,id&limit=100`)
}

export async function criarTemplateNaMeta(corpo: Record<string, unknown>): Promise<{ id: string }> {
  return (await chamar(`${env.wabaId}/message_templates`, {
    method: 'POST',
    body: JSON.stringify(corpo),
  })) as { id: string }
}

/** URL temporária da mídia de entrada. Expira em ~5 min e exige o token. */
export async function urlDaMidia(mediaId: string): Promise<string> {
  const r = (await chamar(mediaId)) as { url: string }
  return r.url
}

export async function baixarMidia(url: string): Promise<ArrayBuffer> {
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${env.whatsappToken}` } })
  if (!resp.ok) throw new MetaError(resp.status, 'falha ao baixar mídia')
  return resp.arrayBuffer()
}

/** Inscreve o app no webhook da WABA. Resolve o bloqueio 3 da spec §9. */
export async function inscreverWebhook(): Promise<unknown> {
  return chamar(`${env.wabaId}/subscribed_apps`, { method: 'POST' })
}
```

- [ ] **Step 2: Conferir o type-check**

Rodar: `npx tsc --noEmit`
Esperado: sem erro novo.

---

## Onda C — repositório

### Task 11: Repositório de leads

**Files:**
- Create: `src/server/repo/leads.ts`

- [ ] **Step 1: Escrever**

```ts
// src/server/repo/leads.ts
// Espelha as funções de leitura/escrita de leads de `src/mock/store.ts`, com as
// MESMAS assinaturas, contra o Postgres. Spec §3.2.
import 'server-only'
import { telNorm11 } from '@/lib/phoneUtils'
import type { FiltroLeads } from '@/hooks/useLeads'
import type { Lead } from '@/mock/types'
import { db } from '../supabase'

type LinhaLead = {
  id: string; nome: string; telefone: string; email: string | null
  segmento: string; stage: string; plano_status: string; plano_valor: number | null
  ultimo_acesso_em: string | null; primeiro_contato_em: string; ultima_interacao_em: string
  cidade: string | null; tags: string[]; notas: string | null
}

/** Linha do banco (snake_case) → domínio (camelCase de `src/mock/types.ts`). */
export function paraDominio(l: LinhaLead): Lead {
  return {
    id: l.id,
    nome: l.nome,
    telefone: l.telefone,
    email: l.email ?? '',
    segmento: l.segmento as Lead['segmento'],
    stage: l.stage as Lead['stage'],
    planoStatus: l.plano_status as Lead['planoStatus'],
    planoValor: l.plano_valor,
    ultimoAcessoEm: l.ultimo_acesso_em,
    primeiroContatoEm: l.primeiro_contato_em,
    ultimaInteracaoEm: l.ultima_interacao_em,
    cidade: l.cidade ?? '',
    tags: l.tags ?? [],
    notas: l.notas,
  }
}

export const TAMANHO_PAGINA = 25

export async function listarLeads(
  filtro: FiltroLeads = {}
): Promise<{ leads: Lead[]; total: number; totalGeral: number; pagina: number; paginas: number }> {
  const cliente = db()
  const { count: totalGeral } = await cliente.from('leads').select('id', { count: 'exact', head: true })

  let q = cliente.from('leads').select('*', { count: 'exact' })
  if (filtro.segmento && filtro.segmento !== 'todos') q = q.eq('segmento', filtro.segmento)
  if (filtro.stage && filtro.stage !== 'todos') q = q.eq('stage', filtro.stage)
  if (filtro.planoStatus && filtro.planoStatus !== 'todos') q = q.eq('plano_status', filtro.planoStatus)

  const busca = (filtro.busca ?? '').trim()
  if (busca) {
    const digitos = busca.replace(/\D/g, '')
    // Telefone casa pela forma canônica; nome casa por ilike. Spec §2.1.
    q = digitos.length >= 2
      ? q.or(`telefone.ilike.%${digitos}%,tel_norm.ilike.%${digitos}%,nome.ilike.%${busca}%`)
      : q.ilike('nome', `%${busca}%`)
  }

  // Contar primeiro para grampear a página: pedir range fora do fim devolve vazio.
  const { count: total } = await q.range(0, 0)
  const paginas = Math.max(1, Math.ceil((total ?? 0) / TAMANHO_PAGINA))
  const pagina = Math.min(Math.max(1, filtro.pagina ?? 1), paginas)
  const inicio = (pagina - 1) * TAMANHO_PAGINA

  const { data, error } = await q
    .order('ultima_interacao_em', { ascending: false })
    .range(inicio, inicio + TAMANHO_PAGINA - 1)
  if (error) throw new Error(`listarLeads: ${error.message}`)

  return {
    leads: (data as LinhaLead[]).map(paraDominio),
    total: total ?? 0,
    totalGeral: totalGeral ?? 0,
    pagina,
    paginas,
  }
}

/** Todos os leads, sem paginar. Só para as regras de `src/lib/regras.ts`. */
export async function todosOsLeads(): Promise<Lead[]> {
  const { data, error } = await db().from('leads').select('*').limit(50_000)
  if (error) throw new Error(`todosOsLeads: ${error.message}`)
  return (data as LinhaLead[]).map(paraDominio)
}

export async function buscarLead(id: string): Promise<Lead | null> {
  const { data } = await db().from('leads').select('*').eq('id', id).maybeSingle()
  return data ? paraDominio(data as LinhaLead) : null
}

/**
 * Lookup pela forma canônica. É ESTA função que reconcilia o wa_id de 12
 * dígitos da Meta com o telefone de 13 da base. Spec §2.1.
 */
export async function buscarLeadPorTelefone(telefone: string | null): Promise<Lead | null> {
  const norm = telNorm11(telefone)
  if (!norm) return null
  const { data } = await db().from('leads').select('*').eq('tel_norm', norm).maybeSingle()
  return data ? paraDominio(data as LinhaLead) : null
}

/** Acha ou cria. O webhook chama quando chega mensagem de número desconhecido. */
export async function acharOuCriarLeadPorTelefone(
  telefone: string,
  nome: string | null
): Promise<Lead | null> {
  const existente = await buscarLeadPorTelefone(telefone)
  if (existente) return existente

  const norm = telNorm11(telefone)
  if (!norm) return null // fixo ou lixo: não fabricamos lead

  const { data, error } = await db()
    .from('leads')
    .insert({ nome: nome ?? `+${telefone}`, telefone, stage: 'novo', segmento: 'artha' })
    .select('*')
    .single()

  // Corrida com outro evento do mesmo webhook: o unique de tel_norm venceu.
  if (error?.code === '23505') return buscarLeadPorTelefone(telefone)
  if (error) throw new Error(`acharOuCriarLeadPorTelefone: ${error.message}`)
  return paraDominio(data as LinhaLead)
}

export async function mudarEtapaLead(id: string, stage: Lead['stage']): Promise<Lead | null> {
  const { data, error } = await db()
    .from('leads')
    .update({ stage, ultima_interacao_em: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(`mudarEtapaLead: ${error.message}`)
  return paraDominio(data as LinhaLead)
}
```

- [ ] **Step 2: Type-check**

Rodar: `npx tsc --noEmit`
Esperado: sem erro.

---

### Task 12: Repositório de mensagens e conversas

**Files:**
- Create: `src/server/repo/mensagens.ts`
- Modify: `src/lib/conversationTypes.ts`

- [ ] **Step 1: Mudar `MensagemUI` para um módulo que os dois lados podem importar**

`MensagemUI` mora hoje em `src/mock/store.ts` e é usada por hooks e componentes
— que rodam no cliente. O repositório é `server-only`, então **não pode** ser a
casa desse tipo: importá-lo do cliente quebraria o build. Acrescentar ao fim de
`src/lib/conversationTypes.ts`, que é módulo puro de tipo, sem dependência:

```ts
/** Mensagem como a tela consome: forma de fio + status de entrega. */
export type MensagemUI = Message & {
  status: 'enviado' | 'entregue' | 'lido' | 'falhou' | null
}
```

O tipo é escrito literal, e não importado de `@/mock/types`, para preservar a
propriedade declarada no topo do arquivo: módulo sem dependência.

- [ ] **Step 2: Escrever o repositório**

```ts
// src/server/repo/mensagens.ts
// A conversa é DERIVADA de `messages` pela mesma `conversationKey` que o
// frontend usa — replicá-la em tabela criaria duas fontes de verdade. Spec §4.2.
import 'server-only'
import { conversationKey } from '@/lib/conversationKey'
import type { Conversation, Message as MensagemFio } from '@/lib/conversationTypes'
import { getWindowStatus } from '@/lib/janela24h'
import { avancarStatus } from '@/lib/statusEntrega'
import type { DeliveryStatus } from '@/mock/types'
import { db } from '../supabase'

// MensagemUI vem de conversationTypes (Step 1): o cliente também precisa dela,
// e este módulo é server-only.
export type { MensagemUI } from '@/lib/conversationTypes'
import type { MensagemUI } from '@/lib/conversationTypes'

type LinhaMensagem = MensagemFio & { status: DeliveryStatus | null; lead_id: string | null }

/** Todas as mensagens de um card, em ordem cronológica. */
export async function mensagensDoCard(key: string): Promise<MensagemUI[]> {
  const [identidade, phoneId] = key.split('::')
  let q = db().from('messages').select('*').order('created_at', { ascending: true })
  q = phoneId ? q.eq('phone_id', phoneId) : q.is('phone_id', null)
  const { data, error } = await q.or(`phone.eq.${identidade},bsuid.eq.${identidade}`)
  if (error) throw new Error(`mensagensDoCard: ${error.message}`)
  return (data as LinhaMensagem[]).map(({ lead_id: _lead, ...m }) => m)
}

/** Cards da lista + não-lidas, montados a partir das mensagens. */
export async function listarCardsDeConversa(): Promise<{
  conversas: Conversation[]
  naoLidas: Record<string, number>
}> {
  const { data, error } = await db()
    .from('messages')
    .select('phone,phone_id,bsuid,contact_name,content,created_at,direction,message_type')
    .order('created_at', { ascending: false })
    .limit(5_000)
  if (error) throw new Error(`listarCardsDeConversa: ${error.message}`)

  const { data: leituras } = await db().from('conversation_reads').select('key,lido_ate')
  const lidoAte = new Map((leituras ?? []).map((r) => [r.key as string, r.lido_ate as string]))

  const porChave = new Map<string, Conversation>()
  const naoLidas: Record<string, number> = {}

  // A consulta vem do mais recente para o mais antigo: a PRIMEIRA linha de cada
  // chave já é a última mensagem do card.
  for (const linha of data as LinhaMensagem[]) {
    const key = conversationKey(linha)
    if (!key) continue

    if (!porChave.has(key)) {
      porChave.set(key, {
        key,
        phone: linha.phone,
        phone_id: linha.phone_id,
        bsuid: linha.bsuid,
        contact_name: linha.contact_name,
        last_message: linha.content,
        last_message_time: linha.created_at,
        last_direction: linha.direction,
        last_message_type: linha.message_type,
      })
      naoLidas[key] = 0
    }
    // Contato ainda sem nome: a linha mais recente que tiver nome preenche.
    const card = porChave.get(key)!
    if (!card.contact_name && linha.contact_name) card.contact_name = linha.contact_name

    if (linha.direction === 'inbound') {
      const marca = lidoAte.get(key)
      if (!marca || new Date(linha.created_at) > new Date(marca)) naoLidas[key] += 1
    }
  }

  const conversas = [...porChave.values()].sort(
    (a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()
  )
  return { conversas, naoLidas }
}

export async function marcarCardLido(key: string): Promise<void> {
  const { error } = await db()
    .from('conversation_reads')
    .upsert({ key, lido_ate: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw new Error(`marcarCardLido: ${error.message}`)
}

/**
 * A janela de 24h do servidor. O botão do cliente pode estar com cache velho —
 * quem decide é aqui. Critério de aceitação 6.
 */
export async function janelaAberta(key: string): Promise<boolean> {
  const mensagens = await mensagensDoCard(key)
  return getWindowStatus(
    mensagens.map((m) => ({ direction: m.direction, created_at: m.created_at })),
    new Date()
  ).isOpen
}

/** Insere ignorando duplicata de wamid. Critério de aceitação 4. */
export async function inserirMensagem(
  m: Partial<LinhaMensagem> & { direction: 'inbound' | 'outbound' }
): Promise<void> {
  const { error } = await db().from('messages').upsert(m, { onConflict: 'message_id', ignoreDuplicates: true })
  if (error) throw new Error(`inserirMensagem: ${error.message}`)
}

/** Aplica o status sem deixar callback atrasado rebaixar. Critério 5. */
export async function aplicarStatus(messageId: string, novo: DeliveryStatus): Promise<void> {
  const { data } = await db().from('messages').select('status').eq('message_id', messageId).maybeSingle()
  if (!data) return // status de mensagem que não é nossa: ignora
  const resultante = avancarStatus((data.status as DeliveryStatus | null) ?? null, novo)
  if (resultante === data.status) return
  await db().from('messages').update({ status: resultante }).eq('message_id', messageId)
}

/** Conversas iniciadas nas últimas 24h — o teto do §7.3 conta por aqui. */
export async function conversasIniciadasEm24h(): Promise<number> {
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await db()
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('direction', 'outbound')
    .eq('message_type', 'template')
    .gte('created_at', desde)
  return count ?? 0
}
```

- [ ] **Step 3: Type-check**

Rodar: `npx tsc --noEmit`
Esperado: sem erro.

---

### Task 13: Repositório de campanhas, agendamentos e templates

**Files:**
- Create: `src/server/repo/campanhas.ts`, `src/server/repo/templates.ts`

- [ ] **Step 1: `src/server/repo/campanhas.ts`**

```ts
// src/server/repo/campanhas.ts
import 'server-only'
import type { Agendamento, Campanha } from '@/mock/types'
import { db } from '../supabase'

type LinhaAgendamento = {
  id: string; lead_id: string; campanha_id: string | null; template: string
  variaveis: string[]; agendado_para: string; status: string; tentativas: number
  erro: string | null; message_id: string | null
}

export function agendamentoParaDominio(a: LinhaAgendamento): Agendamento {
  return {
    id: a.id,
    leadId: a.lead_id,
    template: a.template,
    agendadoPara: a.agendado_para,
    status: a.status as Agendamento['status'],
    tentativas: a.tentativas,
    erro: a.erro,
  }
}

/**
 * Cria a campanha e enfileira um agendamento por lead. O unique
 * (campanha_id, lead_id) do schema garante que reenfileirar não duplica.
 */
export async function criarCampanha(args: {
  nome: string
  template: string
  segmentoAlvo: string
  leads: { id: string; variaveis: string[] }[]
  agendadoPara?: string
}): Promise<{ campanhaId: string; enfileirados: number }> {
  const { data: campanha, error } = await db()
    .from('campanhas')
    .insert({ nome: args.nome, template: args.template, segmento_alvo: args.segmentoAlvo })
    .select('id')
    .single()
  if (error) throw new Error(`criarCampanha: ${error.message}`)

  const quando = args.agendadoPara ?? new Date().toISOString()
  const linhas = args.leads.map((l) => ({
    lead_id: l.id,
    campanha_id: campanha.id as string,
    template: args.template,
    variaveis: l.variaveis,
    agendado_para: quando,
  }))

  // Lotes de 500: o PostgREST recusa payload muito grande, e 612 leads passam.
  let enfileirados = 0
  for (let i = 0; i < linhas.length; i += 500) {
    const lote = linhas.slice(i, i + 500)
    const { data, error: erroLote } = await db()
      .from('agendamentos')
      .upsert(lote, { onConflict: 'campanha_id,lead_id', ignoreDuplicates: true })
      .select('id')
    if (erroLote) throw new Error(`enfileirar: ${erroLote.message}`)
    enfileirados += data?.length ?? 0
  }

  return { campanhaId: campanha.id as string, enfileirados }
}

/**
 * Reserva até `limite` agendamentos, marcando-os `enviando` sob
 * `for update skip locked`. Duas execuções sobrepostas do worker NÃO pegam a
 * mesma linha. Critério de aceitação 8.
 */
export async function reservarAgendamentos(limite: number): Promise<LinhaAgendamento[]> {
  const { data, error } = await db().rpc('reservar_agendamentos', { limite })
  if (error) throw new Error(`reservarAgendamentos: ${error.message}`)
  return (data ?? []) as LinhaAgendamento[]
}

export async function marcarAgendamentoEnviado(id: string, messageId: string): Promise<void> {
  await db().from('agendamentos')
    .update({ status: 'enviado', message_id: messageId, erro: null, atualizado_em: new Date().toISOString() })
    .eq('id', id)
}

/** Falhou: reagenda com recuo exponencial até a terceira tentativa. */
export async function marcarAgendamentoFalho(id: string, tentativas: number, erro: string): Promise<void> {
  const desistiu = tentativas + 1 >= 3
  const recuoMin = Math.pow(3, tentativas + 1) // 3, 9, …
  await db().from('agendamentos').update({
    status: desistiu ? 'falhou' : 'pendente',
    tentativas: tentativas + 1,
    erro,
    agendado_para: desistiu
      ? undefined
      : new Date(Date.now() + recuoMin * 60_000).toISOString(),
    atualizado_em: new Date().toISOString(),
  }).eq('id', id)
}

/** Devolve reservados à fila sem gastar tentativa — usado quando o teto trava. */
export async function devolverAFila(ids: string[], quando: string): Promise<void> {
  if (ids.length === 0) return
  await db().from('agendamentos')
    .update({ status: 'pendente', agendado_para: quando, atualizado_em: new Date().toISOString() })
    .in('id', ids)
}

export async function listarAgendamentos(): Promise<Agendamento[]> {
  const { data, error } = await db().from('agendamentos').select('*').order('agendado_para', { ascending: true }).limit(2_000)
  if (error) throw new Error(`listarAgendamentos: ${error.message}`)
  return (data as LinhaAgendamento[]).map(agendamentoParaDominio)
}

export async function cancelarAgendamento(id: string): Promise<void> {
  await db().from('agendamentos').update({ status: 'cancelado' }).eq('id', id).eq('status', 'pendente')
}

/** Contadores DERIVADOS de `messages` — nunca digitados. Spec §4.2. */
export async function listarCampanhas(): Promise<Campanha[]> {
  const { data: campanhas, error } = await db().from('campanhas').select('*').order('criada_em', { ascending: false })
  if (error) throw new Error(`listarCampanhas: ${error.message}`)

  const resultado: Campanha[] = []
  for (const c of campanhas ?? []) {
    const id = c.id as string
    const { data: msgs } = await db().from('messages').select('status,lead_id').eq('campanha_id', id)
    const enviados = msgs?.length ?? 0
    const entregues = msgs?.filter((m) => m.status === 'entregue' || m.status === 'lido').length ?? 0
    const alvos = new Set((msgs ?? []).map((m) => m.lead_id).filter(Boolean) as string[])

    let respondidos = 0
    let qualificados = 0
    let convertidos = 0
    if (alvos.size > 0) {
      const ids = [...alvos]
      const { count } = await db().from('messages')
        .select('lead_id', { count: 'exact', head: true })
        .eq('direction', 'inbound').in('lead_id', ids)
      respondidos = count ?? 0
      const { data: leads } = await db().from('leads').select('stage').in('id', ids)
      qualificados = leads?.filter((l) => l.stage === 'qualificado').length ?? 0
      convertidos = leads?.filter((l) => l.stage === 'convertido').length ?? 0
    }

    resultado.push({
      id, nome: c.nome as string, template: c.template as string,
      criadaEm: c.criada_em as string,
      segmentoAlvo: c.segmento_alvo as Campanha['segmentoAlvo'],
      enviados, entregues, respondidos, qualificados, convertidos,
    })
  }
  return resultado
}
```

- [ ] **Step 2: `src/server/repo/templates.ts`**

```ts
// src/server/repo/templates.ts
import 'server-only'
import { listarTemplatesDaMeta } from '../meta/client'
import type { Template } from '@/mock/types'
import { db } from '../supabase'

type ComponenteMeta = { type: string; text?: string; buttons?: { text: string }[] }

export async function listarTemplates(): Promise<Template[]> {
  const { data, error } = await db().from('templates').select('*').order('nome')
  if (error) throw new Error(`listarTemplates: ${error.message}`)
  return (data ?? []).map((t) => ({
    nome: t.nome as string,
    categoria: t.categoria as Template['categoria'],
    idioma: 'pt_BR' as const,
    corpo: t.corpo as string,
    botoes: (t.botoes as string[]) ?? [],
    status: (t.status === 'aprovado' ? 'aprovado' : 'pendente') as Template['status'],
  }))
}

const STATUS_META: Record<string, string> = {
  APPROVED: 'aprovado', PENDING: 'pendente', REJECTED: 'rejeitado', PAUSED: 'pausado',
}

/** Puxa da Meta e reescreve o cache local. A Meta é a fonte da verdade. */
export async function sincronizarTemplates(): Promise<number> {
  const resposta = (await listarTemplatesDaMeta()) as {
    data: { id: string; name: string; status: string; category: string; language: string; components: ComponenteMeta[] }[]
  }

  const linhas = resposta.data.map((t) => {
    const corpo = t.components.find((c) => c.type === 'BODY')?.text ?? ''
    const botoes = t.components.find((c) => c.type === 'BUTTONS')?.buttons?.map((b) => b.text) ?? []
    return {
      nome: t.name, meta_id: t.id, categoria: t.category, idioma: t.language,
      corpo, componentes: t.components, botoes,
      status: STATUS_META[t.status] ?? 'pendente',
      sincronizado_em: new Date().toISOString(),
    }
  })

  if (linhas.length > 0) {
    const { error } = await db().from('templates').upsert(linhas, { onConflict: 'nome' })
    if (error) throw new Error(`sincronizarTemplates: ${error.message}`)
  }
  return linhas.length
}
```

- [ ] **Step 3: Type-check**

Rodar: `npx tsc --noEmit`
Esperado: sem erro.

---

## Onda D — rotas

### Task 14: Webhook

**Files:**
- Create: `src/app/api/webhook/route.ts`

- [ ] **Step 1: Escrever**

```ts
// src/app/api/webhook/route.ts
// Spec §6.1 e §6.2. Ordem obrigatória: assinatura → grava cru → responde 200
// → processa. A Meta re-entrega se demorarmos mais que ~5s, e re-entrega gera
// duplicata — por isso a idempotência por wamid.
import { NextResponse } from 'next/server'
import { parseWebhook } from '@/lib/webhookParse'
import { env } from '@/server/env'
import { assinaturaConfere } from '@/server/meta/assinatura'
import { acharOuCriarLeadPorTelefone } from '@/server/repo/leads'
import { aplicarStatus, inserirMensagem } from '@/server/repo/mensagens'
import { db } from '@/server/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Verificação da Meta: devolve hub.challenge como TEXTO PURO, não JSON. */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams
  if (p.get('hub.mode') === 'subscribe' && p.get('hub.verify_token') === env.verifyToken) {
    return new Response(p.get('hub.challenge') ?? '', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }
  return new Response('forbidden', { status: 403 })
}

export async function POST(req: Request) {
  // Corpo CRU: o HMAC é sobre os bytes exatos. `req.json()` reserializa e a
  // assinatura deixa de bater.
  const cru = await req.text()

  if (!assinaturaConfere(cru, req.headers.get('x-hub-signature-256'), env.appSecret)) {
    return NextResponse.json({ erro: 'assinatura inválida' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(cru)
  } catch {
    return NextResponse.json({ erro: 'json inválido' }, { status: 400 })
  }

  const { data: evento } = await db()
    .from('webhook_events').insert({ payload }).select('id').single()

  try {
    await processar(payload)
    await db().from('webhook_events')
      .update({ processado_em: new Date().toISOString() }).eq('id', evento?.id)
  } catch (e) {
    // 200 mesmo assim: o payload está salvo em webhook_events e pode ser
    // reprocessado. Devolver erro só faria a Meta re-entregar em loop.
    await db().from('webhook_events')
      .update({ erro: e instanceof Error ? e.message : String(e) }).eq('id', evento?.id)
  }

  return NextResponse.json({ ok: true })
}

async function processar(payload: unknown): Promise<void> {
  const { mensagens, statuses } = parseWebhook(payload)

  for (const m of mensagens) {
    const lead = m.phone ? await acharOuCriarLeadPorTelefone(m.phone, m.contact_name) : null
    await inserirMensagem({
      message_id: m.message_id,
      lead_id: lead?.id ?? null,
      phone: m.phone,
      phone_id: m.phone_id,
      bsuid: null,
      contact_name: m.contact_name,
      message_type: m.message_type,
      content: m.content,
      direction: 'inbound',
      created_at: m.created_at,
      raw_payload: null,
      media_id: m.media_id,
      media_mime_type: m.media_mime_type,
      media_storage_path: null,
      reply_to_message_id: m.reply_to_message_id,
    })
    if (lead) {
      await db().from('leads')
        .update({ ultima_interacao_em: m.created_at }).eq('id', lead.id)
    }
  }

  for (const s of statuses) await aplicarStatus(s.message_id, s.status)
}
```

- [ ] **Step 2: Provar o critério de aceitação 3 com o servidor rodando**

Rodar `npm run dev` numa aba e, noutra:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/webhook \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: sha256=deadbeef" \
  -d '{"object":"whatsapp_business_account","entry":[]}'
```
Esperado: **401**.

- [ ] **Step 3: Provar a verificação (GET)**

```bash
curl -s "http://localhost:3000/api/webhook?hub.mode=subscribe&hub.verify_token=vistra_artha_2026&hub.challenge=12345"
```
Esperado: **`12345`** em texto puro, sem aspas.

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/webhook?hub.mode=subscribe&hub.verify_token=errado&hub.challenge=12345"
```
Esperado: **403**.

- [ ] **Step 4: Provar idempotência (critério 4)**

Com `META_APP_SECRET` no `.env.local`, assinar um payload real e enviá-lo **duas vezes**:

```bash
BODY='{"object":"whatsapp_business_account","entry":[{"id":"1440374588143232","changes":[{"field":"messages","value":{"messaging_product":"whatsapp","metadata":{"display_phone_number":"553492114080","phone_number_id":"1305873789266362"},"contacts":[{"profile":{"name":"Teste"},"wa_id":"553488861441"}],"messages":[{"from":"553488861441","id":"wamid.DUPLICATA","timestamp":"1787200000","type":"text","text":{"body":"oi"}}]}}]}]}'
SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$META_APP_SECRET" -r | cut -d' ' -f1)"
for i in 1 2; do curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/webhook -H "Content-Type: application/json" -H "x-hub-signature-256: $SIG" -d "$BODY"; done
```
Esperado: **200, 200.** No SQL Editor:
```sql
select count(*) from messages where message_id = 'wamid.DUPLICATA';
```
Esperado: **1**. E o lead nasceu com `tel_norm = '34988861441'`.

---

### Task 15: Envio livre e leitura

**Files:**
- Create: `src/app/api/mensagens/route.ts`, `src/app/api/conversas/route.ts`, `src/app/api/conversas/[key]/mensagens/route.ts`, `src/app/api/conversas/[key]/lida/route.ts`

- [ ] **Step 1: `src/app/api/mensagens/route.ts`**

```ts
// src/app/api/mensagens/route.ts
// Envio livre. A janela de 24h é decidida NO SERVIDOR: o cliente pode estar com
// cache velho e o botão habilitado. Critério de aceitação 6.
import { NextResponse } from 'next/server'
import { enviarTexto, MetaError } from '@/server/meta/client'
import { inserirMensagem, janelaAberta } from '@/server/repo/mensagens'
import { buscarLeadPorTelefone } from '@/server/repo/leads'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { key, telefone, texto, enviadoPor } = (await req.json()) as {
    key: string; telefone: string; texto: string; enviadoPor?: string
  }

  if (!texto?.trim()) return NextResponse.json({ erro: 'texto vazio' }, { status: 400 })

  if (!(await janelaAberta(key))) {
    return NextResponse.json(
      { erro: 'janela_fechada', mensagem: 'A janela de 24h fechou. Só template aprovado pode sair.' },
      { status: 409 }
    )
  }

  try {
    const resposta = await enviarTexto(telefone, texto)
    const wamid = resposta.messages[0]?.id ?? null
    const lead = await buscarLeadPorTelefone(telefone)
    const [identidade, phoneId] = key.split('::')

    await inserirMensagem({
      message_id: wamid,
      lead_id: lead?.id ?? null,
      phone: identidade,
      phone_id: phoneId || null,
      message_type: 'text',
      content: texto,
      direction: 'outbound',
      created_at: new Date().toISOString(),
      status: 'enviado',
      enviado_por: enviadoPor ?? null,
    })

    return NextResponse.json({ ok: true, message_id: wamid })
  } catch (e) {
    if (e instanceof MetaError) {
      return NextResponse.json({ erro: 'meta', codigo: e.codigo, detalhe: e.detalhe }, { status: 502 })
    }
    throw e
  }
}
```

- [ ] **Step 2: As três rotas de conversa**

```ts
// src/app/api/conversas/route.ts
import { NextResponse } from 'next/server'
import { listarCardsDeConversa } from '@/server/repo/mensagens'
export const dynamic = 'force-dynamic'
export async function GET() {
  return NextResponse.json(await listarCardsDeConversa())
}
```

```ts
// src/app/api/conversas/[key]/mensagens/route.ts
import { NextResponse } from 'next/server'
import { mensagensDoCard } from '@/server/repo/mensagens'
export const dynamic = 'force-dynamic'
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  return NextResponse.json(await mensagensDoCard(decodeURIComponent(key)))
}
```

```ts
// src/app/api/conversas/[key]/lida/route.ts
import { NextResponse } from 'next/server'
import { marcarCardLido } from '@/server/repo/mensagens'
export const dynamic = 'force-dynamic'
export async function POST(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  await marcarCardLido(decodeURIComponent(key))
  return NextResponse.json({ ok: true })
}
```

Nota: no Next.js 16 `params` é uma **Promise** — precisa de `await`. Esquecer isso é erro de runtime, não de tipo.

- [ ] **Step 3: Type-check e build**

Rodar: `npx tsc --noEmit` e `npm run build`
Esperado: ambos limpos.

---

### Task 15A: Mídia de entrada e respostas rápidas

Fecha a spec §6.4 e a rota `/api/quick-replies` da §5.1.

**Files:**
- Create: `src/server/repo/midia.ts`, `src/app/api/midia/[id]/route.ts`, `src/app/api/quick-replies/route.ts`
- Modify: `src/app/api/webhook/route.ts`

- [ ] **Step 1: Criar o bucket no Supabase**

No painel do Supabase → Storage → New bucket: nome `midia`, **privado** (não público). Mídia de lead é dado do cliente; bucket público a expõe a quem tiver a URL.

- [ ] **Step 2: `src/server/repo/midia.ts`**

```ts
// src/server/repo/midia.ts
// A URL que a Meta devolve expira em ~5 min e exige o token — servir direto ao
// browser não funciona. Baixamos uma vez e guardamos. Spec §6.4.
import 'server-only'
import { baixarMidia, urlDaMidia } from '../meta/client'
import { db } from '../supabase'

const BUCKET = 'midia'

/** Baixa da Meta e guarda. Devolve o caminho no Storage, ou null se falhar. */
export async function arquivarMidia(
  mediaId: string,
  mime: string | null
): Promise<string | null> {
  try {
    const url = await urlDaMidia(mediaId)
    const bytes = await baixarMidia(url)
    const extensao = (mime?.split('/')[1] ?? 'bin').split(';')[0]
    const caminho = `${mediaId}.${extensao}`

    const { error } = await db().storage
      .from(BUCKET)
      .upload(caminho, bytes, { contentType: mime ?? 'application/octet-stream', upsert: true })
    if (error) return null

    await db().from('messages').update({ media_storage_path: caminho }).eq('media_id', mediaId)
    return caminho
  } catch {
    // Mídia perdida não pode derrubar o webhook: a mensagem já está gravada,
    // só o anexo falta. Melhor um anexo quebrado que uma conversa perdida.
    return null
  }
}

/** URL assinada, válida por uma hora. É o que a tela usa no <img>. */
export async function urlAssinada(caminho: string): Promise<string | null> {
  const { data } = await db().storage.from(BUCKET).createSignedUrl(caminho, 3_600)
  return data?.signedUrl ?? null
}
```

- [ ] **Step 3: Chamar o arquivamento no webhook**

Em `src/app/api/webhook/route.ts`, dentro de `processar`, logo depois do `inserirMensagem` de cada mensagem:

```ts
    if (m.media_id) await arquivarMidia(m.media_id, m.media_mime_type)
```

E o import: `import { arquivarMidia } from '@/server/repo/midia'`.

- [ ] **Step 4: A rota que a tela usa**

```ts
// src/app/api/midia/[id]/route.ts
// Redireciona para a URL assinada. A tela põe /api/midia/<media_id> no src e
// não precisa saber nada de Storage.
import { NextResponse } from 'next/server'
import { urlAssinada } from '@/server/repo/midia'
import { db } from '@/server/supabase'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data } = await db()
    .from('messages').select('media_storage_path').eq('media_id', id).maybeSingle()
  const caminho = data?.media_storage_path as string | null
  if (!caminho) return NextResponse.json({ erro: 'mídia não arquivada' }, { status: 404 })

  const url = await urlAssinada(caminho)
  if (!url) return NextResponse.json({ erro: 'falha ao assinar' }, { status: 502 })
  return NextResponse.redirect(url)
}
```

- [ ] **Step 5: Respostas rápidas**

```ts
// src/app/api/quick-replies/route.ts
import { NextResponse } from 'next/server'
import { db } from '@/server/supabase'
export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await db().from('quick_replies').select('*').order('shortcut')
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const { shortcut, message } = (await req.json()) as { shortcut: string; message: string }
  const { data, error } = await db()
    .from('quick_replies').upsert({ shortcut, message }, { onConflict: 'shortcut' }).select('*').single()
  if (error) return NextResponse.json({ erro: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const { id } = (await req.json()) as { id: string }
  await db().from('quick_replies').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 6: Build**

Rodar: `npm run build`
Esperado: limpo. A rota de mídia só é exercitada de verdade na Task 21, quando um lead mandar uma imagem.

---

### Task 16: Leads, métricas, reativação e templates

**Files:**
- Create: `src/app/api/leads/route.ts`, `src/app/api/leads/[id]/route.ts`, `src/app/api/metrics/route.ts`, `src/app/api/reativacao/route.ts`, `src/app/api/templates/route.ts`, `src/app/api/templates/sync/route.ts`

- [ ] **Step 1: Leads**

```ts
// src/app/api/leads/route.ts
import { NextResponse } from 'next/server'
import { listarLeads } from '@/server/repo/leads'
import type { FiltroLeads } from '@/hooks/useLeads'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams
  const filtro: FiltroLeads = {
    segmento: (p.get('segmento') ?? 'todos') as FiltroLeads['segmento'],
    stage: (p.get('stage') ?? 'todos') as FiltroLeads['stage'],
    planoStatus: (p.get('planoStatus') ?? 'todos') as FiltroLeads['planoStatus'],
    busca: p.get('busca') ?? '',
    pagina: Number(p.get('pagina') ?? '1'),
  }
  return NextResponse.json(await listarLeads(filtro))
}
```

```ts
// src/app/api/leads/[id]/route.ts
import { NextResponse } from 'next/server'
import { mudarEtapaLead } from '@/server/repo/leads'
import type { FunnelStage } from '@/mock/types'
export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { stage } = (await req.json()) as { stage: FunnelStage }
  return NextResponse.json(await mudarEtapaLead(id, stage))
}
```

- [ ] **Step 2: Métricas e reativação — a mesma régua**

```ts
// src/app/api/metrics/route.ts
import { NextResponse } from 'next/server'
import { getMetrics } from '@/lib/regras'
import { todosOsLeads } from '@/server/repo/leads'
export const dynamic = 'force-dynamic'

export async function GET() {
  // `getMetrics` recebe um PACOTE, não só leads: o tipo `Metrics` tem seções de
  // conversas, mensagens, campanhas e agendamentos. Os campos são obrigatórios
  // de propósito — default `[]` produziria dashboard com zeros silenciosos.
  // `ehInativo` continua sendo a mesma régua da Reativação: critério 7.
  const [leads, campanhas, agendamentos] = await Promise.all([
    todosOsLeads(), listarCampanhas(), listarAgendamentos(),
  ])
  const { conversas } = await listarCardsDeConversa()
  const mensagens = await todasAsMensagens()
  return NextResponse.json(
    getMetrics({ leads, conversas, mensagens, campanhas, agendamentos }, new Date())
  )
}

// NOTA: `todasAsMensagens()` e a forma exata de `conversas` esperada por
// `DadosMetrics` precisam ser conferidas contra `src/lib/regras.ts` antes de
// escrever esta rota — o tipo é `Conversa[]` do domínio, não `Conversation[]`
// de fio. Leia `src/lib/regras.ts` e adapte o repositório se necessário.
```

```ts
// src/app/api/reativacao/route.ts
import { NextResponse } from 'next/server'
import { recorteReativacao, type FiltroRecorte } from '@/lib/regras'
import { todosOsLeads } from '@/server/repo/leads'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams
  const filtro: FiltroRecorte = {
    diasSemAcesso: p.get('diasSemAcesso') ? Number(p.get('diasSemAcesso')) : undefined,
    segmento: (p.get('segmento') ?? undefined) as FiltroRecorte['segmento'],
    planoStatus: (p.get('planoStatus') ?? undefined) as FiltroRecorte['planoStatus'],
  }
  const leads = recorteReativacao(await todosOsLeads(), filtro, new Date())
  return NextResponse.json({ leads: leads.slice(0, 10), total: leads.length })
}
```

Se `FiltroRecorte` tiver outros campos, espelhe-os aqui — leia `src/lib/regras.ts` antes de escrever.

- [ ] **Step 3: Templates**

```ts
// src/app/api/templates/route.ts
import { NextResponse } from 'next/server'
import { validarTemplate, type RascunhoTemplate } from '@/lib/templates'
import { criarTemplateNaMeta, MetaError } from '@/server/meta/client'
import { listarTemplates } from '@/server/repo/templates'
import { db } from '@/server/supabase'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(await listarTemplates())
}

export async function POST(req: Request) {
  const rascunho = (await req.json()) as RascunhoTemplate

  // Validação LOCAL antes da Meta: é o que impede o 132018. Spec §7.1.
  const erros = validarTemplate(rascunho)
  if (erros.length > 0) return NextResponse.json({ erros }, { status: 422 })

  const componentes: Record<string, unknown>[] = []
  if (rascunho.cabecalho) {
    componentes.push({ type: 'HEADER', format: 'TEXT', text: rascunho.cabecalho })
  }
  componentes.push({
    type: 'BODY',
    text: rascunho.corpo,
    ...(rascunho.exemplos.length > 0 ? { example: { body_text: [rascunho.exemplos] } } : {}),
  })
  if (rascunho.rodape) componentes.push({ type: 'FOOTER', text: rascunho.rodape })
  if (rascunho.botoes.length > 0) {
    componentes.push({
      type: 'BUTTONS',
      buttons: rascunho.botoes.map((b) =>
        b.tipo === 'URL' ? { type: 'URL', text: b.texto, url: b.url }
        : b.tipo === 'PHONE_NUMBER' ? { type: 'PHONE_NUMBER', text: b.texto, phone_number: b.telefone }
        : { type: 'QUICK_REPLY', text: b.texto }
      ),
    })
  }

  try {
    const criado = await criarTemplateNaMeta({
      name: rascunho.nome,
      language: rascunho.idioma,
      category: rascunho.categoria,
      components: componentes,
    })
    await db().from('templates').upsert({
      nome: rascunho.nome, meta_id: criado.id, categoria: rascunho.categoria,
      idioma: rascunho.idioma, corpo: rascunho.corpo, componentes,
      botoes: rascunho.botoes.map((b) => b.texto), status: 'pendente',
    }, { onConflict: 'nome' })
    return NextResponse.json({ ok: true, meta_id: criado.id })
  } catch (e) {
    if (e instanceof MetaError) {
      return NextResponse.json({ erros: [`Meta ${e.codigo}: ${e.detalhe}`] }, { status: 422 })
    }
    throw e
  }
}
```

```ts
// src/app/api/templates/sync/route.ts
import { NextResponse } from 'next/server'
import { sincronizarTemplates } from '@/server/repo/templates'
export const dynamic = 'force-dynamic'
export async function POST() {
  return NextResponse.json({ sincronizados: await sincronizarTemplates() })
}
```

- [ ] **Step 4: Build**

Rodar: `npm run build`
Esperado: limpo.

---

### Task 17: Campanhas e o worker da fila

**Files:**
- Create: `src/app/api/campanhas/route.ts`, `src/app/api/fila/processar/route.ts`, `src/app/api/agendamentos/route.ts`

- [ ] **Step 1: Campanhas**

```ts
// src/app/api/campanhas/route.ts
import { NextResponse } from 'next/server'
import { recorteReativacao, type FiltroRecorte } from '@/lib/regras'
import { criarCampanha, listarCampanhas } from '@/server/repo/campanhas'
import { todosOsLeads } from '@/server/repo/leads'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(await listarCampanhas())
}

export async function POST(req: Request) {
  const { nome, template, filtro, variaveisPorLead } = (await req.json()) as {
    nome: string; template: string; filtro: FiltroRecorte
    /** Nomes de campo do lead que preenchem {{1}}, {{2}}… Ex.: ['nome']. */
    variaveisPorLead: ('nome' | 'cidade' | 'diasSemAcesso')[]
  }

  const leads = recorteReativacao(await todosOsLeads(), filtro, new Date())
  const agora = new Date()

  const comVariaveis = leads.map((l) => ({
    id: l.id,
    variaveis: variaveisPorLead.map((campo) => {
      if (campo === 'nome') return l.nome.split(' ')[0]
      if (campo === 'cidade') return l.cidade
      const base = l.ultimoAcessoEm ? new Date(l.ultimoAcessoEm).getTime() : agora.getTime()
      return String(Math.floor((agora.getTime() - base) / 86_400_000))
    }),
  }))

  const r = await criarCampanha({
    nome, template, segmentoAlvo: filtro.segmento ?? 'todos', leads: comVariaveis,
  })
  return NextResponse.json(r)
}
```

- [ ] **Step 2: O worker**

```ts
// src/app/api/fila/processar/route.ts
// Worker do disparo. Spec §7.2 e §7.3.
import { NextResponse } from 'next/server'
import { parametrosDoTemplate, type RascunhoTemplate } from '@/lib/templates'
import { env } from '@/server/env'
import { enviarTemplate, MetaError } from '@/server/meta/client'
import {
  devolverAFila, marcarAgendamentoEnviado, marcarAgendamentoFalho, reservarAgendamentos,
} from '@/server/repo/campanhas'
import { buscarLead } from '@/server/repo/leads'
import { conversasIniciadasEm24h, inserirMensagem } from '@/server/repo/mensagens'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const LOTE = 20

export async function POST(req: Request) {
  if (req.headers.get('x-cron-secret') !== env.cronSecret) {
    return NextResponse.json({ erro: 'não autorizado' }, { status: 401 })
  }

  // Teto de conversas iniciadas por 24h. Estourar devolve 131049 e queima a
  // qualidade do número — melhor parar e reagendar. Spec §7.3.
  const jaIniciadas = await conversasIniciadasEm24h()
  const folga = env.limiteDiario - jaIniciadas
  if (folga <= 0) {
    return NextResponse.json({ enviados: 0, motivo: 'teto_diario', jaIniciadas, teto: env.limiteDiario })
  }

  const reservados = await reservarAgendamentos(Math.min(LOTE, folga))
  let enviados = 0
  let falhas = 0

  for (const a of reservados) {
    try {
      const lead = await buscarLead(a.lead_id)
      if (!lead) {
        await marcarAgendamentoFalho(a.id, a.tentativas, 'lead inexistente')
        falhas += 1
        continue
      }

      const variaveis = Array.isArray(a.variaveis) ? a.variaveis : []
      // O rascunho aqui serve só para `parametrosDoTemplate` decidir os
      // componentes; botões vazios significam "sem parâmetro de botão".
      const rascunho = { botoes: [] } as unknown as RascunhoTemplate
      const componentes = parametrosDoTemplate(rascunho, variaveis)

      const resposta = await enviarTemplate(lead.telefone, a.template, componentes)
      const wamid = resposta.messages[0]?.id ?? null

      await inserirMensagem({
        message_id: wamid,
        lead_id: lead.id,
        phone: lead.telefone,
        phone_id: env.phoneNumberId,
        message_type: 'template',
        content: a.template,
        direction: 'outbound',
        created_at: new Date().toISOString(),
        status: 'enviado',
        campanha_id: a.campanha_id,
      })
      await marcarAgendamentoEnviado(a.id, wamid ?? '')
      enviados += 1
    } catch (e) {
      const detalhe = e instanceof MetaError ? `${e.codigo}: ${e.detalhe}` : String(e)
      // 131049 e 130472 são o teto da própria Meta batendo. Não é falha do
      // lead: devolve à fila sem gastar tentativa, e para o lote aqui.
      if (e instanceof MetaError && (e.codigo === 131049 || e.codigo === 130472)) {
        const restantes = reservados.slice(reservados.indexOf(a)).map((r) => r.id)
        await devolverAFila(restantes, new Date(Date.now() + 60 * 60_000).toISOString())
        return NextResponse.json({ enviados, falhas, motivo: 'teto_da_meta', devolvidos: restantes.length })
      }
      await marcarAgendamentoFalho(a.id, a.tentativas, detalhe)
      falhas += 1
    }
  }

  return NextResponse.json({ enviados, falhas, reservados: reservados.length })
}
```

```ts
// src/app/api/agendamentos/route.ts
import { NextResponse } from 'next/server'
import { cancelarAgendamento, listarAgendamentos } from '@/server/repo/campanhas'
export const dynamic = 'force-dynamic'
export async function GET() { return NextResponse.json(await listarAgendamentos()) }
export async function DELETE(req: Request) {
  const { id } = (await req.json()) as { id: string }
  await cancelarAgendamento(id)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Provar que o segredo protege**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/fila/processar
```
Esperado: **401**.

- [ ] **Step 4: Provar que duas execuções simultâneas não duplicam (critério 8)**

Com agendamentos pendentes na fila, disparar duas chamadas ao mesmo tempo:

```bash
for i in 1 2; do curl -s -X POST http://localhost:3000/api/fila/processar -H "x-cron-secret: $CRON_SECRET" & done; wait
```
Depois, no SQL Editor:
```sql
select lead_id, count(*) from agendamentos
 where status = 'enviado' group by lead_id having count(*) > 1;
```
Esperado: **nenhuma linha.** `for update skip locked` fez seu trabalho.

---

## Onda E — frontend e ponta a ponta

### Task 18: Hooks trocam o `queryFn`

**Files:**
- Modify: `src/hooks/useLeads.ts`, `useConversations.ts`, `useConversationMessages.ts`, `useMetrics.ts`, `useReativacaoRecorte.ts`, `useCampanhas.ts`, `useAgendamentos.ts`, `useTemplates.ts`, `useMessageSender.ts`
- Create: `src/lib/api.ts`

- [ ] **Step 1: Helper de fetch**

```ts
// src/lib/api.ts
// Cliente HTTP do painel. Erro do servidor vira Error com a mensagem que a
// rota mandou — a tela precisa dela para mostrar "janela fechada".
export async function api<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(caminho, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    const corpo = json as { mensagem?: string; erro?: string; erros?: string[] }
    throw new Error(corpo.mensagem ?? corpo.erros?.join(' ') ?? corpo.erro ?? `HTTP ${resp.status}`)
  }
  return json as T
}
```

- [ ] **Step 2: Trocar cada `queryFn`, sem mexer no resto**

Regra desta tarefa: **só o `queryFn`, o `mutationFn` e o `refetchInterval` mudam.** Chaves de cache, tipos de retorno e as assinaturas dos hooks ficam idênticos — é o que mantém as telas intocadas.

Em `useLeads.ts`, trocar `queryFn: () => consultar(filtro)` por:

```ts
    queryFn: () =>
      api<Omit<PaginaDeLeads, 'carregando'>>(
        `/api/leads?${new URLSearchParams({
          segmento: filtro.segmento ?? 'todos',
          stage: filtro.stage ?? 'todos',
          planoStatus: filtro.planoStatus ?? 'todos',
          busca: filtro.busca?.trim() ?? '',
          pagina: String(filtro.pagina ?? 1),
        })}`
      ),
    placeholderData: (anterior) => anterior,
```

Remover o `initialData` (que chamava o store) e as funções `consultar`/`normalizar` do arquivo. `placeholderData` mantém a página anterior visível enquanto a nova carrega, que é o efeito que o `initialData` produzia.

Em `useConversations.ts`, acrescentar o polling da spec §3.3:

```ts
    queryFn: () => api<ListaConversas>('/api/conversas'),
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
```

Em `useConversationMessages.ts`:

```ts
    queryFn: () => api<MensagemUI[]>(`/api/conversas/${encodeURIComponent(conv!.key)}/mensagens`),
    refetchInterval: 3_000,
    refetchIntervalInBackground: false,
```

Em `useMetrics.ts`: `queryFn: () => api<Metrics>('/api/metrics')`.
Em `useCampanhas.ts`: `queryFn: () => api<Campanha[]>('/api/campanhas')`.
Em `useAgendamentos.ts`: `queryFn: () => api<Agendamento[]>('/api/agendamentos')`.
Em `useTemplates.ts`: `queryFn: () => api<Template[]>('/api/templates')`.
Em `useReativacaoRecorte.ts`: `queryFn: () => api<{leads: Lead[]; total: number}>('/api/reativacao?' + …)`.

- [ ] **Step 3: `useMessageSender` trata o 409**

Trocar a chamada ao store por `api('/api/mensagens', { method: 'POST', body: … })`, e **remover a progressão simulada `PROGRESSAO`** — o status agora vem do webhook, não de um `setTimeout`. Quando o `api()` lançar, pôr a mensagem em `sendError`; a tela já mostra esse estado.

- [ ] **Step 4: Conferir que nenhuma tela importa mais o store**

Rodar: `grep -rn "mock/store" src/components src/hooks src/app`
Esperado: **nenhuma saída.**

- [ ] **Step 5: Build e testes**

Rodar: `npm run build && npm run lint && npm test`
Esperado: os três limpos.

---

### Task 19: Aba de templates

**Files:**
- Create: `src/components/Templates.tsx`
- Modify: `src/lib/tabs.ts`, `src/app/(app)/page.tsx`, `src/components/Sidebar.tsx`, `src/lib/tabs.test.ts`

- [ ] **Step 1: Registrar a décima aba nos três lugares**

O CLAUDE.md exige que os três mudem juntos. Em `src/lib/tabs.ts`, acrescentar `'templates'` a `ACTIVE_TABS` **depois de `'disparos'`** (é onde o operador procura). Atualizar o comentário do topo, que diz "nove superfícies". Em `src/app/(app)/page.tsx`, acrescentar o `case 'templates'`. Em `src/components/Sidebar.tsx`, o rótulo "Templates" e um ícone do `lucide-react` coerente com os vizinhos.

- [ ] **Step 2: Ajustar o teste de abas**

`src/lib/tabs.test.ts` provavelmente afirma o tamanho da lista. Rodar `npm test -- src/lib/tabs.test.ts`, ver o que quebra, e atualizar o número de 9 para 10 — **só isso**.

- [ ] **Step 3: A tela**

`src/components/Templates.tsx`: lista os templates de `useTemplates()` com `status-label.tsx` para aprovado/pendente/rejeitado (cinza + ícone + rótulo, **nunca cor** — DESIGN.md), e um formulário de criação que chama `validarTemplate()` a cada tecla e só habilita o envio com zero erros.

Regras de estilo que não são negociáveis, do CLAUDE.md:
- Zero literal de cor, raio, espaçamento ou tamanho de fonte no JSX — só tokens e as classes `t-*`.
- Pílula 999px em todo elemento interativo; alvo de toque de 44px.
- Títulos em sentence-case.
- O CTA primário **não** é ouro.
- `@base-ui/react`: **não existe `asChild`**, use `render={<elemento />}`.

Reusar o frame de telefone que `src/components/Disparos.tsx` já desenha para a prévia — ler aquele arquivo antes e extrair o componente se ele estiver embutido.

- [ ] **Step 4: Build**

Rodar: `npm run build && npm run lint`
Esperado: limpos. Abrir `http://localhost:3000/?tab=templates` e conferir a aba nos **dois temas**.

---

### Task 20: Seed do banco

**Files:**
- Create: `scripts/seed.ts`
- Modify: `package.json`

- [ ] **Step 1: Escrever o seed**

```ts
// scripts/seed.ts
// Carrega o dataset fictício de `src/mock/db.ts` no banco. É desenvolvimento e
// homologação — a base real dos 612 é B5, outra spec.
// Rodar: npm run seed
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { LEADS, QUICK_REPLIES, TEMPLATES } from '../src/mock/db'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

async function main() {
  const linhas = LEADS.map((l) => ({
    nome: l.nome, telefone: l.telefone, email: l.email, segmento: l.segmento,
    stage: l.stage, plano_status: l.planoStatus, plano_valor: l.planoValor,
    ultimo_acesso_em: l.ultimoAcessoEm, primeiro_contato_em: l.primeiroContatoEm,
    ultima_interacao_em: l.ultimaInteracaoEm, cidade: l.cidade, tags: l.tags, notas: l.notas,
  }))

  let inseridos = 0
  for (let i = 0; i < linhas.length; i += 500) {
    // ignoreDuplicates: rodar o seed duas vezes não duplica — o unique de
    // tel_norm barra, e telefones fictícios repetidos são simplesmente pulados.
    const { data, error } = await db.from('leads')
      .upsert(linhas.slice(i, i + 500), { onConflict: 'tel_norm', ignoreDuplicates: true })
      .select('id')
    if (error) throw error
    inseridos += data?.length ?? 0
  }

  await db.from('quick_replies').upsert(
    QUICK_REPLIES.map((q) => ({ shortcut: q.shortcut, message: q.message })),
    { onConflict: 'shortcut' }
  )
  await db.from('templates').upsert(
    TEMPLATES.map((t) => ({
      nome: t.nome, categoria: t.categoria, idioma: t.idioma, corpo: t.corpo,
      botoes: t.botoes, status: t.status,
    })),
    { onConflict: 'nome' }
  )

  const { count } = await db.from('leads').select('id', { count: 'exact', head: true })
  console.log(`leads inseridos nesta rodada: ${inseridos}`)
  console.log(`total de leads no banco: ${count}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: Registrar o script**

Em `package.json`, acrescentar a `scripts`: `"seed": "tsx scripts/seed.ts"`.

- [ ] **Step 3: Rodar**

Rodar: `npm run seed`
Esperado: imprime o total. Rodar **de novo** e conferir que o total **não muda** — o seed é idempotente.

- [ ] **Step 4: Provar o critério de aceitação 7**

Com `npm run dev` no ar:

```bash
curl -s http://localhost:3000/api/metrics | head -c 400
curl -s "http://localhost:3000/api/reativacao?diasSemAcesso=30"
```
Esperado: o total de inativos das métricas e o `total` do recorte de 30 dias são **o mesmo número**. Se divergirem, alguém deixou de chamar `ehInativo` — conserte antes de seguir.

---

### Task 21: Ligar o webhook e provar de ponta a ponta

Esta é a tarefa que depende dos bloqueios da spec §9. As anteriores não.

**Files:** nenhum. É operação.

- [ ] **Step 1: Expor o localhost**

Rodar: `npx cloudflared tunnel --url http://localhost:3000`
Esperado: imprime uma URL `https://<algo>.trycloudflare.com`. Anotar.

- [ ] **Step 2: Cadastrar o webhook na Meta**

No painel do app `2874700529566559` → WhatsApp → Configuração → Webhook:
- Callback URL: `https://<algo>.trycloudflare.com/api/webhook`
- Verify token: `vistra_artha_2026`
- Assinar o campo **`messages`**.

Esperado: a Meta valida (é o `GET` da Task 14) e marca verificado.

- [ ] **Step 3: Inscrever a WABA**

```bash
curl -s -X POST "https://graph.facebook.com/v21.0/1440374588143232/subscribed_apps" \
  -H "Authorization: Bearer $WHATSAPP_ACCESS_TOKEN"
curl -s "https://graph.facebook.com/v21.0/1440374588143232/subscribed_apps" \
  -H "Authorization: Bearer $WHATSAPP_ACCESS_TOKEN"
```
Esperado: `{"success":true}` e depois um `data` **não vazio** — hoje ele está vazio.

- [ ] **Step 4: Criar o template real de reativação**

Pela aba de Templates (Task 19). Sugestão de corpo, na voz institucional do CLAUDE.md — **sem nome de persona**:

> Oi, {{1}}. Aqui é da Artha. Vimos que faz um tempo que você não acompanha seu planejamento financeiro por aqui. Quer retomar de onde parou?

Categoria `MARKETING`, um exemplo (`Rafael`), botões de resposta rápida "Quero retomar" e "Agora não".
Esperado: a Meta aceita, o template nasce `pendente`. A aprovação leva de minutos a 24h.

- [ ] **Step 5: O teste de ponta a ponta (critério de aceitação 10)**

Com o template aprovado, criar uma campanha de **um** lead — o número `5534988861441` — e rodar o worker:

```bash
curl -s -X POST http://localhost:3000/api/fila/processar -H "x-cron-secret: $CRON_SECRET"
```

Verificar, na ordem:
1. A mensagem chega no WhatsApp do número de teste.
2. Responder por lá.
3. **Em até 5s** o card aparece na tela de Conversas (é o polling de §3.3).
4. O lead do card é o certo — o nono dígito foi reconciliado (`tel_norm = 34988861441`), não nasceu lead duplicado.
5. Responder pelo painel: a mensagem sai, porque a janela de 24h abriu com o inbound.
6. A bolha caminha `enviado → entregue → lido` conforme os callbacks chegam.

Esperado: os seis. **Este é o critério que declara o recorte pronto.**

- [ ] **Step 6: Fechar a documentação**

Atualizar `TREE.md` (a árvore mudou muito: `src/server/`, `src/app/api/`, `supabase/`, `scripts/`) e `ROADMAP.md` (marcar B1+B2+B3 e mover para "NA FILA" os itens B4 e B5, mais o Realtime da §3.3 e a rotação do token da §8).

---

## Verificação final do recorte

Rodar, nesta ordem, e conferir cada saída:

```bash
npm run lint
npm test
npm run build
```

Depois percorrer os dez critérios de aceitação da spec §10 e marcar cada um. Os
critérios 1–9 não dependem de bloqueio nenhum. O 10 depende dos bloqueios 1–4 da
spec §9.
