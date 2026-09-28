# Triagem no ramo de campanha, e três variantes de disparo — design

**Data:** 2026-09-28
**Estado:** desenhado no brainstorming de 2026-09-28, aprovado pelo gestor na mesma
sessão

---

## 1. De onde isto vem

O funil de retomada subiu hoje (spec `2026-09-26-funil-de-retomada-design.md`) e o
ramo de campanha ficou de **nível único**: o botão do template era a pergunta, um
toque encerrava, e dois dos três terminais marcavam o lead como `qualificado`.

O gestor, literal: *"o agente de botões precisa realmente de uma triagem inicial
antes de considerar qualificado… só uma mensagem > qualificação, fica direto
demais"*.

Ele tem razão, e o argumento é do próprio cliente. Rafael Recidive escreveu no
WhatsApp de 2026-09-09 que a coorte *"já gerou custo para nós e não comprou **por
algum motivo**"*. Ele não sabe qual é o motivo. Um toque em "Quero voltar" não
diz — diz só que a pessoa reagiu. `qualificado` estava significando "tocou em
alguma coisa", que é barato demais para uma palavra que decide o que ele abre
primeiro quando senta para atender.

O segundo pedido da mesma mensagem: **variantes de disparo para o cliente
escolher**, uma voltada ao trial e uma evolução da atual.

---

## 2. Escopo

### Entra

1. **Nível 2 no ramo `rtv`** — uma pergunta de triagem, aberta só por
   `rtv:voltar`, cujos terminais é que qualificam.
2. **Três variantes de template**, com os mesmos três botões.
3. **Registro nomeado de templates** no lugar da convenção por prefixo, e uma
   trava que transforma o modo de falha silencioso em erro alto.
4. **Correção da frase do "teste"** no corpo da variante A. Ver §6.1.

### Não entra

- IA. O roteiro continua fixo e determinístico.
- Terceiro nível. A triagem é uma pergunta, não um formulário.
- Triagem depois de `rtv:problema`. Ver §3.2.
- Mexer na porta orgânica (`P1` / `P2`). Nada dela muda.
- Medir queda entre nível 1 e nível 2 com coluna ou tag própria — o `button_id`
  de cada mensagem já está gravado e a conta é derivável.
- Voltar `Disparos` e `Templates` ao menu.

---

## 3. A árvore

Voz institucional. Sem travessão, sem dois-pontos introduzindo frase, sem
markdown, link sozinho na linha.

### 3.1 Nível 1 — os botões do template

Idênticos nas três variantes, **de propósito**: com uma variável mudando por vez,
o que o cliente aprende é qual *mensagem* funciona, não qual botão. Também mantém
o mapeamento de payload trivial.

| índice | título | id | o que faz |
| --- | --- | --- | --- |
| 0 | Quero voltar | `rtv:voltar` | **abre a triagem** |
| 1 | Tive um problema | `rtv:problema` | encerra, qualifica |
| 2 | Não quero receber | `rtv:sair` | encerra, opt-out |

### 3.2 Por que só `rtv:voltar` abre a triagem

Quem apertou "Tive um problema" tem um bloqueio concreto e a resposta já pede que
ele escreva qual. Pôr um menu na frente disso é o oposto de atendimento.

**`rtv:problema` continua marcando `qualificado`** — decisão do gestor nesta
sessão, contra a proposta de rebaixar para `contatado`. A leitura que sustenta:
"tive um problema" já É um sinal concreto e acionável, diferente de "quero
voltar", que é vago e precisa do motivo.

### 3.3 Nível 2 — a triagem

```
Boa. Me diz o que te segurou da primeira vez.
```

Repetida sem a saudação: `O que te segurou da primeira vez?`

| índice | título | id | tag |
| --- | --- | --- | --- |
| 0 | Foi o preço | `rtv2:preco` | `rtv-motivo-preco` |
| 1 | Travei na conexão | `rtv2:tecnico` | `rtv-motivo-tecnico` |
| 2 | Não entendi direito | `rtv2:duvida` | `rtv-motivo-duvida` |

