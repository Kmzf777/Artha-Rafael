# Fluxo de volta do Rafael: link com cupom no lugar da triagem — design

**Data:** 2026-10-15
**Estado:** aprovado pelo gestor em 2026-10-15 ("ja deixo tudo aprovado")

---

## 1. De onde isto vem

Rafael Recidive (cliente) mandou o fluxo de retomada que quer no ar:

> Oi, Rafael. Você conectou seu banco no Artha e não assinou. Sua conta continua
> aqui, do jeito que você deixou.
>
> A taxa de adesão de R$100 a gente tirou pra você voltar. O primeiro mês sai R$97
> em vez de R$197, e a gente te acompanha na hora de reconectar, o que leva 2
> minutos.
>
> 1- Quero voltar → (ENVIA O LINK) e depois: "Ótimo, Rafael. É só você clicar no
> link acima e fazer a sua inscrição. Já estará com o cupom aplicado. Mas o cupom
> é válido somente hoje, ok?"
> 2- Preciso de ajuda → PASSAR A CONVERSA PARA ATENDIMENTO
> 3- Não quero receber → "Obrigado pelo retorno, Rafael. Se precisar de ajuda com
> as finanças, fale comigo."

O template já existe e está **aprovado** na Meta: `mkt_rtv_volta_01`, id
`1629556198634284`, commit `1e15c5b`. O botão 2 já se chama "Preciso de ajuda" em
`RTV_BOTOES`. Esta spec cobre só o que o bot faz depois do toque.

O gestor confirmou em 2026-10-15 que o cupom vale "somente hoje" para o cliente.

---

## 2. A triagem sai

A spec `2026-09-28-triagem-e-variantes-design.md` pôs uma triagem ("O que te
segurou da primeira vez?") atrás de `rtv:voltar`, a pedido do gestor, para que
`qualificado` não significasse só "tocou em alguma coisa". O fluxo do Rafael não
tem triagem: quem quer voltar recebe o link e assina sozinho.

O cliente decidiu, e o gestor aprovou. A triagem é **removida**, não desligada:
`RTV2`, `RTV2_POR_RTV1`, os ids `rtv2:*`, as respostas, as tags `rtv-motivo-*`
e o ramo de `estado.ts` que os trata. Código inalcançável com comentário
descrevendo um comportamento que não existe mais engana quem lê.

Risco medido em 2026-10-15: em produção houve **um** toque em `rtv:voltar` e
**um** em `rtv2:preco`, os dois em 2026-10-06, o teste do gestor. Não há
conversa real presa no meio da triagem.

---

## 3. Os três terminais

Os três botões passam a ser terminais. `ehTerminalRtv` vale para os três.

| Botão | id | Mensagens, em ordem | Tag | Qualifica |
|---|---|---|---|---|
| Quero voltar | `rtv:voltar` | 1. `LINK_CUPOM` sozinho<br>2. "Ótimo, {nome}. É só você clicar no link acima e fazer a sua inscrição. Já estará com o cupom aplicado. Mas o cupom é válido somente hoje, ok?" | `rtv-quer-voltar` | sim |
| Preciso de ajuda | `rtv:problema` | `FECHO` ("Perfeito, obrigado! Já passei para a equipe da Artha…") | `rtv-precisa-ajuda` | sim |
| Não quero receber | `rtv:sair` | "Obrigado pelo retorno, {nome}. Se precisar de ajuda com as finanças, fale comigo." | `rtv-optout` | não, e marca opt-out (inalterado) |

### 3.1 "Passar para atendimento"

No projeto, encaminhar a gente já tem forma: `IDS_QUE_ENCAMINHAM` e a mensagem
`FECHO`, usados por `p2:humano`. `rtv:problema` entra no conjunto e perde a
resposta própria. Encaminhar em silêncio deixaria o lead sem saber se alguém leu.

A tag muda de `rtv-teve-problema` para `rtv-precisa-ajuda` porque o botão mudou
de sentido. Nenhum lead tem a tag antiga (zero toques em `rtv:problema`).

### 3.2 O nome

`{nome}` é o primeiro nome do lead, pela mesma regra que preenche o `{{1}}` do
template no disparo (`valorDoCampo('nome', …)` em `src/lib/disparos.ts`): primeiro
token de `leads.nome`, como está gravado. O lead lê o mesmo nome nas duas pontas.

Sem nome (lead ausente, nome vazio, ou nome gerado `+55…` para quem chegou sem
cadastro), a frase perde o vocativo: "Ótimo. É só você…" e "Obrigado pelo
retorno. Se precisar…". Nunca "Ótimo, +5534…".

### 3.3 O link

`LINK_CUPOM` é **uma** constante em `src/lib/bot/roteiro.ts`. O Rafael ainda não
mandou o link. Até mandar, a constante fica vazia e **um teste falha** exigindo
URL `https://`. É de propósito: mandar `https://artha.ia.br` sob a frase "já
estará com o cupom aplicado" seria afirmar ao cliente uma coisa falsa. O trabalho
fica na branch e não vai para a `main` (que publica) enquanto o teste estiver
vermelho.

---

## 4. Mudanças por arquivo

- **`src/lib/bot/roteiro.ts`**: remove a triagem; `LINK_CUPOM`; respostas novas
  de `rtv:voltar` e `rtv:sair`; `rtv:problema` em `IDS_QUE_ENCAMINHAM`; tags.
  `mensagemTerminal` vira `mensagensTerminais(idP1, idP2, nome): string[]`, a
  lista de mensagens em ordem, com `{nome}` resolvido pela §3.2.
- **`src/lib/bot/estado.ts`**: sai o ramo `rtv2`. `rtv:voltar` encerra como os
  outros dois.
- **`src/server/bot/executar.ts`**: busca o nome do lead quando há `leadId`, e
  envia e grava cada mensagem de `mensagensTerminais` em ordem.
- **Testes**: `roteiro.test.ts` e `estado.test.ts` acompanham; a trava de copy
  cobre os textos novos; o teste de `LINK_CUPOM`.
- **`ROADMAP.md`**: uma linha registrando o fluxo e a pendência do link.

## 5. Fora do escopo

- Rascunhos `mkt_rtv_isencao_01`, `_trial_01`, `_pergunta_01`: ficam como estão.
- Disparar a campanha para a base: decisão do gestor depois do link.
- Mecanismo de cupom: o link do Rafael já vem com o cupom; o sistema não valida.

## 6. Como se verifica

1. `npm test`, `npm run lint` e `npm run build` verdes, exceto o teste de
   `LINK_CUPOM` enquanto o link não chega.
2. Testes de `estado` provam: cada um dos três botões encerra; o segundo toque
   cala; o opt-out não qualifica.
3. Depois do link e do merge: `scripts/simular-disparo.ts <telefone> <nome>
   mkt_rtv_volta_01` no número do gestor, apertando os três botões.
