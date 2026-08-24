# Bot de qualificação por botões — design

**Data:** 2026-08-24
**Estado:** desenhado no brainstorming de 2026-08-24, aguardando revisão do gestor

---

## 1. De onde isto vem

A reunião de 10/08 (`transcricao.md`) define o produto duas vezes.

A primeira é a demonstração ao vivo da Mar Azul, em 00:13:40: *"a gente faz o
disparo… o cliente vai apertando os botões, como não usa IA… e já saiu o lead
qualificado para a operadora"*. Kelwin separa explicitamente os dois modos que a
Vistra opera — Mar Azul é automação com botões, Café Canastra é IA. Este
documento especifica o primeiro. Não há IA, não há n8n, não há serviço novo.

A segunda é a dor do cliente, em 00:15:34. Rafael desligou o robô dele porque um
número só atende Artha (B2C, pessoa física) e Dhana (B2B, planejador
financeiro), e o agente errava o atendimento: *"não é mais feio a IA ficar
falando besteira do que ele ficar esperando para ser atendido por uma pessoa que
vai dar uma resposta certa"* (00:16:25). A resposta do Kelwin foi a Valéria do
Café Canastra — *"ela faz uma pergunta de qualificação pro lead"* para separar as
frentes. É essa pergunta que este bot faz.

**Premissa que mudou depois da reunião:** não há base. Nenhum lead cadastrado,
nenhuma campanha disparada. Todo contato que chegar é primeiro contato. O painel
foi escrito para uma reativação de 612 inativos que não existe, e a §5 deste
documento corrige isso.

---

## 2. Escopo

### Entra

1. **O bot** — automação de botões que qualifica quem escreve pela primeira vez
   para o número da Artha, dentro do webhook que já existe.
2. **A reorientação do painel** — o eixo sai de reativação e passa para
   atendimento e qualificação, que é o que o sistema faz agora.

### Não entra

- IA de qualquer natureza. O roteiro é fixo e determinístico.
- Tela nova. O resultado do bot aparece em Conversas e Leads, que já existem.
- Cron, fila ou agendamento. O bot é reativo ao webhook — nada nele depende do
  cron de 10 minutos que exige plano Pro da Vercel.
- Retentativa de envio. Ver §3.7.
- Mensagem de lista (`list`, até 10 opções). Três botões bastam para o roteiro.
- Template com botão de resposta rápida. O bot só fala dentro da janela de 24h,
  e o gatilho é uma mensagem de entrada, que abre a janela.

---

## 3. O bot — comportamento

### 3.1 Gatilho

O bot age quando, e somente quando, as quatro condições valem no momento em que
o webhook entrega uma mensagem de entrada:

```
chegou inbound
  E o telefone não tem nenhuma mensagem inbound anterior no sistema
  E nenhum outbound humano existe nessa conversa
  E BOT_QUALIFICACAO === 'on'
```

Receber disparo não conta como conversa: quem recebeu template e nunca escreveu
continua sendo primeiro contato. Isso faz o bot cobrir tanto o lead que chega do
Instagram quanto quem responde a um disparo futuro, sem precisar de dois fluxos.

**O discriminador é `campanha_id`, não `enviado_por`.** Uma revisão durante a
implementação achou a contradição: disparo de campanha grava `enviado_por` nulo
(`src/server/fila.ts`), e resposta manual de operador **também** grava nulo hoje
(`/api/mensagens` faz `enviado_por: enviadoPor ?? null`, e a tela não manda o
campo). Tratar nulo como humano mataria o primeiro caso; tratar nulo como
não-humano mataria a regra do operador, que importa mais. `campanha_id` separa
os dois de verdade, e por isso entrou em `MensagemBot`.

A checagem é por valor ausente-ou-nulo (`!campanha_id`), não por igualdade a
`null`. Se alguém editar o `select` de `historicoParaBot` e esquecer a coluna, o
campo chega `undefined`: com a negação, mensagem de campanha passa a contar como
humana e o bot cala demais; com a igualdade, **nenhum** outbound contaria como
humano e o bot passaria por cima de atendimento humano. Falhar para o lado
barato é decisão consciente.

