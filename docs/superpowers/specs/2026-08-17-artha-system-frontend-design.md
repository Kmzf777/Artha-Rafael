# Spec — Artha System: frontend de demonstração

**Data:** 2026-08-17
**Status:** Aprovada (gestor aprovou spec e plano antecipadamente)
**Plano:** `docs/superpowers/plans/2026-08-17-artha-system-frontend.md`
**Origem:** reunião Vistra.ia × Rafael Recidive (`transcricao.md`, `resumo-transcricao.md`) + `DESIGN.md`

---

## 1. Contexto

Rafael Recidive (Artha) opera três produtos e um atendimento de WhatsApp que hoje roda em
Evolution API + WhatsApp Web + N8N, com o robô desativado há meses porque não conseguia
distinguir lead B2C de lead B2B. A reunião fechou um produto de entrada: **reativação da base
inativa** (~612 usuários) por WhatsApp com API oficial da Meta.

Este projeto nasceu do `mar-azul-system-main`, um painel operacional de WhatsApp em produção
para uma promotora de crédito. O conteúdo foi movido para a raiz de `Projeto-Rafael-ADA/` e a
pasta original removida.

**Esta spec cobre exclusivamente o frontend de demonstração**: telas navegáveis, dados
fictícios, nenhum backend. O objetivo é mostrar ao Rafael o sistema funcionando antes de
existirem número WABA, acesso à Business Manager e a base real.

### Fatos verificados no repositório

- Stack: Next.js 16.2 (App Router), React 19, TypeScript, Tailwind CSS v4, Vitest.
- `src/components/ui/*` é shadcn/ui sobre **`@base-ui/react`**, não Radix. Não existe prop
  `asChild`; usa-se `render={<elemento />}`. `TooltipProvider` já vive em `src/app/layout.tsx`.
- `next-themes` já está em `package.json` — o alternador de tema não precisa de dependência nova.
- `@tanstack/react-query` já é o mecanismo de dados, com provider em `src/app/providers.tsx`.
- O projeto **não é um repositório git**. Nenhum commit será feito nesta fase.
- Ecossistema do cliente, mapeado dos sites: **Artha** (`artha.ia.br`, B2C, Open Finance,
  R$97/mês ou R$997/ano), **Dhana** (`dhana.ia.br`, B2B white-label para planejadores),
  **LucIA** (`lucia.arthafp.com.br`, IA operacional para escritórios de planejamento).

### Ambiguidade pendente, deliberadamente não resolvida

O site do Artha anuncia a assistente como **Clara IA**; a **LucIA** é produto vendido a
terceiros; a transcrição chama de **Lúcia**. São três nomes em circulação e a escolha é do
cliente. **Nenhuma copy de mensagem mock deve citar nome de persona.** A voz é institucional
("Aqui é da Artha", "Equipe Artha"). Quando o Rafael definir, é troca de string.

---

## 2. Escopo

### Entra

Nove superfícies navegáveis, com dados fictícios e mutação em memória:

1. Login
2. Shell (sidebar + alternador de tema + menu de usuário)
3. Dashboard
4. Conversas
5. Leads
6. Disparos
7. Agendamentos
8. Reativação
9. Relatórios + Painel Executivo
10. Configurações da conta

### Não entra

- Nenhuma rota de API, nenhum Supabase, nenhuma Meta Graph API, nenhuma IA.
- Nenhum dado real do cliente.
- Autenticação real: o login é uma tela que navega para o painel.
- Tratamento mobile completo. **Desktop-first (≥1120px)**, sem quebrar layout até 768px.
- Realtime, upload de mídia real, gravação de áudio real.

### Remoções obrigatórias (herança de crédito consignado)

