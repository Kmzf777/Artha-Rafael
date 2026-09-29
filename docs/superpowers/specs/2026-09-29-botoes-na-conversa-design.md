# Botões na conversa — design

**Data:** 2026-09-29
**Estado:** desenhado no brainstorming de 2026-09-29, aprovado pelo gestor na
mesma sessão

---

## 1. De onde isto vem

O gestor, literal: *"em conversas, as mensagens enviadas pelo bot de botão não
mostra as opções de botão que foram enviadas ao lead, para quem está usando o
crm fica confuso"*.

Ele tem razão, e a investigação achou **dois** defeitos com o mesmo sintoma.

### 1.1 O bot nunca gravou os botões

`gravarSaida` em `src/server/bot/executar.ts` grava `content` e mais nada. Os
botões que foram para o WhatsApp não existem no banco. Quem atende vê a pergunta
e, logo abaixo, a resposta do lead — sem saber quais eram as opções nem quantas
havia.

### 1.2 O disparo grava o NOME do template no lugar do texto

`src/server/fila.ts` faz `content: a.template`. `MediaLabel` não trata
`template` e cai no `default`, que imprime o conteúdo cru. Ou seja: no momento em
que a campanha sair, o operador vai ver uma mensagem cujo texto é
`mkt_rtv_isencao_01`, e o card da lista de conversas vai mostrar o mesmo slug
como última mensagem.

Pior: `mapearDisparos` tenta casar o template comparando `corpoCasa(t.corpo,
msg.content)` — o **corpo** contra o **nome**. Nunca casa. Então o caminho de
botões que já existe para template também nunca dispara.

### 1.3 O renderizador já está pronto

`MessageBubble` desenha os botões como linhas sob a bolha, marca o clicado com
✓, e recua os demais por opacidade em vez de cor — fiel à régua "estado é cinza
+ ícone + rótulo, nunca matiz". Nada disso precisa ser desenhado de novo. Falta
alimentar.

---

## 2. Escopo

### Entra

1. **Régua nova e testada** que resolve, para cada bolha, quais botões foram
   oferecidos e qual foi tocado.
2. **Perguntas do bot** passam a mostrar seus botões, retroativamente, em todo o
   histórico já gravado.
3. **Disparo passa a gravar o texto que o lead recebeu**, com as variáveis
   substituídas, no lugar do nome do template.
4. **A bolha desenha botões para qualquer tipo**, não só `template`.

### Não entra

- Coluna nova, migration, ou gravar botão no banco. Ver §3.1.
- Mexer no desenho da bolha. Ele já está certo.
- Mostrar legenda de "resposta ao botão" para toque em mensagem interativa. Com
  os botões visíveis na pergunta acima, o contexto já se lê.
- Trocar copy do roteiro. Ver §4.2 — a ambiguidade é resolvida por dado de
  conversa, não reescrevendo a pergunta.

---

## 3. A decisão de fundo

### 3.1 Derivar do roteiro, não gravar

Decisão do gestor nesta sessão, contra gravar os botões em `raw_payload`.

O corpo de uma pergunta do bot é **string literal exata** — diferente do
template, não tem variável. Então casar `content` contra as perguntas conhecidas
é igualdade de string, não heurística.

O que a derivação ganha: **conserta o histórico inteiro que já está no banco**.
Gravar no envio só valeria para mensagem nova, e as conversas que o operador tem
na tela hoje continuariam mudas.

O que ela custa: se a copy do roteiro mudar, a mensagem antiga deixa de casar e
volta a não mostrar botão. **Nunca mostra botão errado** — o modo de falha é o
comportamento de hoje, nunca uma mentira. É o mesmo padrão que o código já usa
para template, então também não introduz idioma novo.

---

## 4. A régua

Arquivo novo: `src/lib/botoesDaConversa.ts`. Puro, sem I/O, testado.

`mapearDisparos` sai de dentro de `MessageTimeline.tsx` e vem para cá. Não é
refatoração de passagem: a função muda substancialmente, e o `CLAUDE.md` manda
que regra pura e testada more em `src/lib/`.

```ts
export type BotoesDaBolha = {
  /** Rótulos na ordem em que foram oferecidos. */
  rotulos: string[]
  /** O rótulo que o lead tocou, quando tocou. */
  clicado: string | null
  /** Nome do template, quando a bolha é um disparo. `null` para o bot. */
  nomeTemplate: string | null
}

export function mapearBotoes(
  mensagens: Message[],
  templates: Template[]
): Map<string, BotoesDaBolha>
```

Duas fontes, resolvidas por tipo de mensagem.

### 4.0 O tipo de fio precisa declarar dois campos que já chegam

