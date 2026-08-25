# URA de respostas — design

**Data:** 2026-08-25
**Estado:** desenhado no brainstorming de 2026-08-25, aprovado pelo gestor na mesma sessão

---

## 1. De onde isto vem

O bot de qualificação subiu em 2026-08-24 e funciona: dois níveis de botão, id
como contrato, estado derivado do histórico, trava de concorrência. A mecânica
está certa.

O que está errado é o que ele entrega. Os sete finais do roteiro caem todos na
mesma frase:

> Perfeito, obrigado! Já passei para a equipe da Artha — em instantes alguém te
> responde por aqui.

Aperta X, sai "espera um humano". Isso é um formulário de triagem com cara de
URA. O botão coleta dado para a operação e não devolve nada para quem apertou,
e quem apertou continua na fila igual a quem não apertou nada.

O pedido do gestor, literal: *"só quero melhorar ele, fazer uma URA decente,
aperta X sai X e é isso, apenas"*.

---

## 2. Escopo

### Entra

1. **Árvore nova** — o nível 2 deixa de perguntar o que interessa à operação e
   passa a perguntar o que a pessoa quer saber.
2. **Resposta por botão** — cada id terminal entrega texto próprio. Só quem
   escolhe falar com alguém, e quem escreve texto livre, vai para o humano.
3. **Correção de preço no `CLAUDE.md`** — ver §6.2.

### Não entra

- IA de qualquer natureza. O roteiro continua fixo e determinístico.
- Navegação. Não há "voltar ao menu" e não há grafo com ciclo. A resposta sai e
  o bot cala, que é a decisão do gestor em §4.3.
- Mudança em `src/lib/bot/estado.ts`. Ver §4.1 — o motor já serve.
- Tela, rota, migration, coluna nova. Nada de banco muda.
- Bot outbound, campanha de reativação, opt-out, importação de base. Foram
  desenhados nesta mesma sessão e cortados pelo gestor antes da spec.

---

## 3. A árvore

Voz institucional. Nenhum nome de persona — a regra do `CLAUDE.md` continua
valendo e o cliente ainda não escolheu entre Lúcia, Clara e LucIA.

Copy sem travessão, sem dois-pontos introduzindo frase, sem markdown, e com link
sozinho na linha. São as regras de escrita que o gestor passou nesta sessão.

### 3.1 Menu 1

```
Oi! Aqui é da Artha. Me diz o que você procura.
```

| id | título | destino |
| --- | --- | --- |
| `p1:artha` | Minhas finanças | menu 2 Artha |
| `p1:dhana` | Sou planejador | menu 2 Dhana |
| `p1:outro` | Falar com alguém | encaminha |

**Os três ids de nível 1 não mudam.** `p1:outro` troca de título — era "Outro
assunto" — e o roteamento é idêntico: termina e encaminha. Título é copy, id é
contrato, e o contrato fica de pé.

### 3.2 Menu 2 — ramo Artha

```
Boa. O que você quer saber?
```

| id | título | entrega |
| --- | --- | --- |
| `p2:artha_como` | Como funciona | resposta |
| `p2:artha_preco` | Preços | resposta |
| `p2:artha_comecar` | Quero começar | resposta com link |

Não há botão de humano neste menu porque não cabe um quarto botão, e os três
que estão ali valem mais. A saída para gente existe no menu 1, e as respostas
terminam convidando a escrever.

### 3.3 Menu 2 — ramo Dhana

```
Certo. O que você quer saber?
```

| id | título | entrega |
| --- | --- | --- |
| `p2:dhana_como` | Como funciona | resposta |
| `p2:dhana_demo` | Ver demonstração | encaminha |
| `p2:humano` | Falar com alguém | encaminha |

Dhana não tem botão de preço. O site da Artha não publica valor de Dhana em
lugar nenhum, e o repositório também não tem. Inventar número aqui é pior que
não responder, então quem quer preço de Dhana chega em gente.

### 3.4 As respostas