| Caminho | Motivo |
| --- | --- |
| `src/app/api/**` | frontend puro nesta fase |
| `middleware.ts` | gate de sessão Supabase |
| `scraper/` | robô do portal CRDK do Banco Semear |
| `supabase/` | sem banco nesta fase |
| `src/lib/supabase*.ts`, `src/lib/database.types.ts` | idem |
| `src/lib/metaApi.ts`, `metaSignature.ts`, `mediaStorage.ts` | integração Meta |
| `src/lib/llm.ts`, `copilot.ts`, `errorLog.ts`, `operationalErrors.ts` | IA e log operacional |
| `src/lib/ura.ts` | triagem Nome+CPF de crédito |
| `src/lib/templateButtons.ts` | copy de empréstimo consignado |
| `src/lib/reativacao.ts` | ponte CPF→telefone do ERP |
| `src/lib/waIdentity.ts`, `blocklist.ts`, `statusEvents.ts`, `instances.ts` | dependem de backend |
| `API Semear Mar Azul.postman_collection.json` | doc de terceiro |
| `Documentacao da API - Credito 1.md` | doc de terceiro |
| `docs/adr/`, `docs/agents/`, `docs/painel-executivo/` | contexto Mar Azul |
| `docs/superpowers/{specs,plans}/2026-0[6-7]-*` | histórico Mar Azul |
| `ROADMAP.md`, `TREE.md` | reescritos para Artha |
| os `.test.ts` dos módulos removidos | acompanham o módulo |

### Preservações obrigatórias

Módulos puros, testados e neutros de domínio — **mantidos com seus testes**:
`format`, `janela24h`, `timeline`, `conversationKey`, `phoneUtils`, `tabs`,
`conversationFilter`, `buscaConversas`, `listaConversas`, `scheduling`, `disparos`,
`quickReplies`, `conversationReads`, `utils`, `validation`.

`npm test` deve continuar verde no fim. Teste que quebrar por remoção de dependência
deve ser removido junto com o módulo, nunca "consertado" enfraquecendo a asserção.

---

## 3. Design system

Fonte única: `DESIGN.md` na raiz — interpretação da linguagem visual da Uber. Duo
preto-e-branco, pílula 999px como assinatura geométrica, cards 16px, Level 0 flat por padrão.

### 3.1 Duas contradições internas do DESIGN.md, resolvidas aqui

1. **Raio de input.** O bloco de componentes declara `text-input.rounded: {rounded.none}`
   (0px) e a prosa da seção *Inputs & Forms* declara `{rounded.md}` 8px. **Resolução: 8px.**
   Input de canto reto ao lado de pílula 999px briga na tela. Mesma resolução para
   `request-form-input-row`.
2. **`{rounded.pill}` vs `{rounded.full}`.** Efeito idêntico em elemento interativo.
   **Resolução:** `--r-pill` (999px) para tudo que é pílula; `--r-full` (9999px) só para
   avatar e contêiner de ícone circular.

### 3.2 O acento — exceção documentada

O DESIGN.md proíbe segundo acento ("Don't introduce a second brand accent colour"). O gestor
determinou que o painel precisa de uma cor de destaque coerente com a marca. Esta é uma
**quebra consciente e delimitada** da regra.

A cor foi extraída por amostragem de pixel dos três logos do cliente. O ouro é o único
elemento cromático que atravessa Artha, Dhana e LucIA:

| Logo | Azul dominante | Ouro |
| --- | --- | --- |
| Artha | `#204060` | `#E0C080` (champanhe) |
| LucIA | `#003070` | `#E0AC28` (âmbar) |
| Dhana | `#105090` | `#F0C020` (âmbar) |

**Nome do token: Ouro Artha.** O âmbar (`#E0AC28`) é a família escolhida — atravessa as três
marcas e não compete com a tinta preta, como o azul competiria.

Um único valor não serve aos dois temas: `#E0AC28` dá **10,1:1** sobre preto e apenas
**2,08:1** sobre branco, o que reprova até para texto grande. Por isso o acento tem valor por tema.

**Papéis permitidos do acento — lista fechada:**

