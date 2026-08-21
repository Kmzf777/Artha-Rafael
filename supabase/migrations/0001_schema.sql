-- supabase/migrations/0001_schema.sql
-- Artha System — schema do backend real. Spec §4.
-- Copiável inteiro no SQL Editor do Supabase; a CLI não é necessária.

-- ─── tel_norm11: espelho EXATO de telNorm11() em src/lib/phoneUtils.ts ───────
-- Spec §2.1. Divergência entre as duas racha a conversa em dois cards.
create or replace function tel_norm11(t text) returns text
-- `set search_path` fecha o aviso `function_search_path_mutable` do linter do
-- Supabase. SET não afeta a imutabilidade, então a coluna gerada segue válida.
language plpgsql immutable set search_path = pg_catalog, pg_temp as $$
declare clean text; national text;
begin
  if t is null then return null; end if;
  clean := regexp_replace(t, '\D', '', 'g');
  if left(clean, 2) = '55' and length(clean) in (12, 13) then
    national := substr(clean, 3);
  else
    national := clean;
  end if;
  if length(national) = 11 then return national; end if;
  -- Fixo (assinante começando em 2-5) NUNCA ganha 9º dígito fabricado.
  if length(national) = 10 and substr(national, 3, 1) ~ '[6-9]' then
    return substr(national, 1, 2) || '9' || substr(national, 3);
  end if;
  return null;
end;
$$;

-- ─── sem_acento: espelho de semAcento() em src/lib/texto.ts ─────────────────
-- `unaccent()` é STABLE (depende do dicionário carregado), então não serve
-- direto numa coluna gerada. Passar o dicionário explicitamente torna o
-- resultado determinístico e a declaração IMMUTABLE passa a ser honesta.
-- Sem isto, buscar "jose" na tabela de Leads não acha "José" — regressão real
-- numa base brasileira, onde o mock em memória achava.
--
-- Onde a extensão mora varia por projeto: o SQL Editor instala em `public`, mas
-- projetos criados pelo assistente do Supabase já trazem `unaccent` no schema
-- `extensions`, e aí o `if not exists` abaixo não faz nada. Por isso o
-- `search_path` da função lista os dois — schema inexistente é ignorado em
-- silêncio, então a mesma declaração funciona nos dois casos. Sem isso a função
-- estoura com "function unaccent(...) does not exist" no primeiro insert.
create extension if not exists unaccent;

create or replace function sem_acento(t text) returns text
language sql immutable
set search_path = pg_catalog, public, extensions, pg_temp as $$
  select lower(unaccent('unaccent'::regdictionary, coalesce(t, '')))
$$;

-- ─── leads ───────────────────────────────────────────────────────────────────
create table if not exists leads (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  nome_norm     text generated always as (sem_acento(nome)) stored,
  telefone      text not null,
  tel_norm      text generated always as (tel_norm11(telefone)) stored,
  email         text,
  segmento      text not null default 'artha' check (segmento in ('artha','dhana','lucia')),
  stage         text not null default 'novo'
                check (stage in ('novo','contatado','qualificado','convertido','perdido')),
  plano_status  text not null default 'trial_expirado'
                check (plano_status in ('ativo','cancelado','trial_expirado','inadimplente')),
  plano_valor   numeric,
  ultimo_acesso_em    timestamptz,
  primeiro_contato_em timestamptz not null default now(),
  ultima_interacao_em timestamptz not null default now(),
  cidade        text,
  tags          text[] not null default '{}',
  notas         text,
  -- Lead de semente. Os telefones fictícios de `src/mock/db.ts` são celulares
  -- brasileiros ESTRUTURALMENTE VÁLIDOS, com DDD real — disparar para eles
  -- manda template de verdade para desconhecidos, queima a reputação do número
  -- e derruba a operação. O worker recusa enviar quando isto é true.
  ficticio      boolean not null default false,
  criado_em     timestamptz not null default now()
);
-- SEM predicado parcial de propósito. `ON CONFLICT` do PostgREST não repete o
-- predicado, e o Postgres recusa inferir índice único parcial (erro 42P10) —
-- o seed e o upsert de lead quebrariam. Em índice único, NULL já é distinto por
-- padrão, então vários leads de telefone fixo (tel_norm null) continuam
-- convivendo: o predicado só economizava espaço.
create unique index if not exists leads_tel_norm_uk on leads (tel_norm);
create index if not exists leads_stage_idx on leads (stage);
create index if not exists leads_segmento_idx on leads (segmento);
create index if not exists leads_ultimo_acesso_idx on leads (ultimo_acesso_em);