`p2:artha_como`

```
A Artha conecta seus bancos, cartões e investimentos uma vez e atualiza tudo
sozinha, todo dia.

Suas contas de várias instituições ficam num lugar só, sem planilha e sem
digitar nada.
```

`p2:artha_preco`

```
No plano mensal são R$197 no primeiro mês e R$97 por mês depois. Os R$100 da
entrada são a taxa de adesão.

No anual são R$997 pagos de uma vez, sem adesão.
```

`p2:artha_comecar`

```
Ótimo. É por aqui.

https://artha.ia.br

Você conecta seus bancos por lá. Se travar em algum passo, é só escrever aqui.
```

`p2:dhana_como`

```
A Dhana é a plataforma que você usa para acompanhar seus clientes. Cada um
conecta as contas dele e você enxerga a carteira inteira num lugar só, sem pedir
extrato para ninguém.
```

### 3.5 Quem encaminha

`p1:outro`, `p2:dhana_demo` e `p2:humano` não têm resposta própria. Recebem o
fecho, que perde o travessão:

```
Perfeito, obrigado! Já passei para a equipe da Artha, e em instantes alguém te
responde por aqui.
```

### 3.6 O que o bot grava

Sem mudança de mecânica. `SEGMENTO_POR_P1` continua mapeando só `p1:artha` e
`p1:dhana`, e `qualificarLead` continua marcando `stage: 'qualificado'` só
quando há segmento. `TAG_POR_RESPOSTA` ganha as tags novas:

| id | tag |
| --- | --- |
| `p1:outro` | `quer-humano` |
| `p2:artha_como` | `quer-saber-como` |
| `p2:artha_preco` | `quer-saber-preco` |
| `p2:artha_comecar` | `quer-comecar` |
| `p2:dhana_como` | `dhana-quer-saber-como` |
| `p2:dhana_demo` | `dhana-quer-demo` |
| `p2:humano` | `quer-humano` |

A qualificação não se perde na troca. O nível 2 deixou de perguntar o que
interessa à operação, mas "o que a pessoa quis saber" qualifica igual, e às
vezes melhor: quem apertou "Quero começar" vale mais que quem respondeu "já
testei".

---

## 4. Implementação

### 4.1 `estado.ts` não é tocado

O motor devolve `{ acao: 'encerrar', idP1, idP2, comFecho }` e não decide texto
nenhum. Quem escolhe a mensagem é `executar.ts`, que hoje manda `FECHO` sempre.
Entregar resposta por botão é trocar essa constante por uma consulta.

Isso vale ser dito porque a tentação era o contrário. `proximoPasso` sustenta 28
testes e carrega as regras que o cliente comprou — operador que fala desliga o
bot, reentrega da Meta não duplica, id desconhecido entrega em silêncio. Mexer
nele para trocar copy seria refatoração de passagem no arquivo mais delicado do
projeto, e não há um caso em que seja preciso.

### 4.2 Os arquivos

| Arquivo | Mudança |
| --- | --- |
| `src/lib/bot/roteiro.ts` | árvore nova, `RESPOSTA_POR_ID`, `IDS_QUE_ENCAMINHAM`, `mensagemTerminal`, `corpoRepetido`, tags |
| `src/server/bot/executar.ts` | duas linhas: a mensagem terminal e o corpo da repetição |
| `src/lib/bot/roteiro.test.ts` | invariantes da §5.1 |
| `src/lib/bot/estado.test.ts` | troca mecânica dos ids `p2:` nos fixtures |
| `CLAUDE.md` | correção de preço da §6.2 |
| `ROADMAP.md` | registro da entrega e a dívida da §6.1 |

Nenhum outro arquivo. Sem migration, sem rota, sem componente.

### 4.3 A escolha da mensagem

A escolha é uma função pura em `roteiro.ts`, não um `??` solto dentro do
executor. Assim ela é testável sem banco, sem Meta e sem `server-only`, que é
onde `executar.ts` mora.