1. Barra indicadora da aba ativa na sidebar.
2. Anel de `:focus-visible`.
3. O número-herói: contagem de inativos no Dashboard e total do recorte na Reativação.
4. Estado selecionado de chip de filtro (`category-button`).
5. Série primária dos gráficos.

**Proibições absolutas:**

- O CTA primário **nunca** é ouro. Permanece pílula preta no claro / branca no escuro,
  conforme o DESIGN.md. A história de conversão do sistema segue sendo o preto.
- O acento **nunca** carrega estado semântico (entregue/falhou/qualificado). Estado é
  cinza + ícone + rótulo, por decisão do gestor.
- Nenhum segundo acento. Ouro é o único cromático do sistema, além do link.

### 3.3 Tokens

`src/app/globals.css`. Tema claro em `:root`, escuro em `.dark`, alternado por `next-themes`
(`attribute="class"`).

O escuro **não é invenção**: o próprio DESIGN.md define o comportamento em superfície escura —
`hero-band-dark` e `promo-card-on-dark` usam fundo `ink` com texto `on-dark`, e a linha 556
determina que ali o CTA primário inverte para pílula branca. O tema escuro é essa inversão de
polaridade aplicada ao sistema inteiro.

| Token | Claro | Escuro | Origem |
| --- | --- | --- | --- |
| `--canvas` | `#ffffff` | `#000000` | `ink` |
| `--canvas-soft` | `#efefef` | `#282828` | `black-elevated` |
| `--canvas-softer` | `#f3f3f3` | `#1f1f1f` | **derivado** |
| `--surface-pressed` | `#e2e2e2` | `#3a3a3a` | **derivado** |
| `--ink` (texto) | `#000000` | `#ffffff` | `on-dark` |
| `--on-ink` | `#ffffff` | `#000000` | inversão |
| `--body` | `#5e5e5e` | `#afafaf` | `mute` |
| `--mute` | `#afafaf` | `#6e6e6e` | **derivado** |
| `--hairline` | `#e2e2e2` | `#4b4b4b` | `hairline-mid` |
| `--primary` | `#000000` | `#ffffff` | linha 556 |
| `--on-primary` | `#ffffff` | `#000000` | linha 556 |
| `--accent` | `#a8801e` | `#e0ac28` | Ouro Artha |
| `--accent-text` | `#8a6d1f` | `#e8c978` | Ouro Artha |
| `--accent-soft` | `#f7efd9` | `#2a2210` | Ouro Artha |
| `--accent-on-ink` | `#e0ac28` | `#8a6d1f` | Ouro Artha |
| `--link` | `#0000ee` | `#8ab4ff` | **derivado** |

**Sobre `--accent-on-ink`** — acrescentado em 2026-08-17, depois que a implementação do
Dashboard expôs um erro desta spec. `--accent-text` foi verificado contra o **canvas**, mas a
banda `promo-card-on-dark` inverte a polaridade: seu fundo é `--ink`, que **troca de valor
entre os temas**. No tema escuro essa banda é branca, e o `--accent-text` escuro (`#e8c978`)
sobre branco dá **1,61:1** — ilegível, reprovando o critério de aceite 10 desta própria spec.

Por isso `--accent-on-ink` é o **espelho** de `--accent-text`, não uma cor nova: sobre
superfície invertida, o tema claro precisa do ouro claro (banda preta) e o tema escuro precisa
do ouro escuro (banda branca). Regra prática: **`--accent-text` sobre canvas,
`--accent-on-ink` dentro de qualquer superfície `tone="dark"`.**

Cinco valores derivados, todos marcados. `#0000ee` sobre preto dá ~1,3:1 — ilegível; a
derivação do link no escuro é obrigatória, não estética.

**Contrastes verificados:** `--accent` claro `#a8801e` sobre branco = 3,64:1 (aprova componente
de UI e texto grande); `--accent-text` claro `#83661c` sobre canvas = 5,41:1 e **sobre
`--accent-soft` = 4,71:1**; `--accent` escuro `#e0ac28` sobre preto = 10,1:1; `--accent-text`
escuro `#e8c978` sobre preto = 13,1:1 e sobre `--accent-soft` escuro = 9,79:1.

