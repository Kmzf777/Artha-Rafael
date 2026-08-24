# Deploy na Vercel

## Sobe o projeto inteiro, não "só o frontend"

Não há frontend e backend separados. É um Next.js com App Router: as 18 rotas
de `src/app/api/` viram funções serverless no mesmo deploy das telas. Um único
projeto na Vercel resolve tudo, e é isso que faz o webhook da Meta funcionar —
`/api/webhook` passa a ser um endpoint HTTPS público.

## Migration antes do código, sempre

A migration `supabase/migrations/0002_bot_qualificacao.sql` (coluna
`messages.button_id` e a tabela-trava `bot_acoes`) precisa estar aplicada no
SQL Editor do Supabase **antes** de subir o deploy que a usa — mesmo em ambiente
mesmo antes de o bot de qualificação entrar em cena.

O motivo é que `inserirMensagem` grava `button_id` em **toda** mensagem de
entrada no webhook, esteja o bot ligado ou não. Sem a coluna, o PostgREST
recusa a escrita, `inserirMensagem` relança o erro, e nenhuma mensagem de
entrada é salva — o bot fica isolado no seu próprio try/catch, mas a inserção
acontece antes dele e não está.

O sintoma é traiçoeiro: o webhook ainda responde 200 (a Meta considera a
entrega bem-sucedida e não reenvia), e o número simplesmente fica mudo, sem
erro visível em lugar nenhum do painel.

## 1. Criar o projeto

Importe `https://github.com/Kmzf777/Artha-Rafael` na Vercel.

**Root Directory: `./` (o padrão). Não existe pasta `frontend`.** O
`package.json` e o `next.config.ts` estão na raiz; apontar para qualquer
subpasta quebra o build. O framework é detectado sozinho e não há build
command a customizar.

### Só o sistema de mensagem?

Receber e responder mensagem **não depende do cron nem do motor de disparo**.
Para esse recorte bastam: `NEXT_PUBLIC_SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_ACCESS_TOKEN`,
`WHATSAPP_PHONE_NUMBER_ID`, `META_APP_SECRET`, `WEBHOOK_VERIFY_TOKEN`,
`PAINEL_USUARIO` e `PAINEL_SENHA`.

`CRON_SECRET` e `WHATSAPP_BUSINESS_ACCOUNT_ID` só são lidos quando alguém
chama a fila ou sincroniza templates — são getters, e não estourarem no boot
é proposital. Sem eles, Conversas funciona; Disparos e Templates reclamam.

## 2. Variáveis de ambiente

Todas em **Settings → Environment Variables**, para Production e Preview.
Os valores estão no `.env.local`, que não vai para o git.