Hoje a segunda condição é verdadeira para todo mundo, porque a base está vazia.
Ela existe para a segunda conversa de cada pessoa: quem já escreveu uma vez nunca
mais vê o bot.

**A chave de desligamento é variável de ambiente**, `BOT_QUALIFICACAO`, lida em
`src/server/env.ts`. Qualquer valor diferente de `'on'` desliga. Não há toggle no
painel: seria uma tabela de configuração e um pedaço de UI para uma chave que se
mexe uma vez por trimestre. Desligar custa alterar a variável na Vercel e
redeployar. Se o cliente pedir o toggle depois, é uma tabela de uma linha.

### 3.2 O roteiro

Duas perguntas. A segunda ramifica pela primeira. Definido como dado em um
arquivo só — `src/lib/bot/roteiro.ts` — nunca espalhado em condicionais.

```
p1 · sempre
   "Oi! Aqui é da Artha. Para te direcionar certo, me diz o que você procura:"
   p1:artha   "Minhas finanças"     → segmento artha
   p1:dhana   "Sou planejador"      → segmento dhana
   p1:outro   "Outro assunto"       → encerra, entrega ao humano

p2 · ramifica pela resposta da p1
   se p1:artha
     "Você já usou a Artha?"
     p2:assinante "Já sou assinante"
     p2:testou    "Já testei"
     p2:nunca     "Nunca usei"
   se p1:dhana
     "Quantos clientes você atende hoje?"
     p2:ate20     "Até 20"
     p2:20a100    "20 a 100"
     p2:100mais   "Mais de 100"
   se p1:outro
     não há p2

fecho · depois da p2
   "Perfeito, obrigado! Já passei para a equipe da Artha —
    em instantes alguém te responde por aqui."
```

**Os ids são o contrato; os títulos são copy.** Trocar "Minhas finanças" por
"Minhas contas" não pode mexer no roteamento. É por isso que o parser do webhook
precisa passar a guardar o id do botão, que hoje ele descarta (§6.2).

**Limites da Cloud API que o roteiro respeita:** no máximo 3 botões por mensagem
interativa, título de botão com no máximo 20 caracteres, corpo com no máximo
1024. Os títulos acima têm entre 6 e 16 caracteres.

**Voz:** institucional, "Aqui é da Artha", "equipe da Artha". Nenhum nome de
persona — há três em circulação (Lúcia, Clara, LucIA) e a escolha é do cliente.

### 3.3 Quando o bot se cala

Três situações, checadas nesta ordem:

| Situação | O que acontece |
| --- | --- |
| Existe outbound humano na conversa | Bot desligado ali, para sempre |
| O roteiro terminou | Bot desligado, lead qualificado na fila |
| Texto livre no lugar do botão | Repete a pergunta **uma** vez; se vier texto de novo, encerra e entrega |

**"O roteiro terminou" precisa ser derivado do histórico, não da última
mensagem.** A primeira implementação lia a resposta da p2 só da última mensagem,
e o estado terminal evaporava assim que o lead escrevia depois do fecho: ele
recebia de volta a pergunta que tinha acabado de responder — exatamente o
comportamento que motivou este projeto. A regra correta é: uma resposta terminal
(id de p2, `p1:outro`, ou id fora do roteiro) que esteja em qualquer posição
**anterior** à última mensagem cala o bot. Se ela É a última, é agora que o bot
age.

Texto livre em vez de botão quase sempre é pergunta real — "quanto custa?" —, não
erro de uso. Repetir uma vez cobre quem não viu o botão. Insistir duas vezes com
quem está escrevendo é exatamente o robô falando besteira que fez o cliente
desligar o dele.

A mensagem de repetição é `"Te respondo já! Só me diz primeiro:"` seguida dos
mesmos botões. A entrega ao humano é silenciosa: o bot não se despede, apenas
para de responder e a conversa fica na fila de atendimento.

### 3.4 O que o bot grava

No fim do roteiro, sobre o lead:

| Campo | Valor |
| --- | --- |
| `leads.segmento` | `artha` ou `dhana`, conforme a p1 |
| `leads.stage` | `qualificado` |
| `leads.tags` | a resposta da p2: `assinante`, `ja-testou`, `nunca-usou`, `carteira-ate-20`, `carteira-20-100`, `carteira-100-mais` |

