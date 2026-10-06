# Artha System — o que foi feito até aqui

**Atualizado em:** 5 de outubro de 2026
**Para o estado corrente do código, a fonte é o `ROADMAP.md` na raiz.** Este
documento é a história: o que foi decidido, por quem, quando, e por quê.

---

## 1. O que é

Painel operacional de WhatsApp da **Artha** — planejamento e educação
financeira. Vistra.ia constrói; Rafael Recidive é o cliente.

O eixo mudou uma vez no caminho e vale registrar: começou como **reativação de
base inativa** e virou **atendimento e qualificação** de quem escreve para o
número, até voltar a ter um braço de disparo ativo em setembro. Os 612 inativos
que a primeira versão do `CLAUDE.md` prometia nunca existiram — eram número do
dataset fictício da demonstração, não da base do cliente.

Três produtos do cliente aparecem como segmento de lead no sistema:

| Produto | Público | O que é |
| --- | --- | --- |
| **Artha** | B2C | Open Finance, pessoa física. R$197 no 1º mês (R$97 + R$100 de adesão), R$97 depois; anual R$997 sem adesão |
| **Dhana** | B2B | Plataforma de planejamento financeiro, white-label para planejadores |
| **LucIA** | B2B | IA operacional para escritórios de planejamento |

---

## 2. Linha do tempo

### 10/08 — primeira reunião
`2026-08-10-reuniao-1-transcricao.md` · `2026-08-10-reuniao-1-resumo.md`

Presentes: Rafael Recidive, Kelwin Tobias, Rafael Reis.

O cliente descreveu a operação: ~150 usuários ativos, um agente de IA próprio
chamado Lúcia rodando em n8n sobre WhatsApp Web, com três bases de conhecimento.
O problema que ele tinha: o WhatsApp Web derruba o robô quando alguém mexe no
celular, e ele não conseguia escalar.

Decidiu-se: bot próprio na API oficial, chip novo para evitar bloqueio, e foco em
recuperar base inativa. Vistra.ia não cobra implementação, só o custo de disparo.

**O que ficou prometido e nunca chegou:** o JSON do n8n e as bases de
conhecimento da Lúcia. Isso é o que mantém o agente de IA bloqueado até hoje.

### 20/08 a 25/08 — o backend real
Supabase Postgres, WhatsApp Cloud API em produção (webhook com HMAC e envio),
motor de disparo, e um bot de botões determinístico dentro do webhook. **Sem IA**
— o roteiro é fixo e não há LLM no projeto.

Em 25/08 o bot deixou de ser formulário de triagem: cada botão terminal passou a
entregar texto próprio, em vez de todos caírem na mesma frase de espera.

### 02/09 — segunda reunião
`2026-09-02-reuniao-2-transcricao.md` · 16 minutos, só os dois Rafaels.

Três decisões:

1. **Foco só em Artha.** Dhana tem menos lead e fica para depois.
2. **O trabalho é ativo.** *"a gente vai disparar primeiro para nossa base"*.
3. **O bot entrega, não atende.** *"o robozinho atende sozinho e passa para mim
   só se tiver os critérios que a gente define"*.

Promessa da Vistra.ia: *"eu vou montar os funis aqui pensando nas mensagens, vou
te mandar"*.

### 08 e 09/09 — a oferta
`2026-09-08-whatsapp.md`

O cliente entregou a planilha e definiu a oferta: **cupom de isenção da taxa de
adesão de R$100**, para quem foi trial e já tinha conectado pelo menos um banco.
R$97 no primeiro mês em vez de R$197.

### 10/09 a 25/09 — parado
Dezessete dias sem avanço. O projeto Supabase pausou por inatividade e o painel
passou a descrever um estado que não existia mais.

### 26 a 29/09 — a retomada
Quatro ondas de trabalho, cada uma com spec e plano em
`docs/superpowers/specs/` e `docs/superpowers/plans/`:

| Onda | O que entregou |
| --- | --- |
| **Funil de retomada** (26–28/09) | o botão do template passou a rotear o bot; opt-out passou a existir; importador de leads |
| **Triagem e variantes** (28/09) | `qualificado` passou a exigir que a pessoa diga o motivo; três mensagens de disparo para escolher |
| **Botões na conversa** (29/09) | o CRM passou a mostrar quais botões foram oferecidos, e não só o que foi respondido |

---

## 3. O funil do bot

Duas portas, um motor. Toda decisão sai de uma função pura que lê o histórico da
conversa — sem IA, sem prompt, sem LLM.

### Porta de campanha — quem recebeu disparo

```
TEMPLATE  (o gancho)
[ Quero voltar ]   [ Tive um problema ]   [ Não quero receber ]
      │                    │                      │
      │                    │                      └─ opt-out. Sai de todo
      │                    │                         disparo futuro.
      │                    └─ suporte. Vai para gente, qualificado.
      ▼
TRIAGEM  "Me diz o que te segurou da primeira vez."
[ Foi o preço ]  [ Travei na conexão ]  [ Não entendi direito ]
      └───────────────┴────────────────────┘
                      ▼
            QUALIFICADO, com a tag do motivo
```

**Só a triagem qualifica.** Um toque no template não basta — foi a correção
pedida em 29/09: *"só uma mensagem > qualificação, fica direto demais"*.

O eixo da triagem responde a pergunta que o próprio cliente fez. Ele escreveu que
a base *"não comprou por algum motivo"* e não sabe qual. Cada resposta arma a
fala de abertura dele: preço é objeção que a isenção resolve, conexão é suporte
que ela não resolve, dúvida é falta de entendimento do produto.

### Porta orgânica — quem escreve do nada

Dois níveis, intocados desde agosto: `P1` segmenta (Minhas finanças / Sou
planejador / Falar com alguém) e `P2` responde (como funciona, preços, começar).

### Onde o bot cala

Oito portões em ordem fixa, e o primeiro que casar decide. Os que mais importam:

- **Um operador já falou nesta conversa** → o bot cala ali para sempre. É a regra
  que o cliente comprou quando desligou o robô dele por atropelar atendimento.
- **O roteiro já acabou** → não repete pergunta já respondida.
- **Texto livre** → repete a pergunta pendente **uma vez**, e depois entrega a
  gente.

---

## 4. O que está no ar

| | |
| --- | --- |
| Deploy | `artha-rafael.vercel.app`, webhook ativo |
| Número | +55 34 9211-4080 · quality **GREEN** |
| Banco | Supabase Postgres, migrations 0001, 0002 e 0003 aplicadas |
| Leads do lote | **11 importados**, tag `rtv-lote-2026-09` |
| Testes | **359 passando**, 1 pulado |
| `lint` · `tsc` · `build` | limpos |

**Um lead ficou de fora, de propósito:** `551134980291` (Romario silva). O
assinante começa em `3`, então a normalização se recusa a fabricar o nono dígito
— fabricar criaria um celular que existe e é de outra pessoa. Ele é impresso por
nome na saída do importador, nunca some em silêncio.

---

## 5. O que trava o disparo

Nada disto é código. Em ordem:

- [ ] **Submeter os templates à Meta.** `npm run criar:template` manda as três
      variantes numa passada. A aprovação leva de minutos a dias, e cada uma
      corre sozinha. **Nunca foi executado** — criar template é ação
      irreversível na conta de produção do cliente.
- [ ] **Cartão na Meta.** Sem billing, template de marketing não sai.
- [ ] **Bucket `midia`, privado**, no Storage do Supabase.
- [ ] **O cupom tem mecanismo?** O cliente disse *"podemos oferecer um cupom"*,
      que é intenção. Enquanto não houver resposta, o bot entrega a humano em vez
      de afirmar que a isenção está aplicada — o que funciona, mas custa um
      atendimento a mais por lead.