> `--accent-text` começou em `#8a6d1f`, verificado só contra o branco. A implementação de Leads
> mostrou que o chip selecionado o pareia com `--accent-soft`, onde caía para 4,27:1 — reprovado,
> já que o rótulo é 14px/500 e não conta como texto grande. Escurecido para `#83661c`, que passa
> nos dois fundos. **Todo par cor/fundo precisa ser verificado no par real, não contra o canvas.**

**`--mute` não serve para dado.** `#afafaf` sobre branco dá 2,32:1. O DESIGN.md o define como o
papel mais fraco — placeholder e letra miúda. Texto que o operador precisa ler usa `--body`
(6,48:1 no claro, 9,57:1 no escuro).

**Tipografia.** Uma família, dois papéis, conforme a nota de substitutos do DESIGN.md:
**Inter** via `next/font/google`, pesos 400/500/700, com `font-feature-settings: "ss01"` na
classe de display. Saem Bricolage Grotesque, Hanken Grotesk e Geist Mono. Monoespaçado só na
stack `ui-monospace` do doc, restrito a telefone e ID.

| Token | Tamanho / entrelinha / peso | Uso |
| --- | --- | --- |
| `--t-display-xxl` | 52 / 64 / 700 | número-herói |
| `--t-display-xl` | 36 / 44 / 700 | título de tela |
| `--t-display-lg` | 32 / 40 / 700 | número de KPI |
| `--t-display-md` | 24 / 32 / 700 | título de card |
| `--t-display-sm` | 20 / 28 / 700 | subtítulo |
| `--t-body-lg` | 18 / 24 / 500 | parágrafo de destaque |
| `--t-body-md` | 16 / 24 / 400 | corpo padrão |
| `--t-body-md-strong` | 16 / 20 / 500 | label de nav e de botão |
| `--t-body-sm` | 14 / 20 / 400 | célula de tabela |
| `--t-body-sm-strong` | 14 / 16 / 500 | cabeçalho de tabela, chip |
| `--t-caption` | 12 / 20 / 400 | metadado, hora de mensagem |

Títulos em **sentence-case**, sempre. Sem versalete, sem `letter-spacing` no display.

**Raio:** `--r-none 0` · `--r-md 8` · `--r-lg 12` · `--r-xl 16` · `--r-pill 999` ·
`--r-pill-tab 36` · `--r-full 9999`.

**Espaçamento (base 4px):** `--s-xxs 4` · `--s-xs 6` · `--s-sm 8` · `--s-md 12` · `--s-lg 16` ·
`--s-xl 20` · `--s-2xl 24` · `--s-3xl 32`.

**Elevação:** Level 0 flat é o padrão — a maioria dos cards se apoia em contraste de
superfície, não em sombra. Level 1 `0 4px 16px rgba(0,0,0,.12)`; Level 2 `0 4px 16px
rgba(0,0,0,.16)`; Level 3 `0 2px 8px rgba(0,0,0,.16)`.

**No tema escuro, sombra preta sobre fundo preto não existe.** Elevação no escuro vira borda
`1px solid var(--hairline)`. Derivação obrigatória, documentada.

### 3.4 Chrome de componente

