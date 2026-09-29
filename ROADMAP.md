# ROADMAP — Artha System

## Concluído (2026-08-17) — frontend de demonstração

Telas navegáveis com dados fictícios, sem backend. Spec:
`docs/superpowers/specs/2026-08-17-artha-system-frontend-design.md`.

### Onda 1 — fundação

- ✅ **Sistema de design, shell e limpeza (T1)** — remoção da herança de crédito
  consignado (rotas de API, Supabase, Meta, scraper); tokens do DESIGN.md em
  `globals.css` com o acento Ouro Artha e tema escuro por inversão de
  polaridade; Inter via `next/font/google`; alternador de tema sem flash;
  re-skin de todo `src/components/ui/*` para o chrome da pílula 999px; Sidebar
  com as nove abas e a barra indicadora de 3px em `--accent`; registro das nove
  abas em `tabs.ts` e no switch de `page.tsx`.
- ✅ **Camada de dados fictícios (T2)** — `src/mock/` com 760 leads (148 ativos /
  612 inativos), 14 conversas, 6 campanhas, 40 agendamentos, 5 templates;
  semente determinística; `getMetrics()` derivado do dataset; hooks de
  `@tanstack/react-query` sobre o store em memória.

### Onda 2 — telas

- ✅ Dashboard (T3) · Conversas (T4) · Leads (T5) · Disparos e Agendamentos (T6)
  · Reativação (T7) · Relatórios e Painel Executivo (T8) · Login e Configurações (T9)

### Onda 3 — integração

- ✅ `npm run build`, `npm run lint` e `npm test` limpos; varredura de
  conformidade (zero literal de cor/raio/tamanho de fonte no JSX; zero import de
  backend; nenhum nome de persona em copy); consistência numérica entre
  Dashboard e Reativação; as nove telas nos dois temas; `TREE.md` atualizado.

## Em execução (2026-08-20) — backend real (B1 + B2 + B3)

Deixar de ser mockup: Supabase Postgres, WhatsApp Cloud API em produção
(envio + webhook), motor de disparo e criação interna de templates. Spec:
`docs/superpowers/specs/2026-08-20-artha-backend-real-design.md`.

### Pronto

- ✅ **Schema** — migration única `supabase/migrations/0001_schema.sql`:
  `tel_norm11()` e `sem_acento()` espelhando as funções TypeScript, tabelas
  `leads` / `messages` / `conversation_reads` / `campanhas` / `agendamentos` /
  `templates` / `quick_replies` / `webhook_events`, índices não-parciais,
  `reservar_agendamentos()` (`for update skip locked` + reaper de 5 min), RLS
  `deny all`.
- ✅ **B1 — persistência** — `ehInativo`, `diasSemAcesso`, `recorteReativacao`,
  `getMetrics` e `podeDisparar` migraram de `src/mock/metrics.ts` para
  `src/lib/regras.ts`, puras sobre `Lead[]`; `src/mock/metrics.ts` reexporta
  de lá para os testes existentes continuarem valendo. `src/server/repo/*`
  espelha `src/mock/store.ts` função por função contra o Postgres. Rotas
  `/api/leads`, `/api/leads/[id]`, `/api/conversas`,
  `/api/conversas/[key]/mensagens`, `/api/conversas/[key]/lida`,
  `/api/metrics`, `/api/reativacao`, `/api/quick-replies`. `src/mock/db.ts`
  sobrevive como seed (`scripts/seed.ts`), com `npm run seed` recusando rodar
  sem `SEED_CONFIRMO=sim`.
- ✅ **B2 — WhatsApp em produção** — `GET /api/webhook` (verificação) e
  `POST /api/webhook` (assinatura HMAC-SHA256 de `X-Hub-Signature-256` em
  tempo constante, grava em `webhook_events`, responde 200 antes de processar,
  idempotência por `message_id`); tratamento de eventos `messages` e
  `statuses` com `avancarStatus` (`src/lib/statusEntrega.ts`) garantindo que o
  status nunca retrocede; `POST /api/mensagens` para envio livre, recusando
  409 fora da janela de 24h calculada no servidor; mídia de entrada arquivada
  no Storage via `src/server/repo/midia.ts`, servida por `/api/midia/[id]`
  como signed URL.