Os três títulos cabem em 20 caracteres (11, 17, 19).

A pergunta responde a dúvida que o cliente declarou ter, e cada resposta arma a
fala de abertura dele: preço é objeção que a isenção resolve, conexão é suporte
que a isenção não resolve, e dúvida é falta de entendimento do produto.

### 3.4 As respostas

`rtv:voltar` **não tem resposta de texto** — ele faz a pergunta de triagem. Sair
de `RESPOSTA_POR_ID` é parte da mudança.

```
rtv2:preco
  Entendi. Já passei para a equipe da Artha, que fecha a isenção com você e te
  acompanha na hora de reconectar.

rtv2:tecnico
  Isso a gente resolve junto. Me conta em que banco você travou, que alguém da
  Artha olha o seu caso.

rtv2:duvida
  Sem problema, é pra isso que a gente está aqui. Já passei para a equipe da
  Artha, que te explica como funciona e responde o que faltar.
```

`rtv:problema` e `rtv:sair` mantêm as respostas de hoje, sem mudança.

Nenhuma das três afirma que a isenção já está aplicada. Quem libera é gente —
mesma regra de §6.1 da spec de 2026-09-26, e pela mesma razão: não há mecanismo
de cupom confirmado pelo cliente.

### 3.5 O que cada terminal grava

| id | etapa | tag | opt-out |
| --- | --- | --- | --- |
| `rtv:voltar` | **nada** — não é terminal | — | não |
| `rtv:problema` | `qualificado` | `rtv-teve-problema` | não |
| `rtv:sair` | intocada | `rtv-optout` | **grava** |
| `rtv2:preco` | `qualificado` | `rtv-motivo-preco` | não |
| `rtv2:tecnico` | `qualificado` | `rtv-motivo-tecnico` | não |
| `rtv2:duvida` | `qualificado` | `rtv-motivo-duvida` | não |

Segmento continua intocado em todos: a coorte nasce `artha` na importação.

---

## 4. As três variantes

Todas `MARKETING`, `pt_BR`, uma variável de corpo (primeiro nome), os três botões
de §3.1.

### 4.1 A — `mkt_rtv_isencao_01`

```
Oi, {{1}}. Você conectou seu banco no Artha e parou no meio do caminho.

Sua conta continua aqui, do jeito que você deixou.

A taxa de adesão de R$100 a gente tirou pra você voltar. O primeiro mês sai R$97
em vez de R$197, e a gente te acompanha na hora de reconectar.

Reconectar leva 2 minutos.
```

### 4.2 B — `mkt_rtv_trial_01`

```
Oi, {{1}}. Seu teste do Artha terminou e você não chegou a continuar.

Os bancos que você conectou continuam salvos, do jeito que você deixou.

Pra voltar, a gente tirou a taxa de adesão de R$100. O primeiro mês sai R$97 em
vez de R$197.

Retomar é de onde você parou, não do zero.
```

Fala do teste que a pessoa **teve**, no passado. Não promete teste novo nem
devolução — ver §6.1.

### 4.3 C — `mkt_rtv_pergunta_01`

```
Oi, {{1}}. Você sabe quanto gastou no mês passado?

O Artha responde isso em 1 segundo. Ele soma suas contas e cartões sozinho, sem
planilha nenhuma.

Você chegou a conectar seu banco e parou no meio do caminho. Sua conta continua
aqui.
```

É o gancho que o gestor propôs em 2026-09-02 e a fórmula dos títulos do canal do
cliente. Não traz a oferta no corpo: existe como braço de teste contra A e B, não
como substituto.

### 4.4 O que foi desenhado para a Meta aprovar

O pedido do gestor foi tentar as variantes de modo que sejam aprovadas. Os itens
abaixo são os que dependem de nós; o resto é critério da Meta.

