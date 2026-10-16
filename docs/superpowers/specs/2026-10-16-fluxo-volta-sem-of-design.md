# Fluxo de volta para quem não conectou banco (`mkt_rtv_volta_02`) — design

**Data:** 2026-10-16
**Estado:** aprovado pelo dono em 2026-10-16. Oferta ainda a confirmar pelo
cliente; lista ainda não entregue.

---

## 1. Público

100 trials expirados **sem Open Finance confirmado**. Alguns podem ter conectado
e a conexão caiu, então o texto **não afirma nada** sobre banco conectado. É a
diferença para o `mkt_rtv_volta_01` ("Você conectou seu banco no Artha…"), que
não serve para este grupo.

## 2. O template

`mkt_rtv_volta_02`, MARKETING, `pt_BR`, `{{1}}` = primeiro nome (mesma regra de
`valorDoCampo('nome', …)` do volta_01). Corpo exato, estrutura AIDA:

```
Oi, {{1}}. Você sabe pra onde foi o seu dinheiro este mês?

O Artha junta todos os seus bancos num lugar só e mostra cada gasto, sem planilha. Seu teste acabou, mas a gente guardou uma condição pra você voltar.

A taxa de adesão de R$100 sai de graça e o primeiro mês fica R$97 em vez de R$197. E a gente te ajuda a conectar seus bancos, o que leva 2 minutos.

Essa condição vale só hoje. Toque em Quero voltar e o link já chega com o desconto.
```

## 3. Botões e respostas: iguais ao volta_01

Mesmos `RTV_BOTOES` (`rtv:voltar` / `rtv:problema` / `rtv:sair`), mesmos títulos,
mesmas respostas de `mensagensTerminais`, mesmo `LINK_CUPOM`, mesmas tags. O bot
roteia pelo payload do botão, e `componentesDeBotao` dá o mesmo payload a todo
template de `TEMPLATES_RTV`. Logo, **o único trabalho é registrar o rascunho em
`TEMPLATES_RTV`** (via `rascunhoRtv`, como o volta_01) e travar por teste:

1. O corpo é exatamente o da §2 e passa em `validarTemplate`.
2. Regras de copy do CLAUDE.md: sem travessão nem meia-risca, sem dois-pontos
   introduzindo frase, sem markdown, sem nome de persona (Lúcia, Clara, LucIA).
3. Um toque vindo do volta_02 cai nos mesmos terminais: os payloads de
   `componentesDeBotao('mkt_rtv_volta_02')` são `RTV_IDS`, e cada um dá as mesmas
   mensagens que deu para o volta_01.

"Sai de graça" fala da taxa de adesão, não de teste grátis; o teste existente
que proíbe `grátis|gratuit|devolução|reembolso` continua valendo e passa.

## 4. Fora do escopo (de propósito)

- **Submeter à Meta.** A oferta ainda vai ser confirmada pelo cliente. Quando
  confirmar: `npx tsx scripts/criar-template.ts mkt_rtv_volta_02`. Sem o nome, o
  script submete **todas** as variantes de `TEMPLATES_RTV`, inclusive as já
  aprovadas.
- **Importar os leads.** A lista não chegou. Quando chegar:
  `IMPORT_CONFIRMO=sim npx tsx scripts/importar-leads.ts <csv> rtv-lote-2026-10-sof`.
- Mudar respostas, botões, link ou o volta_01.

## 5. Como se verifica

`npm test`, `npx tsc --noEmit`, `npx eslint src scripts` e `npm run build` verdes.