**Para disparar só o lote**, o filtro é por tag:

```json
{ "filtro": { "tag": "rtv-lote-2026-09" } }
```

Filtrar por `planoStatus` alcança **todo número que já escreveu para a Artha** —
o webhook cria lead com `plano_status` no default do schema, que é exatamente
`trial_expirado`. Essa pegadinha custou uma revisão inteira para ser encontrada.

---

## 6. Limites e dívidas conhecidas

**O preço e a isenção são strings literais.** O bot afirma R$197, R$97, R$997 e a
isenção de R$100. Nada liga essas strings ao site. Quando a oferta mudar, alguém
troca à mão — e a isenção é pior que o preço, porque não está publicada em lugar
nenhum para conferir.

**O site não vende trial.** A coorte da planilha vem de um trial que saiu da
página. Por isso nenhuma variante promete teste novo, e um teste trava as
palavras "grátis", "gratuito", "devolução" e "reembolso" fora dos corpos.

**Opt-out é por botão, não por texto.** Quem escrever "não quero mais receber" em
vez de apertar o botão não é marcado.

**Renomear botão de template desmarca toques antigos.** O toque em quick reply de
template é casado por igualdade de título, porque a Meta manda o texto do botão
como conteúdo e o template cadastrado só guarda títulos. O caminho do bot não
sofre disso, porque casa por id.

**Depois do opt-out a conversa continua na fila de atendimento.** Consertar
mexeria em régua compartilhada por três telas, por um card de doze.

**`name_status: DECLINED`.** A Meta recusou o nome de exibição "Artha Finanças
Pessoais". Não bloqueia envio; bloqueia o nome aparecer para quem recebe.

**O token do WhatsApp nunca foi rotacionado.** Circulou em texto puro num arquivo
e é system user permanente, então não expira sozinho.

**`mkt_rtv_voce_sabe_01` está aprovado na conta e assina "Lúcia"** — produto B2B
errado para público B2C. Disparar ele à mão agora **falha alto** de propósito, em
vez de sair sem payload e devolver a base inteira para a pergunta de segmentação.

---

## 7. A voz

Institucional Artha — "Aqui é da Artha", "equipe da Artha". **Nenhum nome de
persona** em copy de mensagem.

A regra deixou de ser "o cliente não escolheu" e passou a ter razão de produto:
`artha.ia.br` vende "Assistente Clara IA via WhatsApp" como feature dos dois
planos, ou seja **Clara é a assistente dentro do produto**. O número deste painel
é o canal comercial, e chamar o bot de vendas de Clara faz o lead achar que já
está falando com a assistente que ele ainda não assinou. Lúcia é pior — é o CRM
B2B vendido a planejadores.

Regras de escrita, travadas por teste: sem travessão, sem dois-pontos
introduzindo frase, sem markdown, e link sozinho na linha.

---

## 8. Onde está cada coisa

```
resumo/                      esta pasta — reuniões e este documento
ROADMAP.md                   o estado corrente do código. A fonte da verdade.
CLAUDE.md                    como trabalhar neste projeto
DESIGN.md                    a autoridade estética
DEPLOY.md                    como subir

docs/superpowers/specs/      uma spec por onda, com a razão de cada decisão
docs/superpowers/plans/      o plano de execução de cada spec

src/lib/bot/roteiro.ts       o roteiro como DADO: perguntas, respostas, tags
src/lib/bot/estado.ts        o motor: função pura que decide o próximo passo
src/lib/botoesDaConversa.ts  quais botões cada bolha ofereceu, para o CRM
src/server/bot/executar.ts   o efeito colateral do bot
src/server/fila.ts           o worker que drena a fila de disparo
src/app/api/webhook/         entrada da Meta, e onde o opt-out é gravado

scripts/importar-leads.ts    CSV → tabela de leads, com os recusados por nome
scripts/criar-template.ts    submete as variantes à Meta
```