-- ─── messages: as colunas SÃO a forma de fio de conversationTypes.ts ─────────
create table if not exists messages (
  id                uuid primary key default gen_random_uuid(),
  message_id        text unique,               -- wamid: idempotência do webhook
  lead_id           uuid references leads(id) on delete set null,
  phone             text,                      -- SEMPRE os 11 dígitos canônicos
  phone_id          text,
  bsuid             text,
  contact_name      text,
  message_type      text not null default 'text',
  content           text,
  direction         text not null check (direction in ('inbound','outbound')),
  created_at        timestamptz not null default now(),
  raw_payload       jsonb,
  media_id          text,
  media_mime_type   text,
  media_storage_path text,
  reply_to_message_id text,
  status            text check (status in ('enviado','entregue','lido','falhou')),
  enviado_por       text,
  campanha_id       uuid
);
create index if not exists messages_card_idx on messages (phone_id, phone, created_at desc);
create index if not exists messages_lead_idx on messages (lead_id, created_at desc);
create index if not exists messages_inbound_idx on messages (phone, created_at desc)
  where direction = 'inbound';

-- ─── conversation_reads: não-lidas por card ─────────────────────────────────
create table if not exists conversation_reads (
  key         text primary key,               -- (bsuid ?? phone) || '::' || (phone_id ?? '')
  lido_ate    timestamptz not null default now()
);

-- ─── campanhas ───────────────────────────────────────────────────────────────
create table if not exists campanhas (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  template       text not null,
  segmento_alvo  text not null default 'todos',
  criada_em      timestamptz not null default now(),
  criada_por     text
);

-- ─── agendamentos: a fila de disparo ────────────────────────────────────────
create table if not exists agendamentos (
  id             uuid primary key default gen_random_uuid(),
  lead_id        uuid not null references leads(id) on delete cascade,
  campanha_id    uuid references campanhas(id) on delete cascade,
  template       text not null,
  variaveis      jsonb not null default '[]',
  agendado_para  timestamptz not null default now(),
  status         text not null default 'pendente'
                 check (status in ('pendente','enviando','enviado','falhou','cancelado')),
  tentativas     int not null default 0,
  erro           text,
  message_id     text,
  atualizado_em  timestamptz not null default now()
);
create index if not exists agendamentos_fila_idx on agendamentos (status, agendado_para);
-- Um lead não entra duas vezes na MESMA campanha. Critério de aceitação 8.
-- Sem predicado parcial pelo mesmo motivo do índice de `leads` acima: com
-- `where campanha_id is not null`, o upsert de `criarCampanha` estouraria com
-- 42P10 na primeira campanha real. Agendamento avulso (campanha_id null) segue
-- livre, porque NULL é distinto num índice único.
create unique index if not exists agendamentos_campanha_lead_uk
  on agendamentos (campanha_id, lead_id);

-- ─── templates: cache local do que existe na Meta ───────────────────────────
create table if not exists templates (
  nome        text primary key,
  meta_id     text,
  categoria   text not null check (categoria in ('MARKETING','UTILITY','AUTHENTICATION')),
  idioma      text not null default 'pt_BR',
  corpo       text not null,
  componentes jsonb not null default '[]',
  botoes      text[] not null default '{}',
  status      text not null default 'pendente'
              check (status in ('aprovado','pendente','rejeitado','pausado')),
  motivo_rejeicao text,
  sincronizado_em timestamptz
);

-- ─── quick_replies ───────────────────────────────────────────────────────────
create table if not exists quick_replies (
  id       uuid primary key default gen_random_uuid(),
  shortcut text not null unique,
  message  text not null
);

-- ─── webhook_events: payload cru, idempotência e depuração ──────────────────
create table if not exists webhook_events (
  id           uuid primary key default gen_random_uuid(),
  payload      jsonb not null,
  recebido_em  timestamptz not null default now(),
  processado_em timestamptz,
  erro         text
);
create index if not exists webhook_events_recebido_idx on webhook_events (recebido_em desc);

-- ─── reservar_agendamentos: a trava que impede disparo duplo ────────────────
-- `for update skip locked` é o que faz duas execuções sobrepostas do worker não
-- pegarem a mesma linha. Critério de aceitação 8.
create or replace function reservar_agendamentos(limite int)
returns setof agendamentos
language plpgsql as $$
begin
  -- Reaper. Um worker que morre entre reservar e enviar deixa a linha presa em
  -- 'enviando': nenhuma execução futura a recupera e o disparo some em
  -- silêncio. Cinco minutos é folga larga sobre o maxDuration de 60s da rota.
  update agendamentos
     set status = 'pendente', atualizado_em = now()
   where status = 'enviando'
     and atualizado_em < now() - interval '5 minutes';

  return query
  update agendamentos a
     set status = 'enviando', atualizado_em = now()
   where a.id in (
     select id from agendamentos
      where status = 'pendente' and agendado_para <= now()
      order by agendado_para
      limit limite
      for update skip locked
   )
  returning a.*;
end;
$$;

-- ─── RLS: deny all. Todo acesso é servidor, com service_role. Spec §8. ──────
alter table leads              enable row level security;
alter table messages           enable row level security;
alter table conversation_reads enable row level security;
alter table campanhas          enable row level security;
alter table agendamentos       enable row level security;
alter table templates          enable row level security;
alter table quick_replies      enable row level security;
alter table webhook_events     enable row level security;