**`p1:outro` não grava nada.** Não decide segmento e não marca etapa: ninguém foi
qualificado. O lead recebe a tag `outro-assunto` e vai para a fila com
`stage` intacto. O `segmento` fica no default `artha` do schema, que é o que já
acontece hoje com qualquer lead criado pelo webhook — o operador corrige na tela
de Leads se for o caso.

As mensagens do bot são gravadas em `messages` como qualquer outra, com
`direction: 'outbound'` e `enviado_por: 'bot'`.

### 3.5 Estado derivado do histórico

Não há tabela de sessão. O passo do roteiro é função pura das mensagens da
conversa:

```
proximoPasso(mensagens, agora) → 'perguntar_p1' | 'perguntar_p2'
                                | 'repetir' | 'encerrar' | 'calar'
```

Vive em `src/lib/bot/estado.ts`, sem banco e sem rede, testada em vitest. É o
idioma da casa: `janela24h`, `timeline`, `conversationKey` e `getMetrics` já são
derivações puras, e `src/lib/` é onde as regras testáveis moram.

A derivação dá a idempotência que o webhook exige de graça. A Meta reentrega
quando a resposta demora mais que ~5s, e a reentrega chega com o mesmo `wamid`,
que `messages.message_id` já rejeita por unicidade. Reprocessar o mesmo histórico
produz a mesma decisão — e se o bot já respondeu depois daquele inbound, o
histórico contém a resposta e a decisão vira `calar`.

**Isso exige que "o mesmo histórico" seja mesmo o mesmo.** O timestamp que a Meta
manda tem resolução de segundo, então dois toques rápidos no botão empatam em
`created_at`, e o Postgres não garante ordem estável para empate sem chave
secundária. `historicoParaBot` desempata por `id`, como `listarLeads` já faz. O
desempate é arbitrário — `id` é uuid, não sequência — mas é determinístico, e é
determinismo que a idempotência precisa. A ordem verdadeira entre dois toques no
mesmo segundo é informação que o sistema não tem.

### 3.6 A trava de concorrência

A derivação cobre reentrega em série, não em paralelo: duas entregas simultâneas
podem ler o histórico antes de qualquer uma escrever, e as duas mandariam o
botão.

Uma tabela de uma coluna resolve:

```sql
create table bot_acoes (
  inbound_message_id text primary key,
  criado_em timestamptz not null default now()
);
```

O bot insere o `wamid` do inbound **antes** de chamar a Meta. Conflito de chave
primária significa que outra entrega já cuidou daquela mensagem — o bot sai sem
fazer nada. Não é uma máquina de estados disfarçada: a tabela não guarda passo,
resposta nem nada além do fato de que aquele inbound já foi tratado.

### 3.7 Erro

**Falha na chamada à Meta:** registra em log, marca nada, sai. Não retenta. Um
botão duplicado chegando dois minutos depois é pior que resposta nenhuma — a
conversa fica na fila de atendimento e o operador assume, que é o
comportamento-padrão do sistema quando o bot não age.

**Botão com id que o roteiro não conhece:** acontece se o roteiro mudar entre a
pergunta e a resposta. Encerra e entrega ao humano.

**Bot desligado no meio de um roteiro:** quem estava no meio fica parado. Sem
mensagem de despedida, sem varredura de conversas órfãs. O operador vê a conversa
na fila como qualquer outra.

**A janela de 24h** está sempre aberta quando o bot age, porque o gatilho é uma
mensagem de entrada. Ainda assim o envio passa por `getWindowStatus` antes de
chamar a Meta — o custo é uma comparação e o benefício é não descobrir em
produção que existe um caminho onde a premissa não valia.

---

## 4. O bot — implementação

### 4.1 Módulos