`Message` em `src/lib/conversationTypes.ts` não declara `enviado_por` nem
`button_id`. **Os dois já chegam ao cliente**: `mensagensDoCard` faz
`select('*')`, então as colunas viajam na resposta da rota e simplesmente não
estão tipadas.

Sem `enviado_por` não há como aplicar a guarda de autoria de §4.1, e sem
`button_id` não há como casar o clicado por id em §4.3. Os dois entram no tipo:

```ts
  /** Nome do humano, `'bot'`, ou null quando ninguém está identificado. */
  enviado_por: string | null
  /** Id do botão tocado. Só em mensagem de entrada. */
  button_id: string | null
```

**Obrigatórios, não opcionais.** As colunas existem em toda linha e o `select('*')`
sempre as traz; declará-las opcionais tornaria `undefined` um estado possível que
o banco nunca produz. O custo é três literais de `Message` que precisam dos
campos novos — `src/lib/timeline.test.ts`, `src/mock/store.ts` e o otimista de
`src/hooks/useMessageSender.ts`. Três edições de uma linha cada.

É diferente de `Lead.optoutEm`, que ficou opcional porque `src/mock/db.ts`
constrói 760 leads sem a chave. Aqui são três.

### 4.1 Pergunta do bot

Alcança `direction === 'outbound' && message_type === 'interactive' &&
enviado_por === AUTOR_BOT`.

A guarda por autoria importa: ela exclui mensagem interativa mandada à mão ou por
script de teste, que não é pergunta de roteiro e não deve ganhar botões
inventados.

O corpo aparece em duas formas no banco, e as duas são conhecidas:

- **primeira vez** — `pergunta.corpo`
- **repetição** — `` `${REPETICAO}\n\n${pergunta.corpoRepetido}` ``

exatamente como `executar.ts` as monta.

### 4.2 A ambiguidade da repetição, e como se resolve

`P2_POR_RAMO['p1:artha'].corpoRepetido` e `P2_POR_RAMO['p1:dhana'].corpoRepetido`
são **a mesma string**: `'O que você quer saber?'`. Os botões, não:

| ramo | botões |
| --- | --- |
| artha | Como funciona · Preços · Quero começar |
| dhana | Como funciona · Ver demonstração · Falar com alguém |

Casar só por texto mostraria os botões da Dhana para quem está no ramo Artha.
Isso é mentira na tela, e o projeto não admite.

A desambiguação usa o mesmo sinal que `estado.ts` usa: **o último `p1:*`
respondido antes daquela bolha**. A régua percorre as mensagens em ordem e
carrega esse id, como `proximoPasso` já faz com `idP1`.

```
corpo bate exatamente uma pergunta        → usa ela
corpo é repetição e bate exatamente uma   → usa ela
corpo é repetição e bate mais de uma      → desempata pelo último p1:* visto
nenhuma das anteriores                    → sem botões
```

O último caso é o que garante que a falha seja muda, nunca errada.

### 4.3 O clicado vem do id, não do texto

Para pergunta do bot: o **próximo inbound** depois da bolha cujo `button_id`
está entre os ids daquela pergunta. O rótulo mostrado é o `titulo` do botão
correspondente, não o `content` da mensagem do lead.

**Id é contrato, título é copy** — é a regra que `roteiro.ts` já declara no
cabeçalho. Casar pelo id deixa a marcação imune a troca de rótulo, e é mais forte
que o caminho de template, que só conhece títulos.

### 4.4 Disparo de template

Alcança `message_type === 'template'`. Continua casando o corpo contra o cache de
templates por `corpoCasa`, que já existe e trata o `{{1}}`. O clicado continua
casando por texto, porque ali só se conhecem os títulos — a Meta manda o título
como conteúdo da mensagem de botão.

Isto **passa a funcionar** por causa de §5, não por mudança na régua.

---

## 5. O disparo grava o texto, não o nome

`src/server/fila.ts` troca `content: a.template` pelo corpo renderizado.

**Por que:** o CRM existe para mostrar a conversa como ela aconteceu. O lead
recebeu um texto; mostrar um slug no lugar dele é o defeito de §1.2. E é o que
torna o casamento de §4.4 possível, devolvendo os botões que o renderizador já
sabe desenhar.

A fila conhece o nome, não o corpo. `listarTemplates()` já existe em
`src/server/repo/templates.ts` e devolve `Template[]` com `corpo`. A fila passa a
lê-lo **uma vez por lote**, não por agendamento, e monta um índice nome → corpo.

Função nova, pura e testada, em `src/lib/templates.ts`:

```ts
export function renderizarCorpo(corpo: string, variaveis: string[]): string
```

