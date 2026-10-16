# Fluxo de volta para quem não conectou banco (`mkt_rtv_volta_02`) — design

**Data:** 2026-10-16
**Estado:** aprovado pelo dono em 2026-10-16; oferta de R$49 aprovada pelo
cliente no mesmo dia. Falta o link de cupom de R$49 e a lista de leads.

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

A taxa de adesão de R$100 sai de graça e o primeiro mês fica R$49 em vez de R$197. E a gente te ajuda a conectar seus bancos, o que leva 2 minutos.

Essa condição vale só hoje. Toque em Quero voltar e o link já chega com o desconto.
```

## 3. Botões e respostas

Mesmos `RTV_BOTOES` (`rtv:voltar` / `rtv:problema` / `rtv:sair`), mesmos títulos,
mesmas frases, mesmas tags. `componentesDeBotao` dá o mesmo payload a todo
template de `TEMPLATES_RTV`, então o toque cai nos mesmos terminais.

A única diferença é o **link** que "Quero voltar" manda: o cupom do volta_02 é de
R$49, outro link do Stripe, ainda não entregue.

### 3.1 Link por template

`LINK_CUPOM_POR_TEMPLATE` em `src/lib/bot/roteiro.ts`:

| Template | Link |
|---|---|
| `mkt_rtv_volta_01` | `LINK_CUPOM` (o atual, R$97), byte a byte |
| `mkt_rtv_volta_02` | `''` até o cliente mandar |

`linkCupomDoTemplate(template)` devolve o link do mapa, e `LINK_CUPOM` para
template fora do mapa ou desconhecido (`null`). Isso preserva o comportamento de
hoje para tudo que não é volta_02: os rascunhos antigos, o `simular-disparo.ts`
(que não grava campanha) e qualquer toque cuja campanha não se ache.

### 3.2 Qual campanha o toque responde

Verificado em produção em 2026-10-16: o toque num botão de template chega com
`context.id`, o webhook grava em `messages.reply_to_message_id`, e esse wamid é
o `message_id` da linha `template` de saída gravada pela fila, que tem
`campanha_id`. `campanhas.template` dá o nome.

Regra pura `campanhaDoToque(historico, messageIdDoToque)` em
`src/lib/bot/campanhaDoToque.ts`:

1. Se o toque tem `reply_to_message_id` e ele é uma mensagem de saída do
   histórico com `campanha_id`, é essa campanha.
2. Senão, a saída com `campanha_id` mais recente **antes** do toque.
3. Senão, `null`.

O histórico é o mesmo que o bot já lê (`historicoParaBot`), com duas colunas a
mais no `select` (`message_id`, `reply_to_message_id`). Uma consulta nova só: o
`template` da campanha, e só quando o terminal é `rtv:voltar`.

### 3.3 Link vazio

Template no mapa com link `''`: "Quero voltar" **não manda mensagem vazia** nem
a frase "clicar no link acima" sem link. Manda o `FECHO` ("Já passei para a
equipe da Artha…"): a equipe manda o link à mão. A tag e a qualificação não
mudam. É rede de segurança; o guard da §3.4 já impede o merge.

### 3.4 Guard

Como o do volta_01: o link do volta_02 tem de ser `https://`, sozinho, e não a
home. **Fica vermelho até o link chegar**, de propósito: trava o merge. O guard
do volta_01 continua verde e passa a conferir também que o mapa aponta para o
mesmo `LINK_CUPOM`.

## 4. Fora do escopo (de propósito)

- **Submeter à Meta.** Quando confirmado: `npx tsx scripts/criar-template.ts
  mkt_rtv_volta_02`. Sem o nome, o script submete **todas** as variantes de
  `TEMPLATES_RTV`, inclusive as já aprovadas.
- **Importar os leads.** Quando a lista chegar:
  `IMPORT_CONFIRMO=sim npx tsx scripts/importar-leads.ts <csv> rtv-lote-2026-10-sof`.
- Mudar respostas, botões, tags ou o volta_01.

## 5. Como se verifica

`npm test` verde exceto o guard do link do volta_02; `npx tsc --noEmit`,
`npx eslint src scripts` e `npm run build` verdes.