- **Uma variável só, e nunca na borda.** A validação recusa corpo que abre ou
  fecha em parâmetro. As três abrem em `Oi, ` e fecham em ponto final.
- **Exemplo preenchido** para a variável (`["João"]`). Contagem de variáveis
  igual à de exemplos é checada por `validarTemplate` antes de gastar a chamada.
- **Nome só com minúsculas, números e underscore.**
- **Sem markdown e sem formatação.** Nenhuma das três usa asterisco, underscore
  ou cerquilha.
- **Três `QUICK_REPLY`**, dentro do teto de 3, cada título até 20 caracteres.
- **Nenhum botão URL**, que é onde mora o erro 132018 que esta conta já levou.
- **Corpo curto**, bem abaixo do teto de 1024 caracteres do corpo interativo.

Uma variável, e não duas: cada variável a mais é um campo a mais que a fila
precisa resolver por lead e uma razão a mais de recusa. `nome` é o único campo que
os 12 registros têm preenchido de forma confiável.

---

## 5. Implementação

### 5.1 `roteiro.ts` — dado novo, e uma distinção nova

O ramo passa a ter dois níveis, e o motor precisa saber qual id **abre** e qual
**fecha** — exatamente como já distingue `p1:artha` (abre a p2) de `p1:outro`
(encerra).

```ts
export const RTV2: Pergunta          // a pergunta de triagem
export const RTV2_POR_RTV1: Record<string, Pergunta>   // { 'rtv:voltar': RTV2 }
export function perguntaRtv2(idRtv1: string): Pergunta | null
export function ehIdRtv1(id: string | null): boolean
export function ehIdRtv2(id: string | null): boolean
export function ehIdRtv(id: string | null): boolean     // rtv1 OU rtv2
export function ehTerminalRtv(id: string | null): boolean
```

`ehTerminalRtv` é o conjunto `{ rtv:problema, rtv:sair, rtv2:* }`. **`rtv:voltar`
fica de fora** — é o que abre.

`RESPOSTA_POR_ID` perde `rtv:voltar` e ganha os três `rtv2:*`.
`TAG_POR_RESPOSTA` perde `rtv:voltar` e ganha os três.

### 5.2 `estado.ts` — três pontos, todos em consequência do nível 2

**a) O portão de estado terminal passa a olhar só terminais.** Hoje ele é
`ehIdRtv(m.button_id)`; vira `ehTerminalRtv(m.button_id)`. Sem isto, o toque em
`rtv:voltar` dispara o portão e o bot emudece no meio da própria triagem.

**b) A porta de campanha ramifica.**

```ts
if (ehIdRtv2(ultima.button_id)) {
  return { acao: 'encerrar', idP1: idRtv1, idP2: ultima.button_id, comFecho: true }
}
if (ehIdRtv1(ultima.button_id)) {
  const p = perguntaRtv2(ultima.button_id)
  if (p) return { acao: 'perguntar', pergunta: p }
  return { acao: 'encerrar', idP1: ultima.button_id, idP2: null, comFecho: true }
}
```

`idRtv1` é derivado do histórico pelo mesmo `reduce` que já deriva `idP1`.

**c) A repetição precisa conhecer a triagem.** Este é o ponto que quase passou.
Hoje o fallback de texto livre é `pendente = idP1 ? (perguntaP2(idP1) ?? P1) : P1`.
Quem apertou `rtv:voltar` e então **escreveu** em vez de tocar o segundo botão não
tem `idP1` nenhum — `rtv:voltar` não é id de p1 — e cairia na **P1 de
segmentação**. É a mesma família do defeito consertado hoje de manhã, num caminho
novo.

```ts
const pendente = idRtv1
  ? (perguntaRtv2(idRtv1) ?? P1)
  : idP1
    ? (perguntaP2(idP1) ?? P1)
    : P1
```