Substitui `{{1}}`, `{{2}}`… pelo valor de mesma posição. Variável sem valor
correspondente fica como está — some-la produziria um texto que não é o que o
lead recebeu, e o ponto inteiro desta seção é a tela dizer a verdade.

**Degradação:** template ausente do cache local (sync não rodado) deixa `content`
com o nome, como hoje. A bolha cai no "Template de campanha" que já existe. Pior
que o ideal, igual ao presente, nunca mentira.

**Contrato de dado:** mensagem antiga continua com o nome, nova passa a ter o
texto. A régua de §4.4 resolve cada uma pelo que ela tem. Não há migração de
dado histórico, e não vale a pena: nenhuma campanha real saiu ainda pela fila.

---

## 6. A bolha

`src/components/MessageBubble.tsx`, duas mudanças pequenas.

A lista de botões hoje só desenha sob `ehTemplate && botoesTemplate`. Passa a
desenhar sempre que houver rótulos, seja a bolha `template` ou `interactive`.

A prop `botoesTemplate` vira `botoes`, e `nomeTemplate` continua como está. O
nome antigo virou mentira quando a lista deixou de ser exclusiva de template.

A legenda "Template · nome" continua condicionada a `ehTemplate`. Pergunta do bot
não ganha legenda: ela é obviamente do bot pela polaridade da bolha, e uma
etiqueta a mais só polui.

`src/components/conversations/MessageTimeline.tsx` perde `mapearDisparos` e
`corpoCasa` (que vão para `src/lib/`) e passa a chamar `mapearBotoes`.

---

## 7. Critérios de aceitação

### 7.1 `src/lib/botoesDaConversa.test.ts`

1. Bolha do bot com o corpo de `P1` devolve os três rótulos de `P1`, na ordem.
2. Bolha do bot com `` `${REPETICAO}\n\n${P1.corpoRepetido}` `` devolve os mesmos
   três rótulos.
3. Repetição do nível 2 **depois de `p1:artha`** devolve os botões do ramo Artha.
4. A **mesma** repetição, depois de `p1:dhana`, devolve os botões do ramo Dhana.
   Os testes 3 e 4 são o par que prova §4.2; um sozinho não prova nada.
5. Repetição do nível 2 **sem nenhum `p1:*` antes** não devolve botões.
6. Bolha do bot com corpo desconhecido não devolve botões.
7. Mensagem interativa com `enviado_por` diferente de `bot` não devolve botões,
   mesmo que o corpo case.
8. `clicado` é o título do botão cujo **id** casa o `button_id` do próximo
   inbound.
9. `clicado` é `null` quando o próximo inbound não tem `button_id` conhecido.
10. Bolha `template` cujo corpo casa um template do cache devolve os botões e o
    `nomeTemplate`.
11. Bolha `template` cujo corpo não casa nada não devolve botões.

### 7.2 `src/lib/templates.test.ts`

12. `renderizarCorpo('Oi, {{1}}.', ['Rafael'])` devolve `'Oi, Rafael.'`.
13. Duas variáveis são substituídas por posição.
14. Variável sem valor correspondente permanece literal no texto.
15. Corpo sem variável devolve o próprio corpo.

### 7.3 Verificação manual

16. `npm run lint`, `npx tsc --noEmit`, `npm test` e `npm run build` limpos, uma
    vez só, no fim.
17. Abrir Conversas na conversa de teste e ver, sob a pergunta do bot, os três
    botões, com o tocado marcado.
18. Conferir que a bolha de pergunta continua legível nos dois temas, e que o
    alvo de toque das linhas de botão segue em 44px.

---

## 8. Arquivos tocados

| Arquivo | Mudança |
| --- | --- |
| `src/lib/conversationTypes.ts` | `Message` ganha `enviado_por` e `button_id` |
| `src/lib/timeline.test.ts` | os dois campos no literal de mensagem |
| `src/mock/store.ts` | os dois campos no literal de mensagem |
| `src/hooks/useMessageSender.ts` | os dois campos na mensagem otimista |
| `src/lib/botoesDaConversa.ts` | novo — `mapearBotoes`, `corpoCasa` |
| `src/lib/botoesDaConversa.test.ts` | novo — critérios 1–11 |
| `src/lib/templates.ts` | `renderizarCorpo` |
| `src/lib/templates.test.ts` | critérios 12–15 |
| `src/server/fila.ts` | grava o corpo renderizado; lê templates uma vez por lote |
| `src/components/MessageBubble.tsx` | desenha botões para qualquer tipo; `botoesTemplate` → `botoes` |
| `src/components/conversations/MessageTimeline.tsx` | usa `mapearBotoes`; perde as funções locais |
| `ROADMAP.md` | registro |
