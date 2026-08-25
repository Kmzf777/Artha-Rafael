# Artha System — CLAUDE.md

Diretrizes comportamentais, orquestração e contexto técnico do projeto para reduzir erros, evitar complexidade desnecessária e acelerar o desenvolvimento.

---

## PARTE 1: Diretrizes de Trabalho e Orquestração

### 1. Pense antes de codificar
**Não assuma. Não esconda confusões. Apresente tradeoffs.**
- **Investigue Antes de Agir:** Nunca especule sobre códigos que você não leu. Use comandos de leitura para inspecionar os arquivos relevantes (`src/app/`, `src/components/`, etc.) ANTES de criar um plano.
- **Explicite suposições:** Se houver ambiguidade no pedido, apresente as interpretações possíveis e peça esclarecimento — não escolha uma silenciosamente.
- **Aponte os tradeoffs:** Questione ativamente se existir uma abordagem mais simples para o problema.
- **Pare se estiver confuso:** Nomeie o que não está claro antes de começar a escrever o código.

### 2. Simplicidade em primeiro lugar
**Mínimo de código necessário. Nada de especulações.**
- Escreva o mínimo de código necessário para resolver o problema. Sem features extras, sem abstrações antecipadas, ou "flexibilidades/configurações" que não foram pedidas.
- Não crie tratamento de erros para cenários impossíveis.
- Se 200 linhas puderem virar 50, reescreva.
- **O Teste:** Um engenheiro sênior acharia essa solução supercomplicada? Se sim, simplifique.

### 3. Mudanças cirúrgicas
**Mexa apenas no necessário. Limpe apenas a sua própria bagunça.**
- Altere apenas o estritamente necessário. Sem refatorações "de passagem" ou "melhorias" em códigos, comentários ou formatações adjacentes que não estão quebrados.
- Siga o estilo existente do arquivo, mesmo que você faria diferente em outro contexto.
- Remova importações, variáveis e funções que as **suas** alterações tornaram obsoletas. Não apague código morto preexistente, a menos que solicitado.
- **A Regra de Ouro:** Cada linha alterada deve ter rastreabilidade direta com o pedido inicial do usuário.

### 4. Execução Orientada a Metas
**Defina critérios de sucesso. Crie loops de verificação.**
Transforme tarefas imperativas em metas verificáveis:
- *Em vez de "Adicionar validação"* -> "Testar inputs inválidos e garantir que o código lide com eles".
- *Em vez de "Consertar o bug"* -> "Reproduzir o bug, aplicar a correção e verificar se não ocorre mais".

Para tarefas de múltiplas etapas, declare um plano breve antes de agir:
`1. [Passo] → verificar: [critério de checagem]`
`2. [Passo] → verificar: [critério de checagem]`

### 5. Arquivos disjuntos entre agentes simultâneos
Quando o trabalho é dividido entre subagentes, cada um edita **somente** os arquivos do seu escopo declarado. Colisão de arquivo entre agentes paralelos é o modo de falha mais caro do projeto.

---

## PARTE 2: Contexto Técnico do Projeto (Artha System)

### O que é

Painel operacional de WhatsApp da **Artha** — planejamento e educação financeira. O eixo é **atendimento e qualificação** de quem escreve para o número. Não é reativação: não há base inativa carregada, e os 612 inativos que este arquivo prometia nunca foram entregues pelo cliente.

Três produtos do cliente, que aparecem como segmento de lead no sistema:

| Produto | Público | Nota |
| --- | --- | --- |
| **Artha** | B2C, pessoa física | Open Finance. Mensal R$197 no 1º mês (adesão de R$100) e R$97 depois; anual R$997 sem adesão |
| **Dhana** | B2B | White-label para planejadores financeiros |
| **LucIA** | B2B | IA operacional para escritórios de planejamento |

### Fase atual: backend real

Supabase Postgres, WhatsApp Cloud API em produção (webhook com HMAC + envio), motor de disparo, e um bot de botões determinístico dentro do webhook. **Sem IA** — o roteiro é fixo e não há LLM no projeto; o agente de IA (B4) segue bloqueado esperando o JSON do n8n.

**O `ROADMAP.md` é a fonte do estado corrente, não este arquivo.** Este aqui descreveu "frontend de demonstração, nenhum backend" por vários dias depois de o backend existir, e quem leu foi enganado. Antes de assumir uma fase, leia o ROADMAP.

- Specs por onda: `docs/superpowers/specs/`

### Comandos essenciais

```bash
npm run dev      # dev server (localhost:3000)
npm run build    # build de produção + type-check
npm run lint     # ESLint
npm test         # Vitest
```

O projeto **é** um repositório git e recebe commits normalmente. A instrução contrária que morava aqui valia só para a fase de demonstração.

### Stack