### 5.3 `executar.ts` — quem qualifica é o terminal

O cálculo atual é `ehIdRtv(passo.idP1) && passo.idP1 !== ID_OPTOUT`. Com o nível
2, o id que decide passa a estar em `idP2`.

```ts
const terminal = passo.idP2 ?? passo.idP1
const qualificar = ehTerminalRtv(terminal) && terminal !== ID_OPTOUT
```

`ehTerminalRtv` já exclui `rtv:voltar`, então quem para na triagem não é
qualificado — que é o pedido inteiro desta onda.

O opt-out continua no webhook, por `button_id === ID_OPTOUT`, sem mudança.

### 5.4 `templates.ts` — registro nomeado, e a falha vira alta

Hoje `componentesDeBotao` casa por prefixo `mkt_rtv` e devolve sempre os mesmos
três botões. Com três variantes isso precisa virar um registro, e há um defeito
conhecido para matar junto.

```ts
export const TEMPLATES_RTV: Record<string, RascunhoTemplate>
```

com as três variantes de §4. `componentesDeBotao(nome)` passa a ser **busca exata**
no registro; nome ausente devolve `[]`.

**A trava.** Um template cujo nome começa com `mkt_rtv` e **não** está no registro
é erro, não lista vazia: hoje ele sairia sem payload, a Meta usaria o título do
botão como id, e os leads voltariam todos para a P1 sem erro, sem log e sem teste
vermelho. Era o ponto único de falha do funil.

```ts
export function componentesDeBotao(nome: string): ComponenteEnvio[] {
  if (nome in TEMPLATES_RTV) {
    return RTV_BOTOES.map((b, index) => ({
      type: 'button' as const,
      sub_type: 'quick_reply' as const,
      index: String(index),
      parameters: [{ type: 'payload' as const, payload: b.id }],
    }))
  }
  if (nome.startsWith(PREFIXO_TEMPLATE_RTV)) {
    throw new Error(
      `componentesDeBotao: "${nome}" parece template de campanha mas não está em ` +
      `TEMPLATES_RTV. Sairia sem payload e o bot devolveria a P1 para a base inteira.`
    )
  }
  return []
}
```

O payload sai de **`RTV_BOTOES`**, não de `t.botoes`. São coisas diferentes: o
rascunho guarda `{ tipo, texto }`, que é a forma que a Meta aceita na criação, e
não carrega id nenhum. `RTV_BOTOES` é a lista `{ id, titulo }` que casa por
índice. As três variantes compartilham os mesmos botões (§3.1), então o registro
serve só para responder "este nome é de campanha?".

`TEMPLATES_RTV` fica em `roteiro.ts` **sem anotação de tipo**, como `TEMPLATE_RTV`
já está hoje. Anotar exigiria importar `RascunhoTemplate` de `templates.ts`, que
por sua vez importa valores de `roteiro.ts` — a tipagem estrutural resolve sozinha
e evita fechar o ciclo.

O `throw` sobe pelo `try/catch` que já existe em `src/server/fila.ts` e marca o
agendamento como falho com a mensagem, em vez de mandar a mensagem errada.

Isso alcança de propósito o `mkt_rtv_voce_sabe_01` que já está `APPROVED` na
conta: ele assina "Lúcia", não está no registro, e disparar ele à mão passa a
falhar alto em vez de quebrar o funil em silêncio.

### 5.5 `scripts/criar-template.ts` — submete as três

Passa a iterar `TEMPLATES_RTV` e submeter cada uma, com `validarTemplate` antes de
cada chamada. Imprime o resultado por variante e **não para na primeira recusa** —
uma recusa não pode impedir as outras duas de serem submetidas.

Aceita um nome como argumento para submeter só uma, útil para ressubmeter depois
de um ajuste sem recriar as que já foram aprovadas.

### 5.6 `fila.ts` — sem mudança