| Componente | Fundo | Raio | Tipografia | Padding |
| --- | --- | --- | --- | --- |
| `button-primary` | `--primary` | `--r-pill` | `--t-button-md` (16/20/500) | `--s-md` |
| `button-secondary` | `--canvas` | `--r-pill` | idem | `--s-md` |
| `button-subtle` | `--canvas-soft` | `--r-pill` | idem | `--s-md --s-lg` |
| `text-input` | `--canvas-soft` | `--r-md` | `--t-body-md` | `--s-lg` |
| `card-content` | `--canvas` | `--r-xl` | `--t-body-md` | `--s-2xl` |
| `card-soft-tinted` | `--canvas-soft` | `--r-xl` | `--t-body-md` | `--s-2xl` |
| `promo-card-on-dark` | `--ink` invertido | `--r-xl` | `--t-display-md` | `--s-2xl` |
| `category-button` (chip) | `--canvas-soft` | `--r-pill` | `--t-body-sm-strong` | `--s-sm --s-lg` |
| `nav-row` | `--canvas` | `--r-md` | `--t-body-md-strong` | `--s-md --s-lg` |
| tabela: cabeçalho | `--canvas-soft` | — | `--t-body-sm-strong` | `--s-md --s-lg` |
| tabela: célula | `--canvas` | — | `--t-body-sm` | `--s-md --s-lg` |

Alvo de toque mínimo 44px de altura em qualquer elemento interativo.

### 3.5 Semântica sem cor

Decisão do gestor: estado operacional é **cinza + ícone + rótulo**, nunca cor.

| Estado | Ícone | Rótulo | Cor |
| --- | --- | --- | --- |
| enviado | `Check` | "Enviado" | `--body` |
| entregue | `CheckCheck` | "Entregue" | `--body` |
| enviando | `Send` | "Enviando" | `--body` |
| pendente | `Clock` | "Pendente" | `--body` |
| cancelado | `X` | "Cancelado" | `--body` |
| lido | `CheckCheck` | "Lido" | `--ink` |
| falhou | `TriangleAlert` | "Falhou" | `--ink`, peso 500 |

O rótulo textual é **sempre visível** — nunca só o ícone, nunca só cor. Falha se destaca por
peso de fonte e por ser a única com ícone de alerta, não por vermelho.

> Esta tabela nasceu errada: os estados neutros usavam `--mute`, que dá **2,32:1** sobre branco.
> Num sistema que abriu mão de cor semântica, o rótulo é a única pista que resta — se ele não
> for legível, a decisão de não usar cor não se sustenta nos próprios termos. Corrigida para
> uma hierarquia de três degraus, todos acima de 4,5:1: `--body` no estado neutro, `--ink` no
> que mudou, `--ink` + peso 500 + ícone de alerta na falha.

---

## 4. Camada de dados fictícios

`src/mock/` é a fonte única. Nenhuma tela inventa número.

### 4.1 Contrato

```ts
export type Segmento = 'artha' | 'dhana' | 'lucia'
export type FunnelStage = 'novo' | 'contatado' | 'qualificado' | 'convertido' | 'perdido'
export type PlanoStatus = 'ativo' | 'cancelado' | 'trial_expirado' | 'inadimplente'
export type DeliveryStatus = 'enviado' | 'entregue' | 'lido' | 'falhou'
export type AgendamentoStatus = 'pendente' | 'enviando' | 'enviado' | 'falhou' | 'cancelado'

export type Lead = {
  id: string; nome: string; telefone: string; email: string
  segmento: Segmento; stage: FunnelStage
  planoStatus: PlanoStatus; planoValor: number | null   // 97 | 997 | null
  ultimoAcessoEm: string | null                          // ISO
  primeiroContatoEm: string; ultimaInteracaoEm: string
  cidade: string; tags: string[]; notas: string | null
}

export type Message = {
  id: string; conversaId: string
  direcao: 'inbound' | 'outbound'
  tipo: 'text' | 'template' | 'button' | 'image' | 'audio' | 'document'
  conteudo: string; criadoEm: string
  status?: DeliveryStatus          // só outbound
  enviadoPor?: string; campanhaId?: string
}

export type Conversa = {
  id: string; leadId: string
  ultimaMensagemEm: string; naoLidas: number
  janela24hExpiraEm: string | null; atribuidoA: string | null
}

export type Campanha = {
  id: string; nome: string; template: string; criadaEm: string
  segmentoAlvo: Segmento | 'todos'
  enviados: number; entregues: number; respondidos: number
  qualificados: number; convertidos: number
}

export type Agendamento = {
  id: string; leadId: string; template: string
  agendadoPara: string; status: AgendamentoStatus
  tentativas: number; erro: string | null
}

export type Template = {
  nome: string; categoria: 'MARKETING' | 'UTILITY'
  idioma: 'pt_BR'; corpo: string; botoes: string[]
  status: 'aprovado' | 'pendente'
}
```