```ts
export function mensagemTerminal(idP1: string | null, idP2: string | null): string {
  const id = idP2 ?? idP1
  return (id ? RESPOSTA_POR_ID[id] : undefined) ?? FECHO
}
```

`idP2 ?? idP1` porque `p1:outro` termina no nível 1 e não tem `idP2`. O
fallback para `FECHO` cobre os três ids que encaminham e qualquer id que entre
na árvore sem resposta. Falha para o lado seguro, que é a frase de espera, e
nunca para o silêncio.

`executar.ts` passa a chamar `mensagemTerminal(passo.idP1, passo.idP2)` no lugar
da constante `FECHO`. A ordem não muda: a qualificação continua vindo antes do
envio, pela razão que já está comentada lá. A resposta é cortesia, a
qualificação é o produto.

### 4.4 A repetição parava de fazer sentido

`REPETICAO` é prefixada ao corpo da pergunta pendente quando a pessoa escreve
texto livre em vez de apertar. Com o menu 1 abrindo em "Oi! Aqui é da Artha", a
repetição virava um segundo "Oi!" na mesma conversa, três mensagens depois da
primeira. Isso já acontece hoje e é exatamente o tipo de coisa que faz a URA
parecer quebrada.

`Pergunta` ganha um campo `corpoRepetido`, que é o mesmo texto sem a saudação. O
executor usa `passo.pergunta.corpoRepetido` quando a ação é `repetir`. Continua
sendo dado no roteiro, e uma linha no executor.

**O campo é obrigatório, não opcional.** Nasceu opcional, com
`corpoRepetido ?? corpo` no executor, e a revisão de qualidade apontou que
opcional queria dizer que uma pergunta nova entrar no roteiro sem ele traria a
saudação repetida de volta em silêncio, que é exatamente a regressão que o campo
existe para matar. Obrigatório, o compilador cobra. Quando o corpo não tiver
saudação, repetir o mesmo texto no campo é uma linha de ruído, e é o preço certo.

| | primeira vez | na repetição |
| --- | --- | --- |
| menu 1 | Oi! Aqui é da Artha. Me diz o que você procura. | O que você procura? |
| menu 2 | Boa. O que você quer saber? | O que você quer saber? |

### 4.5 Ids em voo no deploy

Os ids de nível 2 mudam todos. Quem estiver entre o menu 2 e a resposta no
instante do deploy vai tocar um botão cujo id não existe mais.

Isso já está resolvido e não precisa de código. `ehIdConhecido` devolve false,
`proximoPasso` cai em `{ encerrar, comFecho: false }`, e o lead é entregue ao
humano em silêncio, com o segmento preservado se a p1 já tinha sido respondida.
O bot não repete pergunta e não some. É a degradação que o teste 21 de
`estado.test.ts` já trava.

Vale o registro porque a alternativa — manter os ids velhos vivos num mapa de
compatibilidade — custaria código permanente para uma janela de segundos.

---

## 5. Critérios de aceitação

### 5.1 `src/lib/bot/roteiro.test.ts`

Além dos testes que já existem e continuam valendo:

1. **Todo id terminal ou responde, ou encaminha.** A lista de terminais é
   derivada da árvore, não escrita à mão: botão de p1 sem ramo em `P2_POR_RAMO`,
   mais todos os botões das p2. Cada um tem de estar em `RESPOSTA_POR_ID` ou em
   `IDS_QUE_ENCAMINHAM`.
2. **`RESPOSTA_POR_ID` e `IDS_QUE_ENCAMINHAM` são disjuntos.** Um id nos dois seria copy
   morta, e é o defeito que passa despercebido numa revisão de texto.
3. **Nenhuma resposta passa de 4096 caracteres**, que é o teto de corpo de
   mensagem de texto da Cloud API. As perguntas continuam limitadas a 1024, que
   é o teto do corpo interativo.