Ela já concatena `componentesDeBotao(a.template)` ao corpo e já tem o `try/catch`
que transforma erro em agendamento falho. Nada a fazer.

---

## 6. Mudanças de contrato

### 6.1 A frase do "teste" sai do corpo da variante A

O corpo aprovado em 2026-09-26 dizia *"Você conecta todos os seus bancos e testa
por um mês, com a nossa ajuda"*. Veio do argumento que o cliente mandou no
WhatsApp, onde "testar por 1 mês" é o primeiro mês **pago** de R$97 — o desconto é
a isenção da adesão, não gratuidade.

Lido por quem teve um trial que expirou, "testa por um mês" lê como novo período
grátis ou garantia de devolução. **`artha.ia.br` não vende trial em lugar nenhum**
(lido em 2026-09-26): só mensal e anual. O trial da planilha é estado legado do
banco do cliente, não oferta corrente.

A variante A passa a dizer *"e a gente te acompanha na hora de reconectar"*, que é
a parte verdadeira do argumento dele. A variante B fala do teste no passado.

**Se o cliente confirmar que existe garantia de devolução ou trial novo, as duas
frases voltam e ficam mais fortes. É troca de string.**

### 6.2 `qualificado` muda de significado no ramo de campanha

Antes: tocou em `rtv:voltar` ou `rtv:problema`. Agora: respondeu à triagem, ou
declarou um problema concreto. Quem toca em "Quero voltar" e abandona na triagem
fica **sem** qualificação — aparece na fila de atendimento, porque a última
mensagem é do bot, mas não conta como lead qualificado nos relatórios.

É a mudança pedida, e é uma quebra de comparabilidade: número de qualificados
antes e depois desta onda não se compara.

### 6.3 O nome do template deixa de ser string solta

`TEMPLATES_RTV` passa a ser a fonte única do nome, do corpo e dos botões. O script
de criação e o montador de payload leem do mesmo lugar, então renomear exige
editar o registro — e os dois acompanham por construção.

---

## 7. Critérios de aceitação

### 7.1 `src/lib/bot/roteiro.test.ts`

1. Todo id em `RTV_IDS` e nos botões de `RTV2` tem tag, **exceto** `rtv:voltar`.
2. Todo id para o qual `ehTerminalRtv` é true tem entrada em `RESPOSTA_POR_ID`; e
   `RESPOSTA_POR_ID['rtv:voltar']` é **ausente**. Um dos dois lados sozinho não
   basta: sem o segundo, deixar a resposta velha para trás passaria despercebido
   e o bot mandaria texto E pergunta no mesmo turno.
3. `ehTerminalRtv('rtv:voltar')` é **false**; para `rtv:problema`, `rtv:sair` e os
   três `rtv2:*` é **true**.
4. `perguntaRtv2('rtv:voltar')` devolve `RTV2`; para qualquer outro id, `null`.
5. Os títulos de `RTV2` cabem em 20 caracteres, e são 3.
6. Cada variante em `TEMPLATES_RTV` passa em `validarTemplate` com zero erros.
7. Nenhum corpo de variante abre ou fecha em `{{`/`}}`.
8. Cada variante tem exatamente uma variável e um exemplo.
9. Nenhuma copy do ramo cita Lúcia, Clara ou LucIA.
10. A copy do ramo não tem travessão, markdown, nem dois-pontos introduzindo
    frase, e todo link está sozinho na linha.
11. **Nenhum corpo de variante contém a palavra "grátis", "gratuito", "teste
    grátis" ou "devolução".** Trava a §6.1 contra reintrodução.

### 7.2 `src/lib/bot/estado.test.ts`

12. `[disparo, rtv:voltar]` devolve `{ acao: 'perguntar', pergunta: RTV2 }` — **e
    não** `encerrar`. É o teste que prova a triagem existindo.
13. `[disparo, rtv:voltar, bot, rtv2:preco]` devolve
    `{ acao: 'encerrar', idP1: 'rtv:voltar', idP2: 'rtv2:preco', comFecho: true }`.