### 4.2 Volumes e realismo

- **760 leads**: 148 ativos e 612 inativos — os números que o Rafael citou na reunião.
  Distribuição por segmento: ~70% `artha`, ~22% `dhana`, ~8% `lucia`.
- **14 conversas** com thread real de 6 a 20 mensagens, incluindo uma sequência completa de
  reativação (template → clique em botão → qualificação → passagem para humano).
- **6 campanhas**, **40 agendamentos**, **5 templates**.
- Nomes brasileiros plausíveis, telefones no formato `55DD9XXXXXXXX`, cidades reais de MG e SP.
- Valores coerentes com o produto: R$97/mês e R$997/ano.
- **Semente determinística.** Nenhum `Math.random()` nem `Date.now()` em tempo de render —
  datas são offsets fixos de uma data-âncora exportada. Screenshot precisa reproduzir.

### 4.3 Métricas são derivadas, nunca digitadas

`getMetrics()` calcula do dataset. Se o Dashboard diz 612 inativos, a tela de Reativação tem
de encontrar exatamente 612 ao aplicar a mesma régua. Número divergente entre telas destrói a
credibilidade da demo — é o defeito mais grave possível aqui.

### 4.4 Hooks

Os hooks mock mantêm a **assinatura idêntica** aos atuais (`useConversations`,
`useConversationMessages`, `useConversationData`, `useMessageSender`), continuam usando
`@tanstack/react-query` e apenas trocam o `queryFn` para ler do store em memória. Mutação
grava no store e atualiza o cache via `queryClient.setQueryData` — exatamente o padrão que o
Realtime usa em produção. Trocar para Supabase depois é cirurgia de `queryFn`, não reescrita.

A demo tem de parecer viva: enviar mensagem faz a bolha aparecer com status progredindo
enviado → entregue → lido; mudar etapa de lead move a linha; enfileirar campanha popula
Agendamentos.

---

## 5. As telas

Todas as telas usam **exclusivamente** os tokens da seção 3. Nenhum valor de cor, raio,
espaçamento ou tamanho de fonte literal no JSX.

**Login** — `ex-auth-form-card`: card `--canvas-soft`, raio `--r-xl`, inputs `--r-md`, CTA
pílula preta. Logo do Artha acima. Sem autenticação real: submit navega para o painel.

**Shell** — sidebar 240px em `--canvas`, separada do conteúdo por `--hairline`. Linhas de nav
em `ex-app-shell-row`, raio `--r-md`, label `--t-body-md-strong`; aba ativa recebe **barra
indicadora de 3px em `--accent` na borda esquerda** (substitui a "linha d'água" do Mar Azul).
Rodapé com alternador de tema e menu de usuário. Abas: Dashboard, Conversas, Leads, Disparos,
Agendamentos, Reativação, Relatórios, Painel Executivo, Configurações. Deep-link por `?tab=`
já existe em `src/lib/tabs.ts` — preservar.

**Dashboard** — quatro tiles `card-soft-tinted` com número em `--t-display-lg`. Abaixo,
**exatamente uma** banda `promo-card-on-dark`: "612 inativos aguardando reativação", número em
`--t-display-xxl` com `--accent-text`, e pílula invertida "Iniciar campanha". Um único uso do
movimento assinatura do doc, com propósito. Fila de atendimento e últimas conversas como
listas planas.