- ✅ **B3 — disparos e templates** — décima aba **Templates**
  (`src/components/Templates.tsx`), registrada em `src/lib/tabs.ts`,
  `src/app/(app)/page.tsx` e `src/components/Sidebar.tsx`; validação local em
  `src/lib/templates.ts` (contagem de `{{n}}`, botão URL não aceita
  parâmetro — o erro `132018` visto no teste de envio); `POST /api/campanhas`
  enfileira um agendamento por lead do recorte; `POST /api/fila/processar`
  drena a fila protegido por `CRON_SECRET`, respeitando
  `DISPARO_LIMITE_DIARIO` (degrau conservador de 250 conversas iniciadas/24h);
  `podeDisparar(lead)` checada na montagem do recorte **e** de novo dentro do
  worker, imediatamente antes da chamada à Meta.
- ✅ Hooks trocaram o `queryFn` do store em memória para `fetch` nas rotas.
  Atualização por polling: `refetchInterval` de 5s na lista de conversas, 3s
  na timeline aberta (spec §3.3) — Realtime fica como upgrade, ver [NA FILA].
- ✅ `npm run lint`, `npx tsc --noEmit` e `npm run build` limpos; `npm test` —
  205 passando e 14 pulados (paridade `tel_norm11`, esperando banco), todos
  passando, incluindo a paridade de `telNorm11()` contra os casos canônicos de
  `src/lib/telefoneCasos.ts`. (`npm run build` não foi rodado nesta atualização
  de docs.)

### Pendente — projeto Supabase (atualizado em 2026-08-24)

As credenciais (`NEXT_PUBLIC_SUPABASE_URL` e a service role key) já estão
preenchidas em `.env.local` — ver a seção de 2026-08-24 abaixo. Três itens
deste recorte seguem pendentes, agora por exigirem passo manual no projeto,
não por falta de credencial:

- **Aplicar a migration** `0001_schema.sql` no projeto (SQL Editor — não exige
  CLI).
- **Criar o bucket `midia`, privado**, no Storage — é o destino de
  `src/server/repo/midia.ts` e não existe automatizado na migration.
- **O teste ponta a ponta** (critério de aceitação 10 da spec): disparo real
  para `5534988861441`, resposta do lead pelo webhook, card correto na tela
  de Conversas com o nono dígito reconciliado, resposta dentro da janela de
  24h. Os critérios 1–9 da spec não dependem disso e estão cobertos por
  código e teste automatizado; o 10 só roda com o projeto Supabase de pé e a
  URL do webhook exposta publicamente (túnel `cloudflared` em dev).

### Correções da revisão final (2026-08-20)

Uma revisão independente achou dez defeitos depois de o código estar de pé.
Os três que mais importavam:

- **Nenhuma rota de envio tinha autenticação.** `src/middleware.ts` põe basic
  auth em tudo, menos `/api/webhook` (assinatura HMAC da Meta) e
  `/api/fila/processar` (`CRON_SECRET`). Publicar sem isso deixaria
  `POST /api/campanhas` aberto na internet. Medida mínima até o B5.
- **Nada drenava a fila.** `vercel.json` com cron de 10 min, mais o botão
  "Processar fila agora" em Agendamentos para desenvolvimento.
  ⚠️ **Cron a cada 10 min exige plano Pro da Vercel** — no Hobby só há cron
  diário, e 612 leads levariam meses.
- **`/api/templates/sync` nunca era chamado**, então template aprovado pela
  Meta ficava "pendente" para sempre e a campanha nunca ficava possível.
  Botão "Sincronizar com a Meta" na aba Templates.

Também: `env ARTHA (1).txt` passou a ser coberto pelo `.gitignore` (o padrão
`.env*` não o alcançava, e ele carrega o token e o app secret em texto puro);
`/api/reativacao` passou a usar a mesma régua de `podeDisparar` que
`/api/campanhas`; o relógio congelado do mock saiu de todas as telas que leem
do Postgres, via `useAgora()`; e `/api/conta` passou a mostrar o número WABA
real no lugar do fictício.

## Em execução (2026-08-24) — bot de qualificação por botões

