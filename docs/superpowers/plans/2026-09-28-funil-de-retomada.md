# Funil de retomada — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o quick reply do template de disparo rotear o bot, entregar a
oferta de isenção de R$100 e respeitar opt-out, para o lote de 12 leads de
`trial_expirado-com-open-finance.xlsx`.

**Architecture:** Duas portas, um motor. Quem chega por disparo entra pelo ramo
`rtv:` — os botões do template **são** a primeira pergunta, e o payload do quick
reply é resolvido no envio, a partir do nome do template. Quem escreve
espontaneamente continua no `P1` de hoje, intocado. `estado.ts` ganha um portão
antes do de primeiro contato; `roteiro.ts` continua sendo dado puro sem decisão.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Vitest, Supabase Postgres
via PostgREST, WhatsApp Cloud API.

**Spec:** `docs/superpowers/specs/2026-09-26-funil-de-retomada-design.md`

---

## Como rodar teste neste projeto

O gestor não quer a máquina travada. **Durante as tarefas, rode só o arquivo de
teste da tarefa:**

```bash
npx vitest run src/lib/bot/roteiro.test.ts
```

`npm test` (suíte inteira) e `npm run build` rodam **uma vez só**, na Tarefa 10.
Não repita antes disso.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Tarefa |
| --- | --- | --- |
| `src/lib/bot/roteiro.ts` | dado do ramo `rtv:`: ids, títulos, respostas, tags, nome do template | T1 |
| `src/lib/bot/roteiro.test.ts` | trava copy, limites e cobertura dos ids | T1 |
| `supabase/migrations/0003_optout.sql` | coluna `leads.optout_em` | T2 |
| `src/mock/types.ts` | `Lead.optoutEm` | T2 |
| `src/lib/regras.ts` | `podeDisparar` recusa opt-out | T2 |
| `src/lib/regras.test.ts` | trava a recusa | T2 |
| `scripts/importar-leads.ts` | CSV → `leads`, com recusados impressos | T3 |
| `src/lib/templates.ts` | `ComponenteEnvio` com `quick_reply`; `componentesDeBotao` | T4 |
| `src/lib/templates.test.ts` | trava a convenção de nome e a ordem dos índices | T4 |
| `src/lib/bot/estado.ts` | portão de campanha antes do de primeiro contato | T5 |
| `src/lib/bot/estado.test.ts` | prova §3.2 da spec consertada | T5 |
| `src/server/repo/leads.ts` | lê `optout_em`; `marcarOptout`; `qualificarLead` aceita `qualificar` | T6 |
| `src/server/fila.ts` | concatena `componentesDeBotao` ao `body` | T7 |
| `src/server/bot/executar.ts` | `marcarOptout` antes do envio; qualifica os terminais `rtv` | T8 |
| `scripts/criar-template.ts` | submete `mkt_rtv_isencao_01` à Meta | T9 |
| `ROADMAP.md`, `CLAUDE.md` | estado real e a decisão de persona | T10 |

### Ondas e escopo disjunto

Regra do `CLAUDE.md` §5: agentes simultâneos nunca dividem arquivo. As ondas
abaixo respeitam isso, e **nenhuma tarefa da mesma onda toca o mesmo arquivo**.

| Onda | Tarefas em paralelo | Depende de |
| --- | --- | --- |
| 1 | **T1**, **T2**, **T3** | — |
| 2 | **T4**, **T5**, **T6** | T4/T5 ← T1 · T6 ← T2 |
| 3 | **T7**, **T8**, **T9** | T7 ← T4 · T8 ← T1,T6 · T9 ← T1 |
| 4 | **T10** | tudo |

---

## Consequência aceita, registrada de propósito

Depois do opt-out, a conversa **continua aparecendo na fila de atendimento** do
Dashboard. `esperandoResposta(direcao, enviadoPor)` devolve true para toda
mensagem do bot, e a confirmação do `rtv:sair` é mensagem do bot.

Não é consertado aqui. Consertar exigiria mexer em `filaAtendimento` dentro de
`src/lib/regras.ts`, que é régua compartilhada por três telas, para melhorar no
máximo 1 card de 12 num lote de teste. O gestor vê o texto "não quero receber"
no card e fecha na mão. Revisitar quando a base inteira for.

---

## Tarefa 1 — Ramo `rtv:` em `roteiro.ts`

