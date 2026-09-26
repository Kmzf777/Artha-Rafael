# Funil de retomada — design

**Data:** 2026-09-26
**Estado:** desenhado no brainstorming de 2026-09-26, ângulo do template aprovado
pelo gestor na mesma sessão

---

## 1. De onde isto vem

Há uma dívida de 17 dias com o cliente, e ela tem data e texto.

Reunião de 2026-09-02 (16 min, Rafael Reis e Rafael Recidive, sem o Kelwin).
Três decisões saíram de lá:

1. **Foco só em Artha.** Dhana tem menos lead e fica para depois. Literal do
   cliente: *"vamos focar só na Artha, depois a gente…"*.
2. **O trabalho é ativo.** *"a gente vai disparar primeiro para nossa base"*.
   O eixo volta a ser outbound, não atendimento de quem chega.
3. **O bot entrega, não atende.** *"o robozinho atende sozinho e passa para mim
   só se tiver os critérios que a gente define"*.

E uma promessa do nosso lado, literal: *"eu vou montar os funis aqui pensando
nas mensagens, vou te mandar"*.

WhatsApp de 2026-09-08 e 09. O cliente entregou a planilha
`trial_expirado-com-open-finance.xlsx` e, mais importante, **definiu a oferta**:

> usuários em trial ou trial expirado essa semana que já conectaram pelo menos 1
> conta. É um publico muito bom porque o cara ja conectou um banco, já gerou
> custo para nós e não comprou por algum motivo.. então podemos oferecer um
> cupom de isenção da taxa de adesão 100,00. de 197 por 97 no primeiro mes
>
> o argumento é: você poderá conectar todos os seus bancos e testar por 1 mês,
> além de ter a nossa ajuda durante esse período

Resposta nossa: *"vou adaptar o funil pra isso… te mando pra testar… ai podemos
iniciar os disparos com os leads"*. Ele: *"ok"*. Nada saiu desde então.

**Este escopo já foi desenhado uma vez.** A spec de 2026-08-25 §2 diz, em
"Não entra": *"Bot outbound, campanha de reativação, opt-out, importação de
base. Foram desenhados nesta mesma sessão e cortados pelo gestor antes da
spec."* O corte valia quando não havia base. Agora há 12 linhas na planilha e
uma oferta fechada.

---

## 2. O que a pesquisa de 2026-09-26 mudou

Duas fontes lidas em 2026-09-26, com navegador.

### 2.1 `artha.ia.br`

O preço confere com `RESPOSTA_POR_ID['p2:artha_preco']`: R$197 no primeiro mês
(R$97 + R$100 de adesão), R$97 depois, R$997 anual sem adesão. A string continua
correta e não muda nesta onda.

Duas informações novas:

- **O site não vende trial em lugar nenhum.** A coorte da planilha vem de um
  trial que saiu da página. A copy não pode dizer "seu teste acabou" como se o
  produto ainda oferecesse teste.
- **Os dois planos listam "Assistente Clara IA via WhatsApp"** como feature. O
  cliente já se comprometeu publicamente com o nome **Clara** — para a
  assistente DENTRO do produto. Ver §6.2.

### 2.2 Canal do YouTube `@rafaelrecidive`

33,7 mil inscritos, **1,9 mil vídeos, 11 anos de canal**. Não é lançador de
infoproduto; é educador financeiro de carreira longa. Os vídeos mais vistos são
utilidade pura para público leigo: *Seguro Prestamista - O Seguro que Você Tem e
Não Sabe* (162 mil), *Como funciona o reembolso de compra no cartão de crédito*
(120 mil), *COMO CONSULTAR O SCR DO BANCO CENTRAL*, *Poupança ou CDB?*. O banner
do canal traz **ARTHA e DHANA** lado a lado.

A voz, que é o que governa a copy desta spec:

- Pergunta na segunda pessoa como gancho. *"Você sabe quanto gastou no mês
  passado?"*, *"Por que você NÃO prospera, mesmo ganhando bem?"*
- Frase curta. Negação seguida de promessa, do próprio site: *"Chega de
  planilhas. Chega de lançamentos manuais. Conecte seus bancos uma vez e deixe o
  Artha fazer o resto."*
- Número concreto no lugar de adjetivo. 2 minutos, 20+ bancos, 2x por dia,
  zero horas.
- Público leigo. Zero jargão.