Automação de botões no modelo da Mar Azul demonstrado na reunião de 10/08: sem
IA, dentro do webhook, sem cron. Duas perguntas — produto (Artha ou Dhana) e
momento — disparadas no primeiro contato de cada telefone. Spec:
`docs/superpowers/specs/2026-08-24-bot-qualificacao-botoes-design.md`.

O painel deixou de falar de reativação junto: não há base inativa, e o eixo
passou para atendimento e qualificação. Dashboard e Relatórios passaram a medir
leads, conversas e qualificação; a tela de login parou de prometer Reativação e
Disparos, que saíram do menu.

Bloqueio que caiu: `NEXT_PUBLIC_SUPABASE_URL` e a service role key **estão**
configuradas. A migration `0002_bot_qualificacao.sql` (coluna `messages.button_id`
e a tabela-trava `bot_acoes`) ainda precisa ser aplicada no SQL Editor — sem ela
o bot estoura com erro de coluna inexistente.

Bloqueio que continua: o teste ponta a ponta depende do número WABA, que a
reunião deixou pendente no chip novo. E `BOT_QUALIFICACAO` precisa valer `on` na
Vercel — o padrão é desligado de propósito.

## Concluído (2026-08-25) — URA de respostas

O bot deixou de ser formulário de triagem. Os sete finais do roteiro caíam todos
na mesma frase de espera: aperta X, sai "aguarde um humano". Agora cada id
terminal entrega texto próprio. Spec:
`docs/superpowers/specs/2026-08-25-ura-de-respostas-design.md`.

O nível 2 trocou de propósito. Era "Você já usou a Artha?" e "Quantos clientes
você atende?", perguntas que serviam à operação; passou a ser "O que você quer
saber?", que serve a quem apertou e qualifica igual. Quem aperta "Quero começar"
vale mais que quem responde "já testei".

`src/lib/bot/estado.ts` não foi tocado: o motor já devolvia os ids terminais e
nunca decidiu texto. A mudança inteira é dado em `roteiro.ts` mais duas linhas
em `executar.ts`.

**Dívida que nasce aqui:** o bot passou a afirmar preço. A fonte é
`https://artha.ia.br`, lida em 2026-08-25, e `RESPOSTA_POR_ID['p2:artha_preco']`
é uma string literal. Nada liga as duas pontas, então quando o preço mudar no
site alguém tem de trocar a string à mão. O `CLAUDE.md` foi corrigido junto: ele
dizia "R$97/mês" e omitia a taxa de adesão de R$100.

**Ainda em aberto:** Dhana não tem preço público em lugar nenhum, então o ramo do
planejador não tem botão de preço e quem pergunta chega em gente.

**Contagem de testes:** este ROADMAP ainda diz "205 passando e 14 pulados" na
seção de 2026-08-20. Aquele número é de antes do banco estar configurado e de
antes do bot de qualificação existir. Hoje `npm test` dá 291 passando e 1 pulado.

## Concluído (2026-09-28) — funil de retomada

A dívida de 17 dias com o cliente. A oferta que ele fechou no WhatsApp em
2026-09-09 — isenção da taxa de adesão de R$100, R$197 vira R$97 no primeiro
mês, para quem foi trial e já tinha conectado pelo menos um banco — virou funil.
Spec: `docs/superpowers/specs/2026-09-26-funil-de-retomada-design.md`.

**O defeito consertado.** Quem apertava um quick reply de template caía no
portão de primeiro contato de `estado.ts` e ouvia a P1 de segmentação. O
disparo grava autoria nula, então `ehDoBot` era falso e o inbound passava por
primeiro contato. O `button_id` era descartado, e a coorte de maior intenção
respondia duas vezes a mesma pergunta. `ehIdRtv` abre uma porta antes desse
portão, e o botão do template passou a SER a primeira pergunta — a coorte é
100% Artha B2C e não havia o que segmentar.

**O payload.** `componentesDeBotao` manda o payload do quick reply no envio,
resolvido pelo prefixo `mkt_rtv` do nome do template. Payload de botão de
template não é definido na criação; sem mandar, a Meta usa o próprio título do
botão, que não é id de roteiro nenhum.