| Arquivo | Responsabilidade |
| --- | --- |
| `src/lib/bot/roteiro.ts` | O roteiro como dado: perguntas, ids, títulos, ramificação, mapa de id → segmento/tag. Puro. |
| `src/lib/bot/estado.ts` | `proximoPasso(mensagens, agora)`. Puro, sem banco. |
| `src/lib/bot/estado.test.ts` | Os casos da §7.1. |
| `src/server/bot/executar.ts` | Orquestra: carrega histórico, chama `proximoPasso`, toma a trava, envia, grava. |

O corte entre `src/lib/bot/` e `src/server/bot/` é o mesmo do resto do projeto:
regra pura de um lado, efeito colateral do outro.

### 4.2 Ponto de entrada

`src/app/api/webhook/route.ts`, dentro de `processar()`, depois de a mensagem ser
inserida e o lead resolvido. Roda no `after()` que já existe — fora do caminho da
resposta, que precisa devolver 200 antes de ~5s.

Uma falha do bot não pode derrubar o processamento do webhook: `executar()` é
chamado dentro do seu próprio `try/catch`, e o erro vai para log sem impedir a
gravação da mensagem nem a marcação do evento como processado.

### 4.3 Envio interativo

`enviarBotoes(para, corpo, botoes)` em `src/server/meta/client.ts`, ao lado de
`enviarTexto` e `enviarTemplate`:

```json
{
  "messaging_product": "whatsapp",
  "to": "<telefone>",
  "type": "interactive",
  "interactive": {
    "type": "button",
    "body": { "text": "<corpo>" },
    "action": {
      "buttons": [
        { "type": "reply", "reply": { "id": "p1:artha", "title": "Minhas finanças" } }
      ]
    }
  }
}
```

A função valida os limites da API antes de chamar (no máximo 3 botões, título com
no máximo 20 caracteres) e estoura em desenvolvimento se o roteiro violar —
descobrir isso por `MetaError` em produção custa uma conversa perdida.

### 4.4 Migration

`supabase/migrations/0002_bot_qualificacao.sql`, com duas mudanças:

```sql
alter table messages add column if not exists button_id text;

create table if not exists bot_acoes (
  inbound_message_id text primary key,
  criado_em timestamptz not null default now()
);
```

`button_id` guarda o id do botão tocado — `interactive.button_reply.id` para
mensagem interativa, `button.payload` para botão de template. `content` continua
guardando o título, que é o que a tela de Conversas mostra.

RLS `deny all` em `bot_acoes`, como em todas as outras tabelas: o acesso é pelo
service role do servidor.

---

## 5. O painel — reorientação

As telas foram escritas para uma reativação de 612 inativos que não existe. Com a
base vazia, o Dashboard mostra "0 inativos aguardando reativação" na banda preta
e Relatórios abre com "Desempenho das 0 campanhas de reativação" — sendo que
Disparos saiu do menu e campanha nenhuma vai existir.

O bot passa a alimentar o que a reativação alimentava: leads qualificados,
separados entre Artha e Dhana, com a temperatura de cada um.

### 5.1 Dashboard

**Banda de polaridade invertida.** O número-herói em ouro (papel 3 da lista
fechada do DESIGN.md) deixa de ser `metrics.inativos` e passa a ser
`metrics.porEtapa.qualificado` — leads que o bot qualificou. A linha de apoio
troca a receita recuperável pela divisão entre Artha e Dhana, que vem de
`metrics.porSegmento` e é a informação que a reunião pediu.

O papel do acento não muda: continua sendo o número-herói, continua sem carregar
estado semântico, e o CTA continua fora — a banda hoje não tem botão, porque
Disparos e Reativação saíram do menu.

**Tiles.** Sai "Receita recorrente", que mede uma base que não existe. Entra
"Qualificados". Os quatro passam a ser:

| Tile | Fonte |
| --- | --- |
| Leads na base | `metrics.totalLeads` |
| Fila de atendimento | `metrics.conversas.filaAtendimento` |
| Conversas | `metrics.conversas.total` |
| Qualificados | `metrics.porEtapa.qualificado` |

Nenhuma métrica nova precisa ser calculada: `getMetrics` já devolve `porEtapa`,
`porSegmento` e o bloco de `conversas`.

### 5.2 Relatórios

Hoje a tela mede campanha: enviados, entregues, respondidos, taxa de conversão do
disparo. Sem Disparos no menu, ela mede o vazio.

