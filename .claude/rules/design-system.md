---
paths:
  - "src/components/**"
  - "src/app/**/*.tsx"
  - "src/app/globals.css"
---

# Design system e UI

`DESIGN.md` na raiz é a autoridade estética (interpretação da linguagem visual da
Uber). A spec do frontend resolve as duas contradições internas dele e define o
acento: `docs/superpowers/specs/2026-08-17-artha-system-frontend-design.md`.

## Componentes: shadcn sobre `@base-ui/react`, não Radix

Os componentes de `src/components/ui/` usam `@base-ui/react` (estilo
`base-nova`). **Não existe prop `asChild`**; use `render`:

```tsx
// Radix (não funciona aqui)
<TooltipTrigger asChild><button>...</button></TooltipTrigger>

// Base UI
<TooltipTrigger render={<span className="block" />}><button>...</button></TooltipTrigger>
```

- `TooltipProvider` já está em `src/app/layout.tsx`.
- Componente novo: `npx shadcn@latest add <nome>` já chega para base-ui. Se o CLI
  travar ou pedir input, escreva à mão no idioma dos vizinhos (base-ui + `cva` +
  `cn`).

## Forma

- Duo preto e branco. **Pílula 999px** em todo elemento interativo.
- Card 16px (`--r-xl`), input 8px (`--r-md`). Level 0 flat por padrão: superfície
  se apoia em contraste, não em sombra.
- Tema escuro: elevação é borda hairline, nunca sombra.
- Títulos em sentence-case. Sem versalete, sem `letter-spacing` no display.
- Alvo de toque mínimo 44px em todo elemento interativo.

## Só tokens

Zero literal de cor, raio, espaçamento ou tamanho de fonte no JSX. A escala de
tipo existe como classe utilitária (`t-display-xl`, `t-body-sm-strong`, ...)
para isso. Faltando token, reporte; não invente hex.

## Acento Ouro Artha: lista fechada de cinco papéis

Quebra consciente da regra "sem segundo acento" do DESIGN.md. Só nestes papéis:

1. Barra indicadora da aba ativa na sidebar (3px, borda esquerda).
2. Anel de `:focus-visible`.
3. O número-herói (hoje, "Leads qualificados" no Dashboard, em
   `--accent-on-ink` porque a banda tem polaridade invertida).
4. Estado selecionado de chip de filtro.
5. Série primária dos gráficos.

Proibido: CTA primário em ouro (é pílula preta no claro, branca no escuro);
acento carregando estado semântico; qualquer segundo acento.

## Estado operacional é cinza + ícone + rótulo, nunca cor

`src/components/ui/status-label.tsx` é a fonte única. O rótulo textual fica
sempre visível.

## Gráficos

SVG inline, **sem Recharts**. No máximo 3 séries; a primária em `--accent`, as
demais em rampa de opacidade de `--ink`; distinção extra por padrão de
preenchimento, não por matiz; rótulo direto na série, sem legenda apartada.

## Render puro

Nada de `Math.random()`, `Date.now()` ou `new Date()` no corpo do render. O
"agora" das telas vem de `useAgora()` (`src/hooks/useAgora.ts`), que tica a cada
30 s. `agoraDemo()` de `src/mock/db.ts` é relógio parado e serve só à semente e
aos testes.