**Opt-out passou a existir.** Coluna `leads.optout_em` (migration 0003),
gravada ANTES da confirmação e `podeDisparar` recusando. Não havia nenhum, e o
template já trazia o botão. Quem escreve a coluna grava ISO ou `null`, nunca
string vazia — `podeDisparar` testa com `!optoutEm`.

**Dívida que nasce aqui:** o bot afirma a isenção de R$100, e ela não está
publicada em lugar nenhum. O preço ao menos dá para conferir em `artha.ia.br`.
Se o cliente mudar a oferta, `TEMPLATE_RTV.corpo` muda à mão.

**Consequência aceita:** depois do opt-out a conversa continua na fila de
atendimento, porque `esperandoResposta` conta toda mensagem do bot. Consertar
mexeria em régua de três telas por 1 card de 12.

### Três quebras que a revisão final achou, e que o verde escondia

`lint`, `tsc`, `build` e 301 testes estavam verdes, e o código estava errado nos
três pontos abaixo. Ficam registrados porque o modo de falha é o que interessa.

**O ramo `rtv` não tinha estado terminal.** O bot respondia "me conta o que
travou", a pessoa escrevia, e levava a P1 de segmentação de volta — o mesmo
turno queimado que esta onda existe para consertar, deslocado um passo. A régua
de "roteiro encerrado" não pegava por duas razões independentes: o corte dela é
a primeira fala do bot, e numa campanha o toque vem ANTES dela; e
`ehRespostaTerminal` identifica terminal por id DESCONHECIDO, coisa que um id
`rtv:` deixou de ser ao entrar em `ehIdConhecido`. Os testes 30–34 paravam todos
no toque do botão; ninguém testou o turno seguinte.

**O recorte alcançava a caixa de entrada inteira.** `acharOuCriarLeadPorTelefone`
insere só `nome`, `telefone`, `stage` e `segmento`; o resto cai no default do
schema, que é `plano_status = 'trial_expirado'` e `ultimo_acesso_em` nulo. Logo
todo número que um dia escreveu para a Artha entrava em
`recorteReativacao({ planoStatus: 'trial_expirado' })`, indistinguível dos 12
importados. `FiltroRecorte` ganhou `tag`, e o importador marca o lote.

**O opt-out dependia de o bot ter permissão de falar.** A gravação morava em
`executar.ts`, atrás de `if (passo.acao === 'calar') return`, e o bot cala para
sempre em conversa onde um operador já respondeu. Quem já falou com o
atendimento apertava "Não quero receber", nada gravava, e a campanha seguinte o
incluía de novo. Numa base de trial expirado esse é o caso comum. A gravação
passou para `POST /api/webhook`, único lugar que vê todo inbound.

### Como disparar este lote, e só ele

```
POST /api/campanhas
{ "nome": "...", "template": "mkt_rtv_isencao_01",
  "filtro": { "tag": "rtv-lote-2026-09" },
  "variaveisPorLead": ["nome"] }
```

**Filtrar por `planoStatus` alcança gente que não é do lote.** A tag é escrita
pelo `scripts/importar-leads.ts` e é a única coisa que separa os importados de
quem chegou pelo webhook.

O importador usa `ignoreDuplicates: true`: quem já existia é pulado inteiro e
**não** ganha a tag, ficando fora da campanha. É deliberado — sem isso,
reimportar devolvia `stage` para `novo` em quem o bot já tinha qualificado. O
script imprime quantos pulou.

**Limitação conhecida:** opt-out é por `button_id`, não por texto. Quem escrever
"não quero mais receber" em vez de apertar o botão não é marcado.

**Pergunta aberta ao cliente, que bloqueia o disparo e não o código:** o cupom
tem mecanismo? Ele disse "podemos oferecer", que é intenção. Por isso o
`rtv:voltar` entrega a humano em vez de afirmar que a isenção já está aplicada.

## Concluído (2026-09-28) — triagem antes de qualificar

Um toque virava `qualificado`, e o gestor cortou: *"só uma mensagem >
qualificação, fica direto demais"*. Spec:
`docs/superpowers/specs/2026-09-28-triagem-e-variantes-design.md`.