4. **Nenhuma copy da árvore contém travessão nem meia-risca** (`—` U+2014, `–`
   U+2013). É a regra de escrita do gestor e é verificável. Vale para perguntas,
   respostas, fecho e repetição. Hífen comum não conta.
5. **`RESPOSTA_POR_ID` e `IDS_QUE_ENCAMINHAM` só falam de ids terminais.** Um id de menu
   ou um id que não existe mais na árvore vira copy órfã que ninguém vê.
6. **`mensagemTerminal` devolve a resposta do nível 2, cai no nível 1 quando não
   há nível 2, e devolve `FECHO` para quem encaminha e para id desconhecido.**
   Nunca devolve vazio.
7. Os limites que já são testados continuam: no máximo 3 botões, título de no
   máximo 20 caracteres, corpo de pergunta de no máximo 1024, ids únicos em toda
   a árvore, e toda resposta terminal com tag.

### 5.2 `src/lib/bot/estado.test.ts`

Os 28 testes passam com os ids novos. **Nenhuma asserção de comportamento
muda** — se algum teste precisar de lógica diferente para passar, o motor foi
tocado sem querer e a mudança está errada.

### 5.3 Verificação manual

Com `!reset` limpando o telefone entre as passadas:

1. `Minhas finanças` → `Preços` devolve o texto de preço, e o lead fica
   `segmento: artha`, `stage: qualificado`, tag `quer-saber-preco`.
2. `Minhas finanças` → `Quero começar` devolve o link clicável e sozinho na
   linha.
3. `Sou planejador` → `Ver demonstração` devolve o fecho, e o lead fica
   `segmento: dhana`, tag `dhana-quer-demo`.
4. `Falar com alguém` no menu 1 devolve o fecho sem passar por menu 2.
5. Texto livre no lugar do botão repete a pergunta uma vez, e na segunda entrega
   ao humano em silêncio. Comportamento de hoje, tem de continuar.

### 5.4 Portões

`npm run lint`, `npx tsc --noEmit` e `npm test` limpos. `npm run build` limpo.

---

## 6. Mudanças de contrato

### 6.1 O bot passa a afirmar preço

Até aqui o bot só perguntava. A partir daqui ele afirma um valor comercial para
uma pessoa real, e errar isso é reclamação, não bug.

A fonte é `https://artha.ia.br`, lido em 2026-08-25. Quando o preço mudar no
site, esta string tem de mudar junto, e não há nada automático ligando os dois.
Fica registrado como dívida no ROADMAP.

### 6.2 O `CLAUDE.md` estava errado sobre preço

O `CLAUDE.md` diz "R$97/mês ou R$997/ano". O site diz R$197 no primeiro mês,
R$97 nos seguintes, porque há **taxa de adesão de R$100** que o `CLAUDE.md`
omite.

A tabela de produtos do `CLAUDE.md` é corrigida nesta mudança. Ela foi escrita
como contexto de demo, quando nenhum número saía para fora; agora é fonte de
copy que chega em cliente, e a omissão vira erro de preço.

### 6.3 O nível 2 deixa de ser pergunta de qualificação

Era "Você já usou a Artha?" e "Quantos clientes você atende hoje?". Passa a ser
"O que você quer saber?".

A operação perde a resposta direta sobre carteira do planejador e sobre estágio
do usuário B2C. Ganha a intenção declarada, que é o que decide a conversa
seguinte. Se a carteira do planejador voltar a ser necessária, ela cabe numa
pergunta do humano que já vai atender aquele lead, e não custa um nível de
árvore para todo mundo.

---

## 7. Arquivos tocados

```
src/lib/bot/roteiro.ts          reescrito (dado, não lógica)
src/lib/bot/roteiro.test.ts     invariantes da §5.1
src/lib/bot/estado.test.ts      ids novos nos fixtures
src/server/bot/executar.ts      4 linhas na escolha da mensagem
CLAUDE.md                       preço da Artha
ROADMAP.md                      registro desta entrega e a dívida da §6.1
```