| Variável | Onde conseguir |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL (**sem** `/rest/v1/`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` |
| `WHATSAPP_ACCESS_TOKEN` | Meta → System User token |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta → WhatsApp → API Setup |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Meta → WhatsApp → API Setup |
| `META_APP_SECRET` | Meta → App → Configurações básicas |
| `WEBHOOK_VERIFY_TOKEN` | você inventa; cola igual no painel da Meta |
| `CRON_SECRET` | você gera; a Vercel manda como `Authorization: Bearer` |
| `PAINEL_USUARIO` / `PAINEL_SENHA` | **obrigatórias em produção** — ver §5 |
| `DISPARO_LIMITE_DIARIO` | `250` |
| `GRAPH_API_VERSION` | `v21.0` |

**O bot de qualificação não tem chave.** Ele está sempre ativo: responde ao
primeiro contato de cada telefone e cala assim que um operador entra na conversa.
Não há variável para ligar ou desligar — se precisar parar, é deploy.

**`.env.local` não vale aqui.** Ele é local e está no `.gitignore` — nunca chega
à Vercel. Editar aquele arquivo não muda nada em produção; a variável tem de ser
criada no painel da Vercel.

**Variável nova exige redeploy.** A Vercel não injeta variável em deploy que já
está no ar: depois de criar ou alterar, use **Deployments → ⋯ → Redeploy**. Um
bot que continua mudo depois de você ligar `BOT_QUALIFICACAO` quase sempre é
isto.

### `!reset` — o comando de teste, sem configuração

Mandar `!reset` no WhatsApp apaga o lead e **todo o histórico** daquele número,
para o roteiro poder ser testado de novo sem trocar de chip. Não há variável: o
comando está sempre disponível.

O que o torna aceitável é o alcance — ele só apaga dado de **quem o mandou**,
nunca de terceiro. O risco que sobra é um lead de verdade digitar exatamente
`!reset` e perder o próprio histórico de conversa. Em troca, retestar não
depende de configuração nem de redeploy.

Se um dia isso incomodar, o commit que removeu a lista de autorizados
(`podeResetar`) está no histórico do git e reverter é barato.

## 3. Região: `gru1`

`vercel.json` fixa as funções em São Paulo porque o Supabase deste projeto
responde de lá (confirmado pelo `CF-Ray: …-GRU`). No padrão da Vercel
(Washington), **toda** consulta ao banco atravessaria o Atlântico duas vezes —
e `listarCampanhas` faz várias consultas por campanha.

Se o projeto Supabase for recriado em outra região, mude aqui junto.

## 4. Webhook da Meta

Depois do primeiro deploy:

1. Meta → App → WhatsApp → Configuração → Webhook
   - **Callback URL:** `https://<seu-projeto>.vercel.app/api/webhook`
   - **Verify token:** o mesmo valor de `WEBHOOK_VERIFY_TOKEN`
   - Assinar o campo **`messages`**
2. Inscrever a WABA:
   ```bash
   curl -X POST "https://graph.facebook.com/v21.0/<WABA_ID>/subscribed_apps" \
     -H "Authorization: Bearer <TOKEN>"
   ```
   Conferir com `GET` na mesma URL: `data` não pode voltar vazio.

O `GET /api/webhook` responde o `hub.challenge` em texto puro; o `POST` recusa
com 401 qualquer requisição sem `X-Hub-Signature-256` válido.

## 5. Autenticação do painel — não pule

Publicar sem `PAINEL_USUARIO` e `PAINEL_SENHA` deixa `POST /api/campanhas` e
`POST /api/mensagens` **abertos na internet**. São as rotas que gastam dinheiro
e mandam WhatsApp real para a base do cliente.

Com as duas configuradas, `src/middleware.ts` exige sessão em tudo. Sem sessão,
página redireciona para `/login` e rota de API responde `401` em JSON — nunca
HTML, senão o `fetch` do painel engasgaria tentando parsear.

O login é uma página do próprio sistema (`/login`), não o diálogo do navegador.
Ela troca a credencial por um cookie **httpOnly** assinado com HMAC-SHA256,
válido por 12 horas. A senha é a chave da assinatura, então **trocar a senha
derruba todas as sessões abertas**.

Três rotas ficam fora da sessão, cada uma com autenticação própria:

| Rota | Como se protege |
| --- | --- |
| `/api/webhook` | assinatura HMAC da Meta (`X-Hub-Signature-256`) |
| `/api/fila/processar` | `CRON_SECRET` no header |
| `/api/login` · `/api/logout` · `/login` | é onde a sessão nasce e morre |

Com as variáveis vazias o middleware libera geral — comportamento correto em
localhost, inaceitável em produção.

Isto é medida mínima até o B5 trazer contas por pessoa. Hoje a equipe
compartilha uma credencial, e por isso nenhuma ação fica atribuída a um nome.

## 6. Disparo em massa (opcional — não é preciso para mensagens)

O `vercel.json` **não declara cron**. Cron com granularidade menor que um dia é
recurso do plano Pro, e o sistema de mensagem não precisa dele.

Quando o disparo em massa entrar, a fila precisa de alguém que a drene. Três
saídas, da mais simples à mais automática:

1. **Botão "Processar fila agora"**, na aba Agendamentos. Já existe, processa
   um lote de 20 por clique.
2. **Cron externo** (cron-job.org, GitHub Actions) batendo em
   `POST /api/fila/processar` com o header `x-cron-secret`.
3. **Cron da Vercel**, no plano Pro. Basta acrescentar de volta ao
   `vercel.json`:
   ```json
   "crons": [{ "path": "/api/fila/processar", "schedule": "*/10 * * * *" }]
   ```

## 7. Storage

Supabase → Storage → New bucket → nome **`midia`**, com "Public bucket"
**desligado**. Sem ele o webhook continua funcionando, mas todo anexo recebido
se perde e `/api/midia/<id>` responde 404.

## 8. Conferir depois do deploy

```bash
# verificação do webhook (deve devolver 12345 em texto puro)
curl "https://<projeto>.vercel.app/api/webhook?hub.mode=subscribe&hub.verify_token=<TOKEN>&hub.challenge=12345"

# assinatura inválida (deve devolver 401)
curl -X POST "https://<projeto>.vercel.app/api/webhook" \
  -H "x-hub-signature-256: sha256=invalida" -d '{}'

# painel protegido (deve devolver 401)
curl -o /dev/null -w "%{http_code}\n" "https://<projeto>.vercel.app/api/metrics"
```