O argumento é do próprio cliente. Ele escreveu que a coorte "não comprou por
algum motivo" e não sabe qual. A triagem pergunta isso, e cada resposta arma a
fala de abertura dele: preço é objeção que a isenção resolve, conexão é suporte
que ela não resolve, dúvida é falta de entendimento do produto.

`rtv:voltar` deixou de ser terminal e passou a abrir `RTV2`. Só os terminais
qualificam, mais `rtv:problema`, que o gestor mandou manter porque "tive um
problema" já é sinal concreto, diferente de "quero voltar", que é vago.

**O motor precisou aprender a diferença entre abrir e fechar.** Duas armadilhas
caíram junto: o portão de estado terminal contava `rtv:voltar` e calaria o bot no
meio da própria triagem; e o fallback de texto livre só conhecia `idP1`, então
quem abandonasse a triagem escrevendo recebia a P1 de segmentação. Era a mesma
família do defeito consertado de manhã, num caminho novo.

`ehTerminalRtv` é DERIVADO de quem abre (`ehIdRtv(id) && perguntaRtv2(id) ===
null`), nunca escrito à mão. Um botão do nível 1 que ganhe triagem própria numa
revisão futura sai da lista de terminais sozinho, em vez de calar o bot no meio
da própria pergunta. Lista escrita à mão foi o que produziu o defeito de manhã.

**Três variantes de disparo**, com os mesmos três botões de propósito: assim o
que se aprende é qual mensagem funciona, não qual botão. `mkt_rtv_isencao_01`,
`mkt_rtv_trial_01` e `mkt_rtv_pergunta_01`. O script submete as três numa
passada e não para na primeira recusa.

**O ponto único de falha do funil morreu.** Template começando em `mkt_rtv` que
não esteja em `TEMPLATES_RTV` agora **lança** em vez de sair sem payload. Antes,
um rename silenciava o funil inteiro: a Meta usaria o título do botão como id e a
base voltaria toda para a P1, sem erro, sem log e sem teste vermelho. O `throw`
sobe pelo try/catch de `fila.ts` e vira agendamento falho com a mensagem visível.
Alcança de propósito o `mkt_rtv_voce_sabe_01` que está `APPROVED` na conta
assinando "Lúcia".

**Quebra de comparabilidade:** número de qualificados antes e depois desta onda
não se compara. Passou a exigir a resposta da triagem.

**Correção de copy:** "Você conecta todos os seus bancos e testa por um mês" saiu
do corpo. Vinha do argumento do cliente, onde "testar por 1 mês" é o primeiro mês
**pago** de R$97 — o desconto é a isenção, não gratuidade. `artha.ia.br` não
vende trial em lugar nenhum, e lido por quem teve trial expirado aquilo lê como
período grátis. Um teste trava "grátis", "gratuito", "devolução" e "reembolso"
fora dos corpos.

**Botão que abre re-abre; botão que fecha cala.** O teste 38b registra isso e
prova que a porta orgânica já se comportava assim com `p1:artha`. Não é exceção
do ramo de campanha.

### Estado verificado em 2026-09-28

Supabase de volta. `npm run lint`, `npx tsc --noEmit` e `npm run build` limpos;
`npm test` dá **340 passando e 1 pulado**, com os 14 de paridade `tel_norm11`
contra o Postgres agora incluídos e verdes.

**A migration `0003_optout.sql` NÃO está aplicada.** As tabelas de `0001` e
`0002` existem, mas `leads.optout_em` não. Sem ela `marcarOptout` estoura com
`42703` e o botão "Não quero receber" não marca ninguém.

## Concluído (2026-09-29) — botões na conversa

O gestor: *"em conversas, as mensagens enviadas pelo bot de botão não mostra as
opções de botão que foram enviadas ao lead, para quem está usando o crm fica
confuso"*. Spec:
`docs/superpowers/specs/2026-09-29-botoes-na-conversa-design.md`.

Eram **dois** defeitos com o mesmo sintoma. O bot nunca gravou os botões —
`gravarSaida` grava só `content`. E o disparo gravava o NOME do template em
`content`, então a bolha mostraria `mkt_rtv_isencao_01` como texto da mensagem, e
o casamento com o template cadastrado comparava corpo contra nome e nunca achava.

