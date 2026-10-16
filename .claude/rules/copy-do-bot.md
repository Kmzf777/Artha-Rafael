---
paths:
  - "src/lib/bot/**"
  - "src/server/bot/**"
  - "src/lib/templates.ts"
  - "scripts/criar-template.ts"
---

# Copy de mensagem do bot e dos templates

Toda copy que sai pelo WhatsApp (roteiro, respostas terminais, corpo de template
`mkt_rtv_*`) mora em `src/lib/bot/roteiro.ts`. O script de criação de template e
o montador de payload leem de lá; não duplique texto.

## Regras de escrita do gestor

Travadas por teste em `src/lib/bot/roteiro.test.ts`:

- **Sem travessão nem meia-risca** (U+2014, U+2013) em nenhuma copy.
- **Link sozinho na linha**, sem pontuação encostada.
- **Sem markdown** (`*`, `__`, `#`). O teste cobre o ramo de campanha (`rtv`).
- **Nenhum nome de persona** (Lúcia, Clara, LucIA). O teste cobre o ramo de
  campanha; a regra vale para toda copy (ver "Voz" no `CLAUDE.md`).
- **Nada de "grátis", "gratuito", "devolução", "reembolso"** nos corpos de
  campanha: o site não vende trial, e o "primeiro mês" do cliente é pago.
- Limites da Cloud API: no máximo 3 botões por pergunta, título de botão com até
  20 caracteres, corpo e resposta dentro do teto de texto.

Sem teste, mas vale igual: **sem dois-pontos introduzindo frase.**

Copy nova entra na lista que esses testes percorrem; se o teste não a enxerga,
a regra não a protege.

## Preço e oferta são fato comercial

- Preço vem de `https://artha.ia.br` e está como string literal no roteiro. Nada
  liga as duas pontas: se o site mudar, a string muda à mão.
- A isenção da adesão de R$100 não está publicada em lugar nenhum; é acordo com o
  cliente. Não afirme cupom aplicado sem mecanismo confirmado.
- Dhana não tem preço público: o ramo dela não tem botão de preço.

## Templates de campanha

- Nome com prefixo `mkt_rtv` **tem** de estar em `TEMPLATES_RTV`.
  `componentesDeBotao` (`src/lib/templates.ts`) lança erro de propósito, senão o
  envio sairia sem payload e a base inteira cairia na P1.
- Renomear botão de template aprovado desmarca retroativamente os toques antigos
  na conversa (o casamento é por título nesse caminho).
- `mkt_rtv_voce_sabe_01`, aprovado na conta da Meta, assina "Lúcia" por engano.
  Não use.