Passa a medir atendimento e qualificação, com o que `getMetrics` já entrega:

- Leads por segmento (`porSegmento`) — Artha, Dhana, LucIA.
- Leads por etapa (`porEtapa`) — novo, contatado, qualificado, convertido, perdido.
- Volume de conversas e mensagens (`conversas`, `mensagens`).
- Quantas conversas estão na fila e quantas têm janela de 24h aberta.

O gráfico segue a regra do DESIGN.md: SVG inline, sem Recharts, no máximo 3
séries, série primária em `--accent`.

**Estado vazio importa aqui.** Com a base zerada, a tela abre sem dado nenhum, e
uma tela de zeros parece defeito. Cada bloco ganha um estado vazio explícito —
"nenhum lead cadastrado ainda" — em vez de renderizar `0` com ar de número.

### 5.3 Tela de login

O painel invertido de `src/app/(auth)/layout.tsx` promete o que o sistema não
faz mais:

- O título "A base inativa volta a conversar." fala de atendimento.
- Os três destaques hoje são Reativação, Conversas e Disparos. Dois deles saíram
  do menu. Passam a ser Conversas, Leads e Relatórios, com as notas
  correspondentes.
- O parágrafo de apoio perde "reativação" e mantém o que continua verdadeiro:
  atendimento e segmentação por WhatsApp com a API oficial da Meta.

---

## 6. Mudanças de contrato

Três regras do sistema mudam. Estão listadas separadamente porque não são
detalhe de implementação — são acordos que outra pessoa vai ler depois e precisa
encontrar registrados.

### 6.1 A Etapa passa a mudar sem operador

`CONTEXT.md` define Etapa como "muda por ação do operador, não automaticamente".
O bot passa a ser uma segunda origem: marca `qualificado` no fim do roteiro.

É a mudança certa — "lead qualificado" é o que a reunião comprou —, mas o
`CONTEXT.md` precisa passar a dizer isso, senão a próxima pessoa que ler o
glossário vai tratar uma etapa mudada pelo bot como defeito.

### 6.2 O webhook passa a guardar o id do botão

`src/lib/webhookParse.ts` hoje guarda o **título** do botão em `content` e
descarta o id. Passa a guardar os dois: `content` continua com o título, para a
tela de Conversas, e `button_id` recebe `interactive.button_reply.id` ou
`button.payload`.

Sem isso, o roteiro só poderia rotear por texto, e a primeira revisão de copy
quebraria o bot silenciosamente.

### 6.3 `enviado_por: 'bot'` não atribui a conversa

`src/server/repo/mensagens.ts:266` usa `enviado_por` para decidir quem está
atendendo: *"quem respondeu à mão por último é quem está atendendo"*. Se o bot
gravar `enviado_por: 'bot'`, ele aparece como operador atribuído na lista de
Conversas, e a conversa some da fila de quem deveria assumi-la.

A regra passa a ignorar o valor `'bot'` ao calcular `atribuidoA`.

---

## 7. Critérios de aceitação

### 7.1 Testes automatizados — `src/lib/bot/estado.test.ts`

Todos rodam sem banco, sobre listas de mensagens construídas à mão:

1. Conversa vazia + primeiro inbound → `perguntar_p1`.
2. Bot mandou p1, chegou `p1:artha` → `perguntar_p2` com o ramo de Artha.
3. Bot mandou p1, chegou `p1:dhana` → `perguntar_p2` com o ramo de Dhana.
4. Bot mandou p1, chegou `p1:outro` → `encerrar`.
5. Bot mandou p1, chegou texto livre → `repetir`.
6. Bot repetiu, chegou texto livre de novo → `encerrar`.
7. Bot repetiu, chegou botão válido → segue o roteiro normalmente.
8. Existe outbound com `enviado_por` diferente de `'bot'` → `calar`, em qualquer
   ponto do roteiro.
9. Roteiro completo → `calar`.
10. Botão com id fora do roteiro → `encerrar`.
11. O último outbound do bot é posterior ao último inbound → `calar` (reentrega).
12. Telefone com inbound anterior ao da conversa atual → `calar` (não é primeiro
    contato).