**Os botões são derivados do roteiro, não gravados.** O corpo de uma pergunta do
bot é string literal exata, então casar é igualdade, não heurística — e derivar
conserta retroativamente todo o histórico que já está no banco, coisa que gravar
no envio não faria. A falha é muda, nunca errada: corpo que não casa devolve
bolha sem botão, que é o comportamento anterior.

**Uma ambiguidade real teve de ser resolvida.** Os dois ramos do nível 2 têm
`corpoRepetido` idêntico ("O que você quer saber?") e botões diferentes. Casar só
por texto mostraria os botões da Dhana para quem está na Artha. A desambiguação
usa o último `p1:*` respondido antes da bolha, o mesmo sinal que `proximoPasso`
carrega como `idP1`. O par de testes 3/4 foi validado por mutação: trocando a
regra por "devolve a primeira candidata", só eles ficam vermelhos.

**O clicado casa por id no caminho do bot, por texto no de template.** Id é
contrato, título é copy. A assimetria é do que a Meta entrega: o toque em quick
reply de template chega com o título como conteúdo, e o template cadastrado só
guarda títulos. Consequência: renomear um botão num template aprovado desmarca
retroativamente os toques antigos dele. O caminho do bot não sofre disso.

**A fila passa a gravar o texto renderizado.** `renderizarCorpo` substitui as
variáveis, e variável sem valor fica literal — apagá-la produziria um texto que
não é o que o lead recebeu. Quando `variaveis` vem vazio, o `{{1}}` aparece na
bolha, e está certo: `componentes` omite o bloco `body` nesse caso, então foi
isso que a Meta recebeu.

**Contrato de dado:** mensagem antiga de disparo continua com o nome, nova com o
texto. A régua resolve cada uma pelo que ela tem, e não há migração de histórico.

### O que NÃO está provado

`npm run lint`, `npx tsc --noEmit` e `npm run build` limpos; `npm test` dá **359
passando e 1 pulado**. A lógica tem 13 testes próprios, um deles validado por
mutação.

**A tela não foi verificada com dado real.** Rodar a régua contra as linhas do
banco devolveu zero bolhas com botão — corretamente, porque o `!reset` de
2026-09-28 apagou todas as mensagens do bot e o que sobrou é um disparo simulado
com `enviado_por` nulo, que a guarda de autoria exclui de propósito. Não existe
hoje, no banco, uma pergunta de bot para renderizar. Provar exige o bot voltar a
perguntar, e o painel em produção servir esta branch.

## [NA FILA]

- **B5 — base real e autenticação.** Depende do CSV dos 612 inativos, ainda
  não entregue pelo cliente. Inclui login com papéis: hoje a tela de login é
  decorativa (`src/app/(auth)/login/page.tsx` só navega, não autentica), e o
  painel não pode ir para a internet antes disso.
- **B4 — agente de IA.** Depende do JSON exportado do n8n e das três bases de
  conhecimento (Lúcia/Clara/LucIA — nome ainda em aberto), nenhum entregue.
- **Realtime do Supabase** no lugar do polling atual (spec §3.3) — troca
  disponível sem reescrita de tela, pelo mesmo padrão de mutação que os hooks
  já usam.
- **Rotacionar o `WHATSAPP_ACCESS_TOKEN`.** Circulou em texto puro no arquivo
  `env ARTHA (1).txt` e é system user permanente (`expires_at: 0`) — não
  expira sozinho. Rotacionar na Business Manager quando o cliente puder.
- **`name_status: DECLINED`.** O nome de exibição "Artha Finanças Pessoais" foi
  recusado pela Meta — não bloqueia envio, bloqueia o nome aparecer para o
  destinatário. Reenviar para revisão na Business Manager.
- **Nome da persona** — o site anuncia "Clara IA", a LucIA é produto vendido a
  terceiros e a transcrição chama de "Lúcia". Três nomes em circulação; a
  escolha é do cliente. Até lá, a voz é institucional e nenhuma copy cita nome.
- **Cor semântica em tabela densa** — a demo usa cinza + ícone + rótulo, fiel ao
  DESIGN.md. Um operador varrendo 120 disparos em produção depende disso para
  achar as falhas, o que é mais lento que um vermelho. Revisitar agora que a
  operação é real.