**Conversas** — três colunas: lista / thread / detalhes do contato. Bolha recebida em
`--canvas-soft`; bolha enviada com inversão de polaridade (`--ink` de fundo, `--on-ink` de
texto), ambas `--r-xl`. Hora em `--t-caption`. Status de entrega pela tabela 3.5. Composer com
input `--r-md` + pílula de envio. Respostas rápidas como `category-button`. Selo de janela de
24h usando `src/lib/janela24h.ts`.

**Leads** — tabela `ex-data-table-cell` com **paginação de 25 linhas** (760 registros).
Colunas: nome, telefone (mono), segmento (chip), etapa (chip contornado), plano, último acesso,
última interação. Filtros por segmento, etapa e status de plano como chips; chip selecionado
usa `--accent-soft` de fundo e `--accent-text` de texto. Busca por nome e telefone.

**Disparos** — wizard de 3 passos, indicador de passo em `button-tab-translucent`
(`--r-pill-tab` 36px). Passo 1 escolhe template (cards); passo 2 escolhe destinatários por
recorte; passo 3 confirma. Preview da mensagem dentro de um frame de telefone com as bolhas do
padrão de Conversas. CTA final em pílula preta.

**Agendamentos** — tabela + resumo da fila. Status pela tabela 3.5. Ação de cancelar em
`button-subtle`.

**Reativação** — a tela que vende. Chips de régua: dias sem acesso (30/60/90/180+), status de
plano, produto. Contagem do recorte ao vivo em `--t-display-xxl` com `--accent-text`,
recalculada a cada mudança de filtro. Prévia dos primeiros 10 selecionados. Banda preta com o
CTA de enfileirar, que popula Agendamentos de verdade.

**Relatórios e Painel Executivo** — funil por campanha, taxa de resposta, ativos vs inativos
no tempo, distribuição por segmento, receita recorrente estimada, churn por produto.

Regras de gráfico, não negociáveis:
- **Máximo 3 séries por gráfico.** Mais que isso é ilegível em monocromático.
- Série primária em `--accent`; demais em rampa de opacidade de `--ink`.
- Distinção adicional por preenchimento de padrão (hachura/pontos), não por matiz.
- **Rótulo direto na série**, não legenda apartada.
- SVG inline. **Não** introduzir Recharts nem outra biblioteca de gráfico.

**Configurações** — conta conectada, número WABA (fictício), preferência de tema, dados do
perfil. Formulário em `ex-auth-form-card`.

---

## 6. Critérios de aceite

1. `npm run build` limpo — zero erro de tipo.
2. `npm run lint` limpo — zero erro.
3. `npm test` verde.
4. As nove superfícies navegáveis sem erro de console, nos **dois temas**.
5. Alternador de tema funcional, sem flash de tema errado no boot.
6. Zero import de `@supabase/*`, `metaApi` ou rota de API em `src/`.
7. Zero literal de cor, raio ou tamanho de fonte no JSX das telas — só tokens.
8. Números consistentes entre telas: o total de inativos do Dashboard é idêntico ao que a
   Reativação encontra com a mesma régua.
9. Nenhum nome de persona (Lúcia / Clara / LucIA) em copy de mensagem.
10. Contraste: texto normal ≥4,5:1 e componente de UI ≥3:1, nos dois temas.

## 7. Riscos registrados

**Preto puro sem cor semântica em tabela densa.** Para a demo é exatamente o que o DESIGN.md
manda e o resultado é mais sofisticado. Para produção, um operador varrendo 120 disparos vai
depender de ícone + rótulo para achar as falhas, o que é mais lento que um vermelho. Decisão
consciente do gestor; revisitar antes de pôr operação real em cima.

**O acento é uma quebra documentada da regra do DESIGN.md.** Contida em cinco papéis fechados
e proibida no CTA. Se a lista de papéis crescer, o sistema perde a assinatura preto-e-branco.

**Gráfico monocromático degrada rápido.** Mitigado pelo teto de 3 séries e rótulo direto.