Sete casos vieram da revisão, depois que ela achou os defeitos da §3.1 e da §3.3:

13. Lead escreve depois do fecho → `calar`.
14. Lead toca botão depois do fecho → `calar` (não reinicia o roteiro).
15. `p1:outro` seguido de texto → `calar`.
16. Escalado por id desconhecido e o lead insiste → `calar`.
17. Botão desconhecido **depois** de uma p1 válida → `encerrar` carregando o
    `idP1` já descoberto, em vez de descartá-lo.
18. Outbound de campanha seguido de inbound → `perguntar` a p1. Quem recebeu
    disparo e escreve continua sendo primeiro contato.
19. Outbound sem autoria e sem campanha → `calar`. É a forma que a resposta
    manual de operador tem hoje, e a regra do operador precisa sobreviver a ela.

E em `src/lib/webhookParse.test.ts`, que já existe:

20. Payload de `interactive.button_reply` → `button_id` recebe o id e `content`
    recebe o título.
21. Payload de `button` de template → `button_id` recebe o `payload`.
22. Payload de `interactive.list_reply` → `button_id` recebe o id.
23. `button` sem `payload` e `interactive` sem `button_reply` → `button_id` nulo,
    sem estourar. É a propriedade central do parser e não estava provada.

E em `src/lib/bot/roteiro.test.ts`, oito invariantes: os limites da Cloud API
(≤3 botões, título ≤20 caracteres, corpo ≤1024), unicidade dos ids, toda
resposta terminal tendo tag — com os terminais **derivados** de quais botões da
p1 não têm ramo, não listados à mão — e a ramificação por segmento.

### 7.2 Verificação manual

Depende do número WABA, que a reunião deixou pendente no chip novo (00:18:16) e
que o `ROADMAP.md` lista como bloqueio. Quando existir:

15. Mensagem de um telefone desconhecido → chegam os três botões da p1.
16. Tocar "Minhas finanças" → chega a p2 do ramo Artha.
17. Tocar "Já testei" → chega o fecho, e a tela de Leads mostra o lead com
    segmento `artha`, etapa `qualificado` e a tag `ja-testou`.
18. A conversa aparece na fila de atendimento **sem** operador atribuído.
19. Escrever texto em vez de tocar botão → uma repetição; texto de novo → silêncio.
20. `BOT_QUALIFICACAO` fora de `'on'` → nenhuma mensagem automática.

### 7.3 Painel

21. Dashboard, Relatórios e login sem nenhuma ocorrência de "reativação",
    "inativo" ou "campanha" em copy visível.
22. Com a base vazia, nenhuma tela mostra `0` sem um estado vazio que o explique.
23. `npm run lint`, `npm test` e `npm run build` limpos.

---

## 8. Arquivos tocados

**Bot**

- `src/lib/bot/roteiro.ts` *(novo)*
- `src/lib/bot/estado.ts` *(novo)*
- `src/lib/bot/estado.test.ts` *(novo)*
- `src/server/bot/executar.ts` *(novo)*
- `src/server/meta/client.ts` — `enviarBotoes`
- `src/app/api/webhook/route.ts` — chamada ao bot dentro do `after()`
- `src/lib/webhookParse.ts` — captura de `button_id`
- `src/lib/webhookParse.test.ts` — casos 13 e 14
- `src/server/repo/mensagens.ts` — grava `button_id`; ignora `'bot'` em `atribuidoA`
- `src/server/repo/leads.ts` — aplica segmento, etapa e tag
- `src/server/env.ts` — `BOT_QUALIFICACAO`
- `supabase/migrations/0002_bot_qualificacao.sql` *(novo)*

**Painel**

- `src/components/Dashboard.tsx`
- `src/components/Reports.tsx`
- `src/app/(auth)/layout.tsx`

**Documentação**

- `CONTEXT.md` — o verbete Etapa
- `ROADMAP.md` — a entrega

Os dois conjuntos são disjuntos. Podem ser implementados em paralelo por agentes
diferentes, com a única dependência sendo que os números novos do Dashboard
(`porEtapa.qualificado`) só ficam diferentes de zero depois de o bot rodar.