Isso não é estilo livre: é a régua com que a copy de §4 foi escrita, e a §7.1
trava as regras que dá para testar.

---

## 3. O estado verificado hoje

Verificado em 2026-09-26 contra as contas reais, não contra o `ROADMAP.md`.

| | |
| --- | --- |
| Último commit | 2026-08-25, `origin/main` em dia. Zero em setembro. |
| Abas no menu | cinco: dashboard, conversas, leads, relatórios, conta |
| Órfãos | `Disparos.tsx`, `Templates.tsx`, `Agendamentos.tsx`, `Reativacao.tsx` existem e não são roteados |
| Número WABA | +55 34 9211-4080, `quality_rating: GREEN`, app "API ARTHA X VISTRA" inscrito no webhook |
| `name_status` | `DECLINED` — quem recebe vê o número, não o nome |
| Supabase | `rdlmvcvwrofufvlmldlv.supabase.co` **não resolve em DNS** |
| `.vercel` | não existe; `vercel.json` só tem `regions`, o cron sumiu |

### 3.1 Existe um template aprovado, e ele briga com o bot

`mkt_rtv_voce_sabe_01`, `APPROVED`, `MARKETING`, `pt_BR`, três quick replies:
`Quero reconectar` · `Tive um problema` · `Não quero mais receber`.

A voz dele está certa — "você sabe quanto gastou no mês passado?" é a fórmula
dos títulos do canal. Três coisas nele estão erradas:

1. Assina **"Oi! Aqui é a Lúcia, da Artha"**. Lúcia é o CRM B2B vendido a
   planejadores. É o produto errado no público errado, e viola a regra de
   persona do `CLAUDE.md`.
2. Fala em reconectar conta. Foi escrito **antes** da oferta de 09/09 e não
   menciona a isenção.
3. **Os três botões dele caem no vazio.** Ver §3.2.

### 3.2 Por que o botão do template é jogado fora hoje

Rastreado em `src/lib/bot/estado.ts`. Quando o lead aperta um quick reply de
template, `proximoPasso` executa nesta ordem:

- `ms.some(ehDeHumano)` → **false**. `ehDeHumano` exige `!m.campanha_id`, e
  `fila.ts` grava `campanha_id` na linha do disparo. Correto e proposital.
- última mensagem é `inbound` → segue.
- `!ms.some(ehDoBot)` → **true**. `ehDoBot` exige `enviado_por === AUTOR_BOT`, e
  o disparo grava autoria nula. O bot nunca falou.
- Cai no portão de primeiro contato. `jaEscreveuAntes` é false para lead frio.
- Retorna **`{ acao: 'perguntar', pergunta: P1 }`**.

Ou seja: quem apertou "Quero reconectar" recebe *"Oi! Aqui é da Artha. Me diz o
que você procura."* O turno mais quente da campanha é gasto perguntando o que já
sabemos, e o `button_id` que ele mandou não roteia nada.

Não é bug — o comentário longo em `estado.ts` mostra que o caso foi previsto e
resolvido para **não quebrar**. O que falta é ele **valer alguma coisa**.

### 3.3 A P1 é a pergunta errada para esta coorte

`P1` pergunta "Minhas finanças / Sou planejador / Falar com alguém". É
segmentação. A planilha é 100% Artha B2C, trial expirado, com pelo menos um
banco conectado. Não há o que segmentar.

### 3.4 A planilha

12 linhas, sem cabeçalho: nome · e-mail · telefone. Duas sem e-mail. É o lote de
teste — o cliente disse que a base inteira passa de mil.

Todos os telefones vêm com 12 dígitos (`55` + DDD + 8), sem o nono dígito.
`telNorm11()` conserta 11 deles. **`551134980291` devolve `null`**: o assinante
começa em `3`, a função trata como fixo e se recusa a fabricar nono dígito, que
é o comportamento certo. Esse lead fica de fora do disparo e é reportado, não
silenciado.

---

## 4. O funil

Duas portas, um motor. Quem chega por disparo entra no ramo `rtv:`; quem escreve
espontaneamente continua no `P1` de hoje, intocado.

Copy sem travessão, sem dois-pontos introduzindo frase, sem markdown, link
sozinho na linha. Regras de escrita do gestor, travadas por teste desde
2026-08-25.

### 4.1 O template — `mkt_rtv_isencao_01`