**Files:**
- Modify: `src/lib/bot/roteiro.ts`
- Test: `src/lib/bot/roteiro.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Acrescente ao final de `src/lib/bot/roteiro.test.ts`:

```ts
describe('ramo rtv (campanha de retomada)', () => {
  it('todo id de RTV_IDS tem resposta própria', () => {
    for (const id of RTV_IDS) {
      expect(RESPOSTA_POR_ID[id], `sem resposta para ${id}`).toBeTruthy()
    }
  })

  it('todo id de RTV_IDS tem tag', () => {
    for (const id of RTV_IDS) {
      expect(TAG_POR_RESPOSTA[id], `sem tag para ${id}`).toBeTruthy()
    }
  })

  it('os títulos cabem no limite da Cloud API', () => {
    expect(RTV_BOTOES).toHaveLength(MAX_BOTOES)
    for (const b of RTV_BOTOES) {
      expect(b.titulo.length, `"${b.titulo}" passa de ${MAX_TITULO}`).toBeLessThanOrEqual(MAX_TITULO)
    }
  })

  it('a ordem dos botões é a ordem dos índices do template', () => {
    expect(RTV_BOTOES.map((b) => b.id)).toEqual(['rtv:voltar', 'rtv:problema', 'rtv:sair'])
  })

  it('ehIdRtv reconhece só os ids do ramo', () => {
    expect(ehIdRtv('rtv:voltar')).toBe(true)
    expect(ehIdRtv('p1:artha')).toBe(false)
    expect(ehIdRtv(null)).toBe(false)
  })

  it('ehIdConhecido passa a incluir o ramo rtv', () => {
    expect(ehIdConhecido('rtv:sair')).toBe(true)
  })

  it('mensagemTerminal resolve um id rtv pelo idP1', () => {
    expect(mensagemTerminal('rtv:voltar', null)).toBe(RESPOSTA_POR_ID['rtv:voltar'])
  })

  it('o corpo do template não abre nem fecha em variável', () => {
    const corpo = TEMPLATE_RTV.corpo.trim()
    expect(corpo.startsWith('{{')).toBe(false)
    expect(corpo.endsWith('}}')).toBe(false)
  })

  it('o corpo do template tem exatamente uma variável, com um exemplo', () => {
    expect(TEMPLATE_RTV.corpo.match(/\{\{\d+\}\}/g)).toHaveLength(1)
    expect(TEMPLATE_RTV.exemplos).toHaveLength(1)
  })

  it('nenhuma copy do ramo cita nome de persona', () => {
    const textos = [TEMPLATE_RTV.corpo, ...RTV_IDS.map((id) => RESPOSTA_POR_ID[id])]
    for (const t of textos) {
      expect(t).not.toMatch(/L[úu]cia|Clara|LucIA/i)
    }
  })

  it('a copy do ramo segue as regras de escrita do gestor', () => {
    const textos = [TEMPLATE_RTV.corpo, ...RTV_IDS.map((id) => RESPOSTA_POR_ID[id])]
    for (const t of textos) {
      expect(t, 'sem travessão').not.toMatch(/—/)
      expect(t, 'sem markdown').not.toMatch(/\*|_{2}|#/)
      // Link sozinho na linha.
      for (const linha of t.split('\n')) {
        if (linha.includes('http')) expect(linha.trim()).toMatch(/^https?:\/\/\S+$/)
      }
    }
  })
})
```

Acrescente ao `import` do topo do arquivo, na lista que já existe:
`RTV_IDS`, `RTV_BOTOES`, `TEMPLATE_RTV`, `ehIdRtv`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/bot/roteiro.test.ts`
Expected: FAIL — `No "RTV_IDS" export is defined on the module`.

- [ ] **Step 3: Implementar**

Em `src/lib/bot/roteiro.ts`, acrescente **depois** de `P2_POR_RAMO` e **antes**
de `RESPOSTA_POR_ID`:

```ts
// ---------------------------------------------------------------------------
// Ramo de campanha. Spec 2026-09-26 §4.
//
// A porta de campanha não tem P1. Os três botões do template SÃO a primeira
// pergunta, e quem aperta já respondeu — perguntar "o que você procura" depois
// disso gasta o turno mais quente do disparo com o que a planilha já responde.
//
// A coorte é 100% Artha B2C, trial expirado, com pelo menos um banco conectado.
// Não há o que segmentar.
// ---------------------------------------------------------------------------

/** Prefixo dos templates que recebem os payloads deste ramo. Spec §5.3. */
export const PREFIXO_TEMPLATE_RTV = 'mkt_rtv'

/**
 * Os botões, NA ORDEM DOS ÍNDICES do template. A ordem é contrato: o payload do
 * quick reply é casado por índice no envio, então trocar duas linhas aqui manda
 * "quero voltar" para quem pediu para sair.
 */
export const RTV_BOTOES: Botao[] = [
  { id: 'rtv:voltar', titulo: 'Quero voltar' },
  { id: 'rtv:problema', titulo: 'Tive um problema' },
  { id: 'rtv:sair', titulo: 'Não quero receber' },
]

export const RTV_IDS = RTV_BOTOES.map((b) => b.id)

/** O terminal que desliga o lead de todo disparo futuro. */
export const ID_OPTOUT = 'rtv:sair'

/**
 * O rascunho submetido à Meta. Mora aqui, junto dos botões, porque o título do
 * botão aparece em dois lugares — no template aprovado e no payload do envio — e
 * os dois têm de ser o mesmo dado. Fontes separadas divergem em silêncio.
 *
 * O CORPO NÃO ABRE NA VARIÁVEL. A validação da Meta recusa corpo que começa ou
 * termina em parâmetro. Custa três caracteres e evita rejeição depois de
 * submeter. Spec §4.1.
 *
 * A OFERTA VAI NO CORPO, não atrás do botão. Decisão do gestor em 2026-09-26: é
 * verdade, não insinua arquivamento que não vai acontecer, e a impressão do
 * template de marketing é o que se paga — quem não apertar nada precisa ter
 * visto a oferta.
 *
 * ISENÇÃO É FATO COMERCIAL, NÃO COPY, e pior que o preço: preço está publicado
 * em https://artha.ia.br e dá para conferir, a isenção de R$100 não está
 * publicada em lugar nenhum. Se o cliente mudar a oferta, esta string muda à
 * mão. Ver spec §6.1.
 */
export const TEMPLATE_RTV = {
  nome: 'mkt_rtv_isencao_01',
  categoria: 'MARKETING' as const,
  idioma: 'pt_BR' as const,
  cabecalho: null,
  corpo: [
    'Oi, {{1}}. Você conectou seu banco no Artha e parou no meio do caminho.',
    '',
    'Sua conta continua aqui, do jeito que você deixou.',
    '',
    'E a taxa de adesão de R$100 a gente tirou pra você voltar. O primeiro mês sai R$97, não R$197. Você conecta todos os seus bancos e testa por um mês, com a nossa ajuda.',
    '',
    'Reconectar leva 2 minutos.',
  ].join('\n'),
  exemplos: ['João'],
  rodape: null,
  botoes: RTV_BOTOES.map((b) => ({ tipo: 'QUICK_REPLY' as const, texto: b.titulo })),
}

const IDS_RTV = new Set(RTV_IDS)

export function ehIdRtv(id: string | null): boolean {
  return id !== null && IDS_RTV.has(id)
}
```

Acrescente as três respostas dentro de `RESPOSTA_POR_ID`, depois de
`'p2:dhana_como'`:

```ts
  // O bot NÃO afirma que a isenção já está aplicada. Não existe mecanismo de
  // cupom confirmado pelo cliente — ele disse "podemos oferecer", que é
  // intenção. O bot promete atendimento, que é coisa que a operação controla.
  // Spec §6.1.
  'rtv:voltar':
    'Boa. Já passei para a equipe da Artha, que libera a isenção e te acompanha na hora de conectar os bancos.\n\n' +
    'Se quiser ir olhando, a plataforma é essa.\n\n' +
    'https://artha.ia.br',

  'rtv:problema':
    'Me conta o que travou. Pode escrever aqui mesmo.\n\n' +
    'Alguém da Artha lê e te responde ainda hoje.',

  'rtv:sair': 'Certo, não te mandamos mais nada por aqui. Obrigado pelo seu tempo.',
```

Acrescente as três tags dentro de `TAG_POR_RESPOSTA`:

```ts
  'rtv:voltar': 'rtv-quer-voltar',
  'rtv:problema': 'rtv-teve-problema',
  'rtv:sair': 'rtv-optout',
```

Troque o corpo de `ehIdConhecido`:

```ts
/** Um id que o roteiro não conhece veio de campanha antiga ou de roteiro trocado. */
export function ehIdConhecido(id: string | null): boolean {
  return ehIdP1(id) || ehIdP2(id) || ehIdRtv(id)
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/bot/roteiro.test.ts`
Expected: PASS, todos os testes do arquivo.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot/roteiro.ts src/lib/bot/roteiro.test.ts
git commit -m "Ramo rtv no roteiro: os botoes do template viram a primeira pergunta"
```

---

## Tarefa 2 — Opt-out na régua

**Files:**
- Create: `supabase/migrations/0003_optout.sql`
- Modify: `src/mock/types.ts`
- Modify: `src/lib/regras.ts`
- Test: `src/lib/regras.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

O arquivo já tem o helper `lead(extra: Partial<Lead>)`. **Use ele** — não crie
outro. Primeiro acrescente `recorteReativacao` ao import de `./regras`, que hoje
traz só `esperandoResposta, getMetrics, podeDisparar, type DadosMetrics`:

```ts
import {
  esperandoResposta,
  getMetrics,
  podeDisparar,
  recorteReativacao,
  type DadosMetrics,
} from './regras'
```

Depois acrescente ao final do arquivo:

```ts
describe('opt-out', () => {
  it('podeDisparar recusa lead que pediu para sair', () => {
    expect(podeDisparar(lead({ ficticio: false, optoutEm: '2026-09-27T10:00:00.000Z' }))).toBe(false)
  })

  it('podeDisparar aceita lead sem opt-out', () => {
    expect(podeDisparar(lead({ ficticio: false, optoutEm: null }))).toBe(true)
  })

  it('lead sem a propriedade optoutEm continua podendo receber', () => {
    // Lead vindo de select antigo, ou do mock, chega sem a chave. Ausente não
    // pode virar opt-out: silenciaria a base inteira de uma vez. É o mesmo
    // raciocínio do teste de `ficticio` ausente logo acima.
    expect(podeDisparar(lead({ ficticio: false }))).toBe(true)
  })

  it('recorteReativacao não devolve lead com opt-out', () => {
    const agora = new Date('2026-09-27T12:00:00.000Z')
    const leads = [
      lead({ id: 'op1', planoStatus: 'trial_expirado', ultimoAcessoEm: null, optoutEm: '2026-09-27T10:00:00.000Z' }),
      lead({ id: 'op2', planoStatus: 'trial_expirado', ultimoAcessoEm: null, optoutEm: null }),
    ].filter(podeDisparar)
    const r = recorteReativacao(leads, { planoStatus: 'trial_expirado' }, agora)
    expect(r.map((l) => l.id)).toEqual(['op2'])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/regras.test.ts`
Expected: FAIL — `expected true to be false` no primeiro teste.

- [ ] **Step 3: Implementar**

Crie `supabase/migrations/0003_optout.sql`:

```sql
-- supabase/migrations/0003_optout.sql
-- Opt-out do disparo. Spec 2026-09-26 §5.4.
--
-- COLUNA, NÃO TAG. `tags` é reescrita por qualquer `qualificarLead` e se perde
-- em silêncio. Opt-out perdido é template de marketing para quem pediu para
-- parar: violação de política da Meta, e é a reputação do número que paga.
--
-- Guarda QUANDO, não um booleano: é o que se apresenta se alguém reclamar.
alter table leads add column if not exists optout_em timestamptz;
```

Em `src/mock/types.ts`, dentro de `Lead`, logo abaixo de `ficticio`:

```ts
  /**
   * Quando o lead pediu para não receber mais disparo. `null`/ausente = nunca
   * pediu. OPCIONAL de propósito: `src/mock/db.ts` constrói 760 leads sem esta
   * chave, e torná-la obrigatória quebraria o dataset inteiro por uma coluna
   * que só o motor de disparo lê.
   */
  optoutEm?: string | null
```

Em `src/lib/regras.ts`, troque `podeDisparar`:

```ts
/**
 * Quem o motor de disparo aceita. Régua única: checada na montagem do recorte
 * em `/api/campanhas` E de novo dentro do worker, imediatamente antes da
 * chamada à Meta.
 *
 * As duas checagens são de valor ausente-ou-falso, não `=== null`. Um lead que
 * chegue de um `select` sem a coluna traz `undefined`, e comparação estrita
 * transformaria isso em "pode disparar" para `optoutEm` — que é o lado errado
 * de errar. É o mesmo motivo que `ficticio` usa `!== true`.
 */
export function podeDisparar(lead: Lead): boolean {
  return lead.ficticio !== true && !lead.optoutEm
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/regras.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0003_optout.sql src/mock/types.ts src/lib/regras.ts src/lib/regras.test.ts
git commit -m "Opt-out vira coluna, e podeDisparar recusa quem pediu para sair"
```

---

## Tarefa 3 — Importador dos leads

**Files:**
- Create: `scripts/importar-leads.ts`
- Modify: `package.json` (um script)

Não há teste automatizado: o Vitest deste projeto só coleta `src/**/*.test.ts`
(ver `vitest.config.ts`), e o script é E/S contra o banco. A verificação é a
saída impressa, no passo 5 da Tarefa 10.

- [ ] **Step 1: Gerar o CSV a partir da planilha**

A planilha não tem cabeçalho. Colunas: nome, e-mail, telefone. Gere
`leads-rtv.csv` na raiz, **com** cabeçalho:

```
nome,email,telefone
EDILEUZA OLIVEIRA DA CRUZ,edicruz2010@gmail.com,558588194342
Rosangela de Azevedo Tito Medina,rtito2005@gmail.com,552199627186
Marcos Odias Fortunato,marcosfortunato2028@gmail.com,554792914518
Romario silva,romariomartins089@gmail.com,551134980291
CAETANO TEIXEIRA DE SOUSA NETO,caetanoneto10@gmail.com,556191037269
Ricardo Brandt,ricabrandt@gmail.com,554591062281
Jonhter,guardiato60@gmail.com,556699825301
Rogerio Ferreira da Silveira,hno.silveira@gmail.com,551163810882
Familia Pereira,familia.pereira.cpr@gmail.com,554196429139
ANDRE DE SOUZA MANZOTTI,andremanzotti@gmail.com,554499724101
Helio Henrique,,554192888940
Vitor Hugo,,556282131475
```

O `.gitignore` já cobre `*.csv`. Confira com `git check-ignore -v leads-rtv.csv`
antes de seguir — se não estiver ignorado, **pare**: são doze pessoas reais e o
remoto é GitHub.

- [ ] **Step 2: Escrever o script**

Crie `scripts/importar-leads.ts`:

```ts
// Importa a base de leads de um CSV para a tabela `leads`.
//
// Rodar: IMPORT_CONFIRMO=sim npx tsx scripts/importar-leads.ts leads-rtv.csv
//
// O CSV é `nome,email,telefone` com cabeçalho. Telefone em qualquer formato —
// `telNorm11` resolve o nono dígito ausente, que é como a base do cliente veio.
//
// NÃO SILENCIA RECUSA. `telNorm11` devolve null para número que não é celular
// brasileiro reconhecível, e o lote de 2026-09-09 tem um (`551134980291`, cujo
// assinante começa em 3). Sumir com ele faria o disparo parecer completo com
// um lead a menos. Ele é impresso por nome no final.
import './env'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { telNorm11, toBrazilPhone } from '../src/lib/phoneUtils'

const caminho = process.argv[2]

if (process.env.IMPORT_CONFIRMO !== 'sim') {
  console.error(
    [
      '',
      'Recusando rodar sem confirmação explícita.',
      '',
      'Este script escreve leads REAIS na tabela `leads` do projeto Supabase.',
      '',
      `  Banco alvo: ${process.env.NEXT_PUBLIC_SUPABASE_URL || '(não configurado)'}`,
      `  Arquivo:    ${caminho || '(não informado)'}`,
      '',
      'Se for o banco certo:  IMPORT_CONFIRMO=sim npx tsx scripts/importar-leads.ts <arquivo.csv>',
      '',
    ].join('\n')
  )
  process.exit(1)
}

if (!caminho) {
  console.error('Faltou o caminho do CSV.')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !chave) {
  console.error('NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.')
  process.exit(1)
}

type Linha = { nome: string; email: string; telefone: string }

/** Parser mínimo. O arquivo é gerado por nós e não tem vírgula dentro de campo. */
function lerCsv(texto: string): Linha[] {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim() !== '')
  return linhas.slice(1).map((l) => {
    const [nome = '', email = '', telefone = ''] = l.split(',')
    return { nome: nome.trim(), email: email.trim(), telefone: telefone.trim() }
  })
}

async function main(): Promise<void> {
  const db = createClient(url!, chave!, { auth: { persistSession: false } })
  const linhas = lerCsv(readFileSync(caminho!, 'utf8'))

  const aceitos: { linha: Linha; canonico: string }[] = []
  const recusados: Linha[] = []

  for (const linha of linhas) {
    const canonico = telNorm11(linha.telefone)
    if (canonico === null) recusados.push(linha)
    else aceitos.push({ linha, canonico })
  }

  // `tel_norm` é coluna gerada, com índice único (`leads_tel_norm_uk`). O
  // upsert conflita por ela, então reimportar o mesmo arquivo não duplica.
  const registros = aceitos.map(({ linha }) => ({
    nome: linha.nome,
    // Guarda com DDI, a forma que a Meta entrega. `tel_norm` deriva sozinha.
    telefone: toBrazilPhone(linha.telefone),
    email: linha.email || null,
    segmento: 'artha',
    stage: 'novo',
    plano_status: 'trial_expirado',
    ultimo_acesso_em: null,
    ficticio: false,
  }))

  const { data, error } = await db
    .from('leads')
    .upsert(registros, { onConflict: 'tel_norm', ignoreDuplicates: false })
    .select('id')

  if (error) {
    console.error(`Falhou: ${error.message}`)
    process.exit(1)
  }

  console.log('')
  console.log(`Linhas no arquivo:  ${linhas.length}`)
  console.log(`Gravados:           ${data?.length ?? 0}`)
  console.log(`Recusados:          ${recusados.length}`)

  if (recusados.length > 0) {
    console.log('')
    console.log('NÃO ENTRARAM — telNorm11 não reconheceu como celular brasileiro:')
    for (const r of recusados) console.log(`  ${r.telefone}  ${r.nome}`)
    console.log('')
    console.log('Trate à mão ou confirme o número com o cliente. Não some com eles.')
  }
  console.log('')
}

void main()
```

- [ ] **Step 3: Registrar o script**

Em `package.json`, dentro de `"scripts"`, depois de `"reset:storage"`:

```json
    "importar:leads": "tsx scripts/importar-leads.ts"
```

- [ ] **Step 4: Verificar que ele recusa sem confirmação**

Run: `npx tsx scripts/importar-leads.ts leads-rtv.csv`
Expected: imprime "Recusando rodar sem confirmação explícita." e sai com código 1.
**Não** rode com `IMPORT_CONFIRMO=sim` agora — o banco ainda não está de pé
(Tarefa 10, passo 2).

- [ ] **Step 5: Commit**

```bash
git add scripts/importar-leads.ts package.json
git commit -m "Importador de leads por CSV, com os recusados impressos por nome"
```

---

## Tarefa 4 — `componentesDeBotao` em `templates.ts`

**Files:**
- Modify: `src/lib/templates.ts`
- Test: `src/lib/templates.test.ts`

**Depende de T1** (`PREFIXO_TEMPLATE_RTV`, `RTV_BOTOES`).

- [ ] **Step 1: Escrever o teste que falha**

Acrescente ao final de `src/lib/templates.test.ts`:

```ts
describe('componentesDeBotao', () => {
  it('monta um quick_reply por botão do ramo rtv, na ordem dos índices', () => {
    expect(componentesDeBotao('mkt_rtv_isencao_01')).toEqual([
      { type: 'button', sub_type: 'quick_reply', index: '0', parameters: [{ type: 'payload', payload: 'rtv:voltar' }] },
      { type: 'button', sub_type: 'quick_reply', index: '1', parameters: [{ type: 'payload', payload: 'rtv:problema' }] },
      { type: 'button', sub_type: 'quick_reply', index: '2', parameters: [{ type: 'payload', payload: 'rtv:sair' }] },
    ])
  })

  it('o template antigo da conta também casa a convenção', () => {
    expect(componentesDeBotao('mkt_rtv_voce_sabe_01')).toHaveLength(3)
  })

  it('devolve lista vazia fora da convenção', () => {
    // Lista vazia importa: é ela que mantém a defesa do erro 132018, porque
    // `enviarTemplate` só omite `components` quando a lista chega vazia.
    expect(componentesDeBotao('modelo_teste')).toEqual([])
    expect(componentesDeBotao('')).toEqual([])
  })
})
```

Acrescente `componentesDeBotao` ao `import` de `./templates` no topo do arquivo.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/templates.test.ts`
Expected: FAIL — `No "componentesDeBotao" export is defined on the module`.

- [ ] **Step 3: Implementar**

Em `src/lib/templates.ts`, troque o tipo `ComponenteEnvio`:

```ts
type Parametro = { type: 'text'; text: string }
type ParametroPayload = { type: 'payload'; payload: string }
export type ComponenteEnvio =
  | { type: 'body'; parameters: Parametro[] }
  | { type: 'button'; sub_type: 'url'; index: string; parameters: Parametro[] }
  | { type: 'button'; sub_type: 'quick_reply'; index: string; parameters: ParametroPayload[] }
```

Acrescente ao final do arquivo:

```ts
/**
 * Os componentes de botão do envio, resolvidos pelo NOME do template.
 *
 * É esta função que faz o quick reply do disparo chegar no webhook como
 * `rtv:voltar` em vez da string `"Quero voltar"`. O payload de um botão de
 * template não é definido na criação; ele é mandado a cada envio, e sem isto a
 * Meta usa o próprio título — que não é id de roteiro nenhum.
 *
 * POR NOME, e não por uma coluna nova em `agendamentos`: a fila guarda só o
 * nome do template, e acrescentar coluna para doze leads de teste é schema
 * novo por nada. O custo é uma convenção, travada por teste.
 *
 * Não é `parametrosDoTemplate`: aquela resolve variável a partir de um
 * `RascunhoTemplate`, e o worker não tem rascunho em mãos — teria de buscar um
 * por lead disparado.
 */
export function componentesDeBotao(nomeDoTemplate: string): ComponenteEnvio[] {
  if (!nomeDoTemplate.startsWith(PREFIXO_TEMPLATE_RTV)) return []
  return RTV_BOTOES.map((b, index) => ({
    type: 'button' as const,
    sub_type: 'quick_reply' as const,
    index: String(index),
    parameters: [{ type: 'payload' as const, payload: b.id }],
  }))
}
```

Acrescente o import no topo de `src/lib/templates.ts`:

```ts
import { PREFIXO_TEMPLATE_RTV, RTV_BOTOES } from './bot/roteiro'
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/templates.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/templates.ts src/lib/templates.test.ts
git commit -m "componentesDeBotao: o payload do quick reply vai no envio, nao na criacao"
```

---

## Tarefa 5 — Portão de campanha em `estado.ts`

**Files:**
- Modify: `src/lib/bot/estado.ts`
- Test: `src/lib/bot/estado.test.ts`

**Depende de T1** (`ehIdRtv`).

- [ ] **Step 1: Escrever o teste que falha**

O arquivo já tem os helpers `entrada()`, `botao(id)`, `doBot()`, `doHumano()`,
`doTemplate()` e `disparo()`. **Use eles** — construir `MensagemBot` à mão aqui
esquece `message_type` e `content`, que são obrigatórios, e o teste nem compila.

Um helper novo é necessário, porque `botao(id)` monta `message_type:
'interactive'` e o quick reply de template chega como `'button'`. Acrescente-o
logo depois de `doTemplate()`:

```ts
/** Quick reply de template COM payload nosso, como a fila passa a mandar. */
function doTemplateRtv(id: string): MensagemBot {
  return entrada({ message_type: 'button', content: 'x', button_id: id })
}
```

Depois acrescente, ao final do `describe('proximoPasso', …)` que já existe:

```ts
  it('30. quem aperta o botão do template com payload nosso recebe a resposta, não a p1', () => {
    // ESTE É O TESTE QUE PROVA A SPEC §3.2 CONSERTADA. Contra o código de
    // 2026-08-25 ele falha devolvendo { acao: 'perguntar', pergunta: P1 }.
    expect(proximoPasso([disparo(), doTemplateRtv('rtv:voltar')])).toEqual({
      acao: 'encerrar',
      idP1: 'rtv:voltar',
      idP2: null,
      comFecho: true,
    })
  })

  it('31. vale para os três terminais do ramo', () => {
    for (const id of ['rtv:voltar', 'rtv:problema', 'rtv:sair']) {
      expect(proximoPasso([disparo(), doTemplateRtv(id)])).toEqual({
        acao: 'encerrar',
        idP1: id,
        idP2: null,
        comFecho: true,
      })
    }
  })

  it('32. o bot não fala duas vezes no mesmo toque', () => {
    expect(proximoPasso([disparo(), doTemplateRtv('rtv:voltar'), doBot()]).acao).toBe('calar')
  })

  it('33. a porta orgânica não regride: texto livre continua abrindo na p1', () => {
    expect(proximoPasso([entrada()])).toEqual({ acao: 'perguntar', pergunta: P1 })
  })

  it('34. operador que já falou desliga o bot também no ramo rtv', () => {
    expect(proximoPasso([doHumano(), disparo(), doTemplateRtv('rtv:voltar')]).acao).toBe('calar')
  })
```

**Os testes 24, 25, 27 e 29 continuam como estão, e continuam verdes.** Eles
usam `doTemplate()`, cujo `button_id` é `'quero_voltar'` — payload que a Meta
gera sozinha quando ninguém manda o nosso. Não é id do roteiro, então o portão
novo não pega, e o comportamento antigo segue valendo para campanha anterior a
esta onda e para o template velho disparado à mão. Se algum deles ficar
vermelho, o portão foi posto no lugar errado.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/bot/estado.test.ts`
Expected: FAIL no primeiro teste — recebido `{ acao: 'perguntar', pergunta: {...P1} }`.

- [ ] **Step 3: Implementar**

Em `src/lib/bot/estado.ts`, acrescente `ehIdRtv` ao import de `./roteiro`.

Insira o bloco abaixo **imediatamente antes** do comentário que começa com
`// O bot ainda não falou: é aqui que o gatilho de primeiro contato mora.`:

```ts
  // PORTA DE CAMPANHA. Spec 2026-09-26 §5.2.
  //
  // Vem antes do portão de primeiro contato de propósito. O disparo grava
  // autoria nula, então `ehDoBot` é falso e o portão abaixo trataria este
  // inbound como primeiro contato — devolvendo a P1 de segmentação para quem
  // acabou de apertar "Quero voltar". O turno mais quente da campanha ia
  // embora perguntando o que a planilha já responde.
  //
  // Nível único: o botão do template É a pergunta, e a resposta encerra.
  if (ehIdRtv(ultima.button_id)) {
    return { acao: 'encerrar', idP1: ultima.button_id, idP2: null, comFecho: true }
  }
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/bot/estado.test.ts`
Expected: PASS, inclusive os testes que já existiam.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot/estado.ts src/lib/bot/estado.test.ts
git commit -m "Porta de campanha: apertar o botao do template nao cai mais na P1"
```

---

## Tarefa 6 — `optout_em` e `marcarOptout` no repo

**Files:**
- Modify: `src/server/repo/leads.ts`

**Depende de T2** (`Lead.optoutEm`).

Sem teste automatizado: o módulo é `server-only` e fala com o PostgREST. A
verificação é o passo 7 da Tarefa 10.

- [ ] **Step 1: Ler a coluna**

Em `src/server/repo/leads.ts`, acrescente o campo ao tipo `LinhaLead`, no final:

```ts
  optout_em: string | null
```

E ao retorno de `paraDominio`, depois de `ficticio`:

```ts
    optoutEm: l.optout_em ?? null,
```

Todos os `select` de leads neste arquivo usam `select('*')`, então a coluna
chega sozinha. Não há query a mudar.

- [ ] **Step 2: `qualificarLead` passa a qualificar sem mexer em segmento**

Hoje `stage: 'qualificado'` só é gravado quando vem `segmento`. Os terminais do
ramo `rtv` não mandam segmento — a coorte inteira já nasce `artha` na
importação, e sobrescrever com o mesmo valor esconderia erro de importação
(spec §4.3). Troque a assinatura e o bloco:

```ts
export async function qualificarLead(
  id: string,
  dados: { segmento?: Lead['segmento']; tag?: string; qualificar?: boolean }
): Promise<void> {
  const atual = await buscarLead(id)
  if (!atual) return

  const patch: Record<string, unknown> = { ultima_interacao_em: new Date().toISOString() }
  if (dados.segmento) {
    patch.segmento = dados.segmento
    patch.stage = 'qualificado'
  }
  // A porta de campanha qualifica SEM tocar em segmento. Spec §4.3.
  if (dados.qualificar) patch.stage = 'qualificado'
  if (dados.tag && !atual.tags.includes(dados.tag)) {
    patch.tags = [...atual.tags, dados.tag]
  }

  const { error } = await db().from('leads').update(patch).eq('id', id)
  if (error) throw new Error(`qualificarLead: ${error.message}`)
}
```

- [ ] **Step 3: `marcarOptout`**

Acrescente ao final de `src/server/repo/leads.ts`:

```ts
/**
 * Desliga o lead de todo disparo futuro. Spec §5.4.
 *
 * Função própria, e não um campo de `qualificarLead`: opt-out não é
 * qualificação, não mexe em `stage`, e precisa ser a escrita mais simples
 * possível — ela roda antes do envio da confirmação justamente para sobreviver
 * a um erro da Meta.
 *
 * Idempotente pelo `is('optout_em', null)`: um segundo toque no mesmo botão não
 * reescreve a data original, que é o que se apresenta se alguém reclamar.
 */
export async function marcarOptout(id: string): Promise<void> {
  const { error } = await db()
    .from('leads')
    .update({ optout_em: new Date().toISOString() })
    .eq('id', id)
    .is('optout_em', null)
  if (error) throw new Error(`marcarOptout: ${error.message}`)
}
```

- [ ] **Step 4: Type-check só deste caminho**

Run: `npx tsc --noEmit`
Expected: sem erro. (É rápido — o projeto tem `tsbuildinfo` incremental.)

- [ ] **Step 5: Commit**

```bash
git add src/server/repo/leads.ts
git commit -m "Repo le optout_em, ganha marcarOptout, e qualifica sem mexer em segmento"
```

---

## Tarefa 7 — A fila manda o payload

**Files:**
- Modify: `src/server/fila.ts`

**Depende de T4** (`componentesDeBotao`).

- [ ] **Step 1: Trocar a montagem dos componentes**

Em `src/server/fila.ts`, troque o import de `@/lib/templates`:

```ts
import { componentesDeBotao, type ComponenteEnvio } from '@/lib/templates'
```

E troque o bloco que monta `componentes` (o que hoje começa no comentário
`// Só variáveis de corpo.`):

```ts
      // Corpo + botões. O componente de botão é o que faz o quick reply chegar
      // no webhook como `rtv:voltar` em vez do título — ver
      // `componentesDeBotao`. Componente vazio continua sendo OMITIDO: mandar
      // `components: []` é o erro 132018 que esta conta já levou, e
      // `enviarTemplate` também omite quando a lista chega vazia, então a
      // defesa existe nas duas pontas.
      const variaveis = Array.isArray(a.variaveis) ? a.variaveis : []
      const componentes: ComponenteEnvio[] = [
        ...(variaveis.length > 0
          ? ([{ type: 'body', parameters: variaveis.map((text) => ({ type: 'text', text })) }] as ComponenteEnvio[])
          : []),
        ...componentesDeBotao(a.template),
      ]
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erro.

- [ ] **Step 3: Commit**

```bash
git add src/server/fila.ts
git commit -m "A fila manda o payload do quick reply junto do corpo"
```

---

## Tarefa 8 — O executor grava o opt-out

**Files:**
- Modify: `src/server/bot/executar.ts`

**Depende de T1** (`ID_OPTOUT`, `ehIdRtv`) e **T6** (`marcarOptout`).

- [ ] **Step 1: Imports**

Em `src/server/bot/executar.ts`, acrescente `ehIdRtv` e `ID_OPTOUT` ao import de
`@/lib/bot/roteiro`, e troque o import do repo:

```ts
import { marcarOptout, qualificarLead } from '../repo/leads'
```

- [ ] **Step 2: Trocar o bloco de qualificação**

Troque o bloco que hoje começa em `if (gatilho.leadId) {` por:

```ts
  if (gatilho.leadId) {
    // OPT-OUT PRIMEIRO, antes de qualquer envio. A trava de `bot_acoes` já foi
    // queimada acima e não há reprocessamento: se um erro da Meta deixar só uma
    // das duas coisas acontecer, tem de ser a que impede o próximo disparo. A
    // confirmação é cortesia, o opt-out é obrigação. Spec §5.4.
    if (passo.idP1 === ID_OPTOUT) await marcarOptout(gatilho.leadId)

    // Os dois tipos são ANOTADOS de propósito. O projeto não liga
    // `noUncheckedIndexedAccess`, então indexar um `Record` devolve o tipo do
    // valor mesmo quando não há entrada — e não há para `p1:outro` em
    // `SEGMENTO_POR_P1`. Sem a anotação o `undefined` fica invisível para quem lê.
    const segmento: Segmento | undefined = passo.idP1 ? SEGMENTO_POR_P1[passo.idP1] : undefined
    const tag: string | undefined = passo.idP2
      ? TAG_POR_RESPOSTA[passo.idP2]
      : passo.idP1
        ? TAG_POR_RESPOSTA[passo.idP1]
        : undefined

    // A porta de campanha qualifica sem mexer em segmento: a coorte já nasce
    // `artha` na importação. Quem pediu para sair não é qualificação nenhuma.
    const qualificar = ehIdRtv(passo.idP1) && passo.idP1 !== ID_OPTOUT

    if (segmento || tag || qualificar) {
      await qualificarLead(gatilho.leadId, { segmento, tag, qualificar })
    }
  }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erro.

- [ ] **Step 4: Commit**

```bash
git add src/server/bot/executar.ts
git commit -m "Opt-out grava antes do envio, e os terminais rtv qualificam o lead"
```

---

## Tarefa 9 — Submeter o template à Meta

**Files:**
- Create: `scripts/criar-template.ts`
- Modify: `package.json` (um script)

**Depende de T1** (`TEMPLATE_RTV`).

- [ ] **Step 1: Escrever o script**

Crie `scripts/criar-template.ts`:

```ts
// Submete `mkt_rtv_isencao_01` à Meta para aprovação.
//
// Rodar: npx tsx scripts/criar-template.ts
//
// O rascunho vem de `src/lib/bot/roteiro.ts`, fonte única: o título do botão
// aparece no template aprovado E no payload que a fila manda, e duas fontes
// divergem em silêncio. `validarTemplate` roda antes de gastar a chamada —
// pegar localmente o que a Meta recusaria é o motivo daquele módulo existir.
//
// NÃO usa `src/server/meta/client.ts`: aquele módulo é `server-only` e não
// carrega fora do Next.
import './env'
import { TEMPLATE_RTV } from '../src/lib/bot/roteiro'
import { validarTemplate } from '../src/lib/templates'

const token = process.env.WHATSAPP_ACCESS_TOKEN
const waba = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
const versao = process.env.GRAPH_API_VERSION || 'v21.0'

if (!token || !waba) {
  console.error('WHATSAPP_ACCESS_TOKEN e WHATSAPP_BUSINESS_ACCOUNT_ID são obrigatórias.')
  process.exit(1)
}

const erros = validarTemplate(TEMPLATE_RTV)
if (erros.length > 0) {
  console.error('O rascunho não passa na validação local:')
  for (const e of erros) console.error(`  ${e}`)
  process.exit(1)
}

const corpo = {
  name: TEMPLATE_RTV.nome,
  language: TEMPLATE_RTV.idioma,
  category: TEMPLATE_RTV.categoria,
  components: [
    {
      type: 'BODY',
      text: TEMPLATE_RTV.corpo,
      example: { body_text: [TEMPLATE_RTV.exemplos] },
    },
    {
      type: 'BUTTONS',
      buttons: TEMPLATE_RTV.botoes.map((b) => ({ type: 'QUICK_REPLY', text: b.texto })),
    },
  ],
}

async function main(): Promise<void> {
  console.log('')
  console.log(`Submetendo ${TEMPLATE_RTV.nome} (${TEMPLATE_RTV.categoria}, ${TEMPLATE_RTV.idioma})`)
  console.log('')
  console.log(TEMPLATE_RTV.corpo)
  console.log('')
  console.log(TEMPLATE_RTV.botoes.map((b) => `[ ${b.texto} ]`).join(' '))
  console.log('')

  const resp = await fetch(`https://graph.facebook.com/${versao}/${waba}/message_templates`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })
  const texto = await resp.text()

  if (!resp.ok) {
    console.error(`A Meta recusou (${resp.status}):`)
    console.error(texto)
    process.exit(1)
  }

  console.log('Submetido. A aprovação leva de minutos a alguns dias.')
  console.log(texto)
  console.log('')
  console.log('Acompanhar:  npx tsx -e "..." ou a aba Templates da Business Manager.')
  console.log('')
}

void main()
```

- [ ] **Step 2: Registrar o script**

Em `package.json`, dentro de `"scripts"`, depois de `"importar:leads"`:

```json
    "criar:template": "tsx scripts/criar-template.ts"
```

- [ ] **Step 3: Verificar que a validação local passa, sem submeter**

Run: `npx tsc --noEmit`
Expected: sem erro. **Não execute o script agora** — submeter template é ação
externa e irreversível dentro da conta do cliente. Ela acontece no passo 4 da
Tarefa 10, com o gestor ciente.

- [ ] **Step 4: Commit**

```bash
git add scripts/criar-template.ts package.json
git commit -m "Script que submete o template da isencao, com validacao local antes"
```

---

## Tarefa 10 — Verificação e documentação

**Files:**
- Modify: `ROADMAP.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: A suíte inteira e o build, uma vez só**

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Expected: os quatro limpos. `npm test` deve passar de 291 (contagem de
2026-08-25) para 291 + os testes novos das tarefas 1, 2, 4 e 5.

Se algo falhar aqui, **conserte antes de seguir** — os passos 2 em diante
mexem em contas reais.

- [ ] **Step 2: Portões de infra (não é código)**

Nenhum passo abaixo roda sem estes. Ver spec §7.3.

- [ ] Supabase de pé. `rdlmvcvwrofufvlmldlv.supabase.co` não resolvia em DNS em
      2026-09-26. Reativar o projeto pausado ou criar outro e trocar
      `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` em `.env.local`.
- [ ] Migrations `0001`, `0002` e `0003` aplicadas no SQL Editor, nessa ordem.
- [ ] Bucket `midia`, privado, criado no Storage.
- [ ] Cartão cadastrado na Meta. Sem billing, template de marketing não sai.
- [ ] Deploy público na Vercel e webhook apontado para `/api/webhook`.

- [ ] **Step 3: Importar**

Run: `IMPORT_CONFIRMO=sim npx tsx scripts/importar-leads.ts leads-rtv.csv`
Expected:

```
Linhas no arquivo:  12
Gravados:           11
Recusados:          1

NÃO ENTRARAM — telNorm11 não reconheceu como celular brasileiro:
  551134980291  Romario silva
```

O Romario **tem** de aparecer por nome. Se a saída disser 12 gravados, algo
fabricou um nono dígito e o número está errado.

- [ ] **Step 4: Submeter o template**

Run: `npx tsx scripts/criar-template.ts`
Expected: a Meta devolve um id. Aguardar `APPROVED` antes do passo 5.

- [ ] **Step 5: Disparo de teste para o número do gestor**

Crie a campanha por `POST /api/campanhas` com
`{ template: 'mkt_rtv_isencao_01', filtro: { planoStatus: 'trial_expirado' }, variaveisPorLead: ['nome'] }`
restrita a um lead de teste, drene com `POST /api/fila/processar`, e confira:

- [ ] O template chega com o primeiro nome preenchido e os três botões.
- [ ] Apertar **Quero voltar** → chega o texto de `RESPOSTA_POR_ID['rtv:voltar']`,
      e **não** a P1. É esta checagem que prova a spec §3.2 consertada em
      produção.
- [ ] O lead vira `qualificado` com a tag `rtv-quer-voltar`.
- [ ] A conversa aparece na fila de atendimento do Dashboard.

- [ ] **Step 6: Opt-out ponta a ponta, noutro número**

- [ ] Apertar **Não quero receber** → chega a confirmação.
- [ ] `optout_em` fica preenchido na linha do lead.
- [ ] Criar uma segunda campanha com o mesmo filtro → o lead **não** é
      enfileirado, e `recorte` volta com um a menos.

- [ ] **Step 7: Atualizar a documentação**

Em `ROADMAP.md`, acrescente uma seção antes de `## [NA FILA]`:

```markdown
## Concluído (2026-09-28) — funil de retomada

A dívida de 17 dias com o cliente. A oferta de 2026-09-09 (isenção da adesão de
R$100, R$197 vira R$97 no primeiro mês) virou funil. Spec:
`docs/superpowers/specs/2026-09-26-funil-de-retomada-design.md`.

O defeito consertado: quem apertava um quick reply de template caía no portão de
primeiro contato de `estado.ts` e ouvia a P1 de segmentação. O `button_id` era
descartado, e a coorte de maior intenção respondia duas vezes a mesma pergunta.
Agora `ehIdRtv` abre uma porta antes desse portão.

`componentesDeBotao` manda o payload do quick reply no envio, resolvido pelo
prefixo `mkt_rtv` do nome do template. Sem isso a Meta usa o título do botão
como payload, que não é id de roteiro nenhum.

Opt-out passou a existir: coluna `leads.optout_em` (migration 0003), gravada
antes da confirmação, e `podeDisparar` recusa. Não havia nenhum, e o template
já trazia o botão.

**Dívida que nasce aqui:** o bot afirma a isenção de R$100, e ela não está
publicada em lugar nenhum — o preço ao menos dá para conferir em artha.ia.br.
Se o cliente mudar a oferta, `TEMPLATE_RTV.corpo` muda à mão.

**Consequência aceita:** depois do opt-out a conversa continua na fila de
atendimento, porque `esperandoResposta` conta toda mensagem do bot. Consertar
mexeria em régua de três telas por 1 card de 12.

**Ainda em aberto:** o cupom tem mecanismo? O cliente disse "podemos oferecer",
que é intenção. Por isso o bot entrega a humano em vez de afirmar que a isenção
já está aplicada.
```

Em `CLAUDE.md`, na seção **Voz**, troque o parágrafo inteiro por:

```markdown
Institucional Artha — "Aqui é da Artha", "equipe da Artha". **Nenhum nome de
persona** em copy de mensagem.

A regra deixou de ser "o cliente não escolheu" e passou a ter razão de produto.
`artha.ia.br` vende "Assistente Clara IA via WhatsApp" como feature dos dois
planos: **Clara é a assistente dentro do produto**. O número deste painel é o
canal comercial, e chamar o bot de vendas de Clara faz o lead achar que já está
falando com a assistente que ele ainda não assinou. Lúcia é pior — é o CRM B2B
vendido a planejadores, e é o que o template `mkt_rtv_voce_sabe_01` assina por
engano.
```

- [ ] **Step 8: Commit**

```bash
git add ROADMAP.md CLAUDE.md
git commit -m "ROADMAP registra o funil de retomada, e CLAUDE.md ganha a razao de produto da voz"
```

---

## O que este plano não faz

- IA. Continua sem LLM no projeto.
- Segundo nível de botão no ramo `rtv`.
- Sequência de vários toques ao longo de dias.
- Voltar `Disparos`, `Templates`, `Agendamentos` e `Reativacao` ao menu. Para 12
  leads, o gestor acompanha em Conversas e dispara por rota.
- Tela de importação, ou mostrar opt-out na tela de Leads.
- Dhana.
- Tirar a conversa da fila depois do opt-out — ver a seção de consequência
  aceita, no topo.