| Camada | Tecnologia |
| --- | --- |
| Framework | Next.js 16.2 (App Router, Turbopack) |
| UI | React 19 + TypeScript |
| Componentes | **shadcn/ui estilo `base-nova`** — usa `@base-ui/react`, **NÃO** Radix UI |
| CSS | Tailwind CSS v4 + tokens em `src/app/globals.css` |
| Dados | `@tanstack/react-query` sobre o store em memória de `src/mock/` |
| Tema | `next-themes`, `attribute="class"` |

### Atenção: shadcn/ui usa @base-ui/react

Os componentes em `src/components/ui/` usam `@base-ui/react` como primitivo — **diferente** da maioria dos projetos shadcn, que usam Radix UI.

* **NÃO existe prop `asChild`** — use `render={<elemento />}`:

```tsx
// ❌ Radix (não funciona aqui)
<TooltipTrigger asChild><button>...</button></TooltipTrigger>

// ✅ Base UI
<TooltipTrigger render={<span className="block" />}><button>...</button></TooltipTrigger>
```

* **`TooltipProvider`** já está em `src/app/layout.tsx`.
* Novos componentes via `npx shadcn@latest add <nome>` chegam para `@base-ui/react` automaticamente. Se o CLI travar ou pedir input, escrever à mão seguindo o idioma dos arquivos vizinhos (base-ui + `cva` + `cn`).

### Design system

`DESIGN.md` na raiz é a **autoridade estética** — interpretação da linguagem visual da Uber. A spec da feature resolve suas duas contradições internas e define o acento.

- Duo preto-e-branco. **Pílula 999px** é a assinatura geométrica: todo elemento interativo a usa.
- Card 16px (`--r-xl`), input 8px (`--r-md`), **Level 0 flat por padrão** — a maioria das superfícies se apoia em contraste, não em sombra.
- No tema escuro, **elevação é borda hairline, não sombra**. Sombra preta sobre fundo preto não existe.
- Títulos em **sentence-case**, sempre. Sem versalete, sem `letter-spacing` no display.
- Alvo de toque mínimo **44px** em qualquer elemento interativo.

**O acento — Ouro Artha.** Quebra consciente e delimitada da regra "sem segundo acento" do DESIGN.md. Cinco papéis, lista fechada:

1. Barra indicadora da aba ativa na sidebar (3px, borda esquerda).
2. Anel de `:focus-visible`.
3. O número-herói (inativos no Dashboard, total do recorte na Reativação).
4. Estado selecionado de chip de filtro.
5. Série primária dos gráficos.

**Proibições absolutas:** o CTA primário **nunca** é ouro (permanece pílula preta no claro / branca no escuro). O acento **nunca** carrega estado semântico. Nenhum segundo acento.

**Estado operacional é cinza + ícone + rótulo, nunca cor** — `src/components/ui/status-label.tsx` é a fonte única. O rótulo textual é sempre visível.

**Só tokens.** Zero literal de cor, raio, espaçamento ou tamanho de fonte no JSX. A escala de tipo existe como classe utilitária (`t-display-xl`, `t-body-sm-strong`, …) justamente para isso. Se falta um token, o certo é reportar, não inventar hex.

### Padrões do projeto

* **Dados fictícios**: `src/mock/` é a fonte única. Nenhuma tela inventa número. `getMetrics()` é **derivado do dataset** — se o Dashboard diz 612 inativos, a Reativação encontra exatamente 612 com a mesma régua. Número divergente entre telas é o defeito mais grave possível nesta demo.
* **Determinismo**: nenhum `Math.random()` nem `Date.now()` em tempo de render. Datas são offsets fixos de uma data-âncora exportada — screenshot precisa reproduzir.
* **Data fetching**: `@tanstack/react-query` (provider em `src/app/providers.tsx`). Hooks em `src/hooks/`. Mutação grava no store e atualiza o cache via `queryClient.setQueryData` — o mesmo padrão que o Realtime usaria em produção. Trocar para um backend depois é cirurgia de `queryFn`, não reescrita.
* **Abas**: `src/lib/tabs.ts` registra as nove superfícies; o switch de render vive em `src/app/(app)/page.tsx`. Deep-link por `?tab=`. Ao mexer nas abas, os dois arquivos mudam junto com `src/components/Sidebar.tsx`.
* **Regras puras e testadas** ficam em `src/lib/` (`janela24h`, `timeline`, `conversationKey`, `format`, `scheduling`, `disparos`, …), fora dos componentes.
* **Gráficos**: SVG inline, **sem Recharts**. Máximo 3 séries; série primária em `--accent`, demais em rampa de opacidade de `--ink`; distinção adicional por padrão de preenchimento, não por matiz; rótulo direto na série, não legenda apartada.

### Voz

Institucional Artha — "Aqui é da Artha", "Equipe Artha". **Nenhum nome de persona** (Lúcia / Clara / LucIA) em copy de mensagem: há três nomes em circulação e a escolha é do cliente. Quando ele definir, é troca de string.