`MARKETING`, `pt_BR`, uma variável de corpo (primeiro nome), três quick replies.

```
Oi, {{1}}. Você conectou seu banco no Artha e parou no meio do caminho.

Sua conta continua aqui, do jeito que você deixou.

E a taxa de adesão de R$100 a gente tirou pra você voltar. O primeiro mês sai
R$97, não R$197. Você conecta todos os seus bancos e testa por um mês, com a
nossa ajuda.

Reconectar leva 2 minutos.
```

**O corpo não começa na variável, de propósito.** A validação da Meta recusa
template cujo corpo abre ou fecha em parâmetro, e o rascunho aprovado nesta
sessão abria em `{{1}}`. O "Oi, " na frente custa três caracteres e evita uma
rejeição que só apareceria depois de submeter. O template aprovado que já existe
na conta usa a mesma saída, com saudação antes da variável.

"A gente tirou", não "eu tirei". A voz é institucional e plural em todo o
roteiro, e "a gente" é o registro do próprio cliente na transcrição.

| índice | título | payload no envio |
| --- | --- | --- |
| 0 | Quero voltar | `rtv:voltar` |
| 1 | Tive um problema | `rtv:problema` |
| 2 | Não quero receber | `rtv:sair` |

**A oferta vai no corpo, não atrás do botão.** Decisão do gestor nesta sessão,
contra a alternativa do gancho de reação ("antes de eu arquivar") que ele mesmo
tinha proposto em 02/09. Três razões: é verdade e não insinua arquivamento que
não vai acontecer; o `quality_rating` GREEN do número é patrimônio da operação e
a base inteira passa de mil; e a impressão do template de marketing é o que se
paga, então quem não apertar botão nenhum ainda assim precisa ter visto a
oferta.