14. `[disparo, rtv:voltar, bot, rtv2:preco, bot, texto]` devolve `calar`.
15. `[disparo, rtv:voltar, bot, texto livre]` devolve
    `{ acao: 'repetir', pergunta: RTV2 }` — **não** a P1. É o teste do §5.2c.
16. `[disparo, rtv:problema]` e `[disparo, rtv:sair]` continuam encerrando em um
    toque.
17. Os testes **24, 25, 27, 28, 29, 33, 34, 35, 36, 37 e 38** continuam verdes.
    São a porta orgânica, a regra do operador humano, o template sem payload
    nosso, e os quatro que provam o estado terminal consertado hoje de manhã. O
    35 e o 36 são os mais sensíveis a esta onda: eles afirmam que texto livre
    depois de um terminal `rtv` cala, e o portão que garante isso é justamente o
    que muda em §5.2a.

### 7.3 `src/lib/templates.test.ts`

18. `componentesDeBotao` devolve três `quick_reply` para cada nome de
    `TEMPLATES_RTV`, com os payloads de `RTV_BOTOES` nos índices `'0'`, `'1'`,
    `'2'`.
19. `componentesDeBotao('modelo_teste')` devolve `[]`.
20. `componentesDeBotao('mkt_rtv_voce_sabe_01')` **lança**, com mensagem que cita
    `TEMPLATES_RTV`.

### 7.4 Verificação manual

21. `npm run lint`, `npx tsc --noEmit`, `npm test` e `npm run build` limpos, uma
    vez só, no fim.
22. `npm run criar:template` submete as três e imprime o resultado de cada uma,
    sem parar na primeira recusa.
23. Disparo de uma variante para o número do gestor. Apertar **Quero voltar** →
    chega a triagem, e o lead **não** está `qualificado` ainda. Apertar **Foi o
    preço** → chega a resposta, o lead vira `qualificado` com
    `rtv-motivo-preco`, e a conversa entra na fila.
24. Apertar **Não quero receber** noutra conversa → `optout_em` preenchido, e uma
    segunda campanha não enfileira o lead.

---

## 8. Riscos aceitos

- **Uma etapa a mais é uma etapa a mais para abandonar.** Quem toca em "Quero
  voltar" e some na triagem não é qualificado, e antes seria. É o preço de a
  palavra significar alguma coisa, e foi decisão explícita do gestor.
- **Três templates é três esperas de aprovação da Meta.** Nenhuma bloqueia as
  outras; o script submete as três numa passada.
- **A conversa continua na fila de atendimento depois do opt-out**, pela mesma
  razão registrada em 2026-09-26. Não muda aqui.
- **Opt-out segue sendo por botão, não por texto.**

---

## 9. Arquivos tocados

| Arquivo | Mudança |
| --- | --- |
| `src/lib/bot/roteiro.ts` | `RTV2`, `perguntaRtv2`, `ehIdRtv1/2`, `ehTerminalRtv`, `TEMPLATES_RTV` com as três variantes, respostas e tags |
| `src/lib/bot/roteiro.test.ts` | critérios 1–11 |
| `src/lib/bot/estado.ts` | portão terminal olha `ehTerminalRtv`; porta de campanha ramifica; `pendente` conhece a triagem |
| `src/lib/bot/estado.test.ts` | critérios 12–17 |
| `src/lib/templates.ts` | `componentesDeBotao` por registro, com `throw` para `mkt_rtv` desconhecido |
| `src/lib/templates.test.ts` | critérios 18–20 |
| `src/server/bot/executar.ts` | `qualificar` decide pelo terminal (`idP2 ?? idP1`) |
| `scripts/criar-template.ts` | itera `TEMPLATES_RTV`, aceita um nome como argumento |
| `ROADMAP.md` | a mudança de significado de `qualificado` e a correção da frase do teste |