"Reconectar leva 2 minutos" vem de `artha.ia.br` ("Conecte seus bancos em menos
de 2 minutos"). Número concreto, régua da §2.2.

Nenhum nome de persona. Ver §6.2.

### 4.2 As respostas

Não há nível 2. Um toque, uma resposta, e dois dos três caminhos entregam a
conversa a gente — que é exatamente o que o cliente pediu em 02/09 e o que faz
sentido com ele atendendo sozinho.

**`rtv:voltar`** — o critério de entrega. Qualifica e passa.

```
Boa. Já passei para a equipe da Artha, que libera a isenção e te acompanha na
hora de conectar os bancos.

Se quiser ir olhando, a plataforma é essa.

https://artha.ia.br
```

O bot **não afirma que a isenção já está aplicada**. Ver §6.1 — não existe
mecanismo de cupom confirmado, e afirmar mecanismo inexistente para cliente real
é reclamação, não bug.

**`rtv:problema`** — o mais valioso da coorte. Passa sem segundo toque.

```
Me conta o que travou. Pode escrever aqui mesmo.

Alguém da Artha lê e te responde ainda hoje.
```

**`rtv:sair`** — opt-out de verdade.

```
Certo, não te mandamos mais nada por aqui. Obrigado pelo seu tempo.
```

### 4.3 O que cada terminal grava

| id | stage | tag | efeito |
| --- | --- | --- | --- |
| `rtv:voltar` | `qualificado` | `rtv-quer-voltar` | entra na fila de atendimento |
| `rtv:problema` | `qualificado` | `rtv-teve-problema` | entra na fila de atendimento |
| `rtv:sair` | inalterado | `rtv-optout` | grava `optout_em`, sai de todo disparo futuro |

Segmento não é tocado por nenhum dos três: a coorte inteira já nasce `artha` na
importação, e sobrescrever com o mesmo valor só esconderia um erro de
importação.

---

## 5. Implementação

### 5.1 `roteiro.ts` — dado novo, nada de decisão

Ganha `RTV_IDS`, `RESPOSTA_POR_ID` estendido com os três ids, `TAG_POR_RESPOSTA`
estendido, e `ehIdRtv(id)`. `ehIdConhecido` passa a incluir `rtv:*`.

Os títulos dos botões viram constante exportada e o criador de template em §5.5
lê daqui. **O título aparece em dois lugares** — no template submetido à Meta e
no payload que o `fila.ts` manda — e eles têm de ser o mesmo dado, ou o botão
aprovado diverge do id enviado sem ninguém ver.

### 5.2 `estado.ts` — um portão novo, antes do de primeiro contato

Hoje o portão de primeiro contato devolve `P1` para qualquer inbound sem fala
prévia do bot. Passa a: se a última mensagem é inbound com `button_id` de
`rtv:*`, devolve `{ acao: 'encerrar', idP1: id, idP2: null, comFecho: true }`
antes de chegar lá.

Fora isso o motor não muda. `mensagemTerminal(idP1, idP2)` já resolve pelo
`idP2 ?? idP1` e já cai em `FECHO` quando não há resposta escrita, então os três
ids novos entram só como entrada de `RESPOSTA_POR_ID`.

### 5.3 `templates.ts` e `fila.ts` — o payload do quick reply

É esta a peça que faz o botão do template chegar como `rtv:voltar` em vez da
string `"Quero voltar"`.

`ComponenteEnvio` ganha a terceira forma:

```ts
| { type: 'button'; sub_type: 'quick_reply'; index: string
    parameters: [{ type: 'payload'; payload: string }] }
```

`templates.ts` ganha `componentesDeBotao(nomeDoTemplate): ComponenteEnvio[]`.
`fila.ts` concatena o retorno dela ao `body` que já monta. `enviarTemplate` não
muda — ele já repassa `componentes` inteiro e já omite `components` quando a
lista vem vazia, que é a defesa do erro 132018.

A função nova, e não `parametrosDoTemplate`: aquela resolve variável a partir de
um `RascunhoTemplate`, e a fila não tem rascunho em mãos, só o nome gravado no
agendamento. Forçar rascunho ali seria uma busca a mais por lead disparado.

O payload é resolvido a partir do **nome do template**, não de uma coluna nova
na fila: `mkt_rtv_*` recebe os três payloads de `rtv:`, na ordem dos índices;
qualquer outro nome recebe lista vazia. É a forma mais barata de não mexer no
schema de `agendamentos` nesta onda, e o custo é uma convenção de nome que a
§7.1 trava por teste.

### 5.4 Opt-out — migration 0003

```sql
alter table leads add column if not exists optout_em timestamptz;
```

Coluna, não tag. Tag é reescrita por qualquer `qualificarLead` e se perde em
silêncio; opt-out perdido é template de marketing para quem pediu para parar, o
que é violação de política da Meta e queima o número. Guarda **quando**, que é o
que se apresenta se alguém reclamar.

`Lead` ganha `optoutEm: string | null`. `podeDisparar(lead)` passa a ser:

```ts
return lead.ficticio !== true && lead.optoutEm === null
```

A régua é única e já é checada nos dois pontos que importam — na montagem do
recorte em `/api/campanhas` e de novo dentro do worker, imediatamente antes da
chamada à Meta. Nada além dessa linha precisa mudar para o opt-out valer nos
dois.

Em `executar.ts`, `marcarOptout` roda **antes** de enviar a confirmação, pelo
mesmo motivo que `qualificarLead` já roda antes do fecho: a trava de `bot_acoes`
já foi queimada e não há reprocessamento, então se só uma das duas coisas
sobreviver a um erro da Meta, tem de ser a que impede o próximo disparo. A
confirmação é cortesia; o opt-out é obrigação.

### 5.5 Dois scripts, nenhuma tela

Para 12 leads, trazer `Disparos` e `Templates` de volta ao menu é trabalho que
não paga. O gestor acompanha as respostas em **Conversas**, que já está no menu
e já funciona. A UI de disparo volta quando a base inteira for — e aí ela já
existe, órfã, esperando três linhas em `tabs.ts`.

- **`scripts/importar-leads.ts`** — lê um CSV de `nome,email,telefone`, normaliza
  por `telNorm11`, faz upsert por `tel_norm`, grava `segmento: 'artha'`,
  `plano_status: 'trial_expirado'`, `ficticio: false`, `ultimo_acesso_em: null`.
  Recusa rodar sem `IMPORT_CONFIRMO=sim`, no mesmo padrão do `npm run seed`.
  Imprime ao final: importados, já existentes, **e a lista de telefones que
  `telNorm11` recusou** — o `551134980291` da §3.4 tem de aparecer por nome na
  saída, nunca sumir.
- **`scripts/criar-template.ts`** — submete `mkt_rtv_isencao_01` via
  `criarTemplateNaMeta`, montando corpo e botões a partir de `roteiro.ts`.

O CSV é gerado do xlsx uma vez, à mão. Ler xlsx em Node exigiria dependência
nova para doze linhas.

**Nem o xlsx nem o CSV entram no git.** São nome, e-mail e telefone de doze
pessoas reais, o remoto é GitHub, e a planilha estava untracked na raiz — a um
`git add .` de ser publicada. O `.gitignore` passa a cobrir `*.xlsx` e `*.csv`
nesta onda.

### 5.6 Por que o recorte já funciona sem tocar em `regras.ts`

`recorteReativacao` exige `ehInativo(lead)`, que é `plano_status !== 'ativo'`, e
um piso de dias sem acesso. A importação grava `trial_expirado` e
`ultimo_acesso_em: null`, e `diasSemAcesso` devolve `Infinity` para null. Os 12
passam em qualquer piso. `filtro: { planoStatus: 'trial_expirado' }` isola a
coorte sem uma linha nova de regra.

---

## 6. Mudanças de contrato

### 6.1 O bot passa a afirmar uma oferta comercial

Mesma classe de dívida que o preço criou em 2026-08-25: a isenção de R$100 é
fato comercial numa string literal, e nada liga a string à realidade.

A diferença é pior aqui. Preço está publicado em `artha.ia.br` e dá para
conferir. **A isenção não está publicada em lugar nenhum**, e o cliente disse
*"podemos oferecer um cupom"*, que é intenção, não mecanismo.

Por isso o `rtv:voltar` da §4.2 entrega a humano em vez de dizer "sua isenção
está aplicada". O bot promete atendimento, que é coisa que a operação controla.

**Pergunta aberta ao cliente, bloqueia o disparo e não o código:** o cupom
existe? É código, link próprio, ou ele aplica na mão? Enquanto não houver
resposta, o template da §4.1 está prometendo desconto que só um humano entrega,
e é o cliente quem vai entregar.

### 6.2 O nome continua institucional

Fato novo de 2026-09-26: `artha.ia.br` vende "Assistente Clara IA via WhatsApp"
nos dois planos. Não resolve a regra do `CLAUDE.md`, delimita ela.

Clara é a assistente **dentro do produto**. O número que dispara esta campanha é
o canal **comercial**. Chamar o bot de vendas de Clara faz o cliente achar que
está falando com a assistente que ele ainda não assinou.

Lúcia, que o template aprovado usa, é pior: é o CRM B2B vendido a planejadores.

Decisão: **institucional**, "a equipe da Artha", como a §4.2 escreve. É o que o
`CLAUDE.md` já manda, e agora há razão de produto e não só falta de escolha.

### 6.3 `mkt_rtv_voce_sabe_01` é aposentado

Fica na conta como `APPROVED` — não dá para apagar template aprovado sem custo e
não há motivo. Não é disparado por nada nesta onda. A convenção de nome da §5.3
faz ele receber payloads `rtv:` se alguém disparar à mão, o que é o
comportamento menos ruim.

---

## 7. Critérios de aceitação

### 7.1 Teste automatizado

`src/lib/bot/roteiro.test.ts`

1. Todo id de `RTV_IDS` tem entrada em `RESPOSTA_POR_ID` **ou** está em
   `IDS_QUE_ENCAMINHAM`. Esquecer resposta é vermelho, não encaminhamento mudo.
2. Todo id de `RTV_IDS` tem entrada em `TAG_POR_RESPOSTA`.
3. Os três títulos cabem em 20 caracteres.
4. A copy de §4.1 e §4.2 não tem travessão, não tem markdown, não tem
   dois-pontos introduzindo frase, e o link está sozinho na linha.
5. Nenhuma resposta cita Lúcia, Clara ou LucIA.

`src/lib/bot/estado.test.ts`

6. Histórico `[outbound template com campanha_id, inbound button_id 'rtv:voltar']`
   devolve `{ acao: 'encerrar', idP1: 'rtv:voltar', comFecho: true }`. **Este é o
   teste que prova a §3.2 consertada** e falha contra o código de hoje.
7. O mesmo para `rtv:problema` e `rtv:sair`.
8. Inbound de texto livre sem fala do bot continua devolvendo `P1`. A porta
   orgânica não regride.
9. Operador que já falou continua desligando o bot, inclusive no ramo `rtv`.

`src/lib/templates.test.ts`

10. `componentesDeBotao('mkt_rtv_isencao_01')` devolve três `button` /
    `quick_reply` com os payloads de `roteiro.ts`, nos índices `'0'`, `'1'`,
    `'2'`, nessa ordem.
11. `componentesDeBotao` devolve lista vazia para nome fora da convenção
    `mkt_rtv_*`. Lista vazia importa: é ela que mantém a defesa do 132018.

`src/lib/regras.test.ts`

12. `podeDisparar` devolve false para lead com `optoutEm` preenchido.
13. `recorteReativacao` com `planoStatus: 'trial_expirado'` não devolve lead com
    opt-out.

### 7.2 Verificação manual, na ordem

1. `npm run lint`, `npx tsc --noEmit`, `npm test` limpos.
2. Migration 0003 aplicada.
3. `scripts/importar-leads.ts` com os 12 registros. **11 importados, 1 recusado
   com o nome impresso.**
4. `scripts/criar-template.ts` submete e a Meta aceita. Aguardar `APPROVED`.
5. Disparo para o número do gestor. O template chega com o primeiro nome
   preenchido e os três botões.
6. Apertar **Quero voltar** → chega o texto da §4.2, o lead vira `qualificado`
   com a tag, e a conversa aparece na fila de atendimento do Dashboard.
7. Apertar **Não quero receber** noutro número → chega a confirmação,
   `optout_em` fica preenchido, e um segundo disparo para o mesmo lead **não
   enfileira**.
8. Só então, o lote de 12, em horário combinado com o cliente — ele pediu isso
   explicitamente em 02/09 porque atende sozinho.

### 7.3 Portões que não dependem deste código

Nenhum passo de §7.2 além do 1 roda sem estes, e nenhum deles é trabalho de
implementação:

- **Supabase de pé.** O host não resolve em DNS. Reativar o projeto pausado ou
  criar outro e trocar as duas chaves em `.env.local`.
- **Migrations 0001, 0002 e 0003 aplicadas** no SQL Editor.
- **Bucket `midia` privado** no Storage.
- **Cartão na Meta.** Sem billing, template de marketing não sai. O cliente
  ficou de cadastrar em 02/09.
- **Deploy público.** O webhook precisa de URL HTTPS. `.vercel` nunca foi
  linkado e o cron sumiu do `vercel.json`.

---

## 8. Não entra

- IA. Continua sem LLM no projeto; o roteiro é fixo.
- Segundo nível de botão no ramo `rtv`. Um toque, uma resposta.
- Sequência de vários toques ao longo de dias, a ideia do funil de CBD levantada
  em 02/09. Depende de medir o lote de 12 primeiro.
- Voltar `Disparos`, `Templates`, `Agendamentos` e `Reativacao` ao menu. Ver
  §5.5.
- Tela de importação. Script basta para 12 linhas.
- Mostrar opt-out na tela de Leads.
- Dhana. Decisão do cliente em 02/09.
- Rotacionar o `WHATSAPP_ACCESS_TOKEN`, reenviar o `name_status` recusado,
  Realtime no lugar do polling. Continuam em `[NA FILA]` no `ROADMAP.md`.

---

## 9. Arquivos tocados

| Arquivo | Mudança |
| --- | --- |
| `src/lib/bot/roteiro.ts` | ramo `rtv:`, títulos dos botões, `ehIdRtv` |
| `src/lib/bot/estado.ts` | portão de campanha antes do de primeiro contato |
| `src/lib/templates.ts` | `ComponenteEnvio` ganha `quick_reply`; `componentesDeBotao` |
| `src/server/fila.ts` | concatena `componentesDeBotao` ao `body` |
| `src/lib/regras.ts` | `podeDisparar` checa `optoutEm` |
| `src/mock/types.ts` | `Lead.optoutEm` |
| `src/server/repo/leads.ts` | `paraDominio` lê a coluna; `marcarOptout` |
| `src/server/bot/executar.ts` | chama `marcarOptout` no terminal `rtv:sair` |
| `supabase/migrations/0003_optout.sql` | novo |
| `scripts/importar-leads.ts` | novo |
| `scripts/criar-template.ts` | novo |
| testes | os quatro arquivos da §7.1 |
| `ROADMAP.md`, `CLAUDE.md` | §6.2 e o estado real da §3 |
