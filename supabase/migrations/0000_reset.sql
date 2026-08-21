-- ════════════════════════════════════════════════════════════════════════════
-- ARTHA SYSTEM — RESET COMPLETO DO PROJETO SUPABASE
-- ════════════════════════════════════════════════════════════════════════════
--
-- ⚠️  DESTRUTIVO E IRREVERSÍVEL. Não há undo, não há lixeira.
--
-- Apaga o schema `public` INTEIRO — todas as tabelas, views, funções, tipos e
-- sequências, sejam da Artha ou não. Use apenas num projeto de teste ou num
-- projeto novo que será dedicado à Artha.
--
-- O Storage NÃO é limpo por aqui, e não é esquecimento: o Supabase instalou um
-- trigger `storage.protect_delete()` que recusa DELETE direto em
-- `storage.objects` / `storage.buckets` — a remoção tem de passar pela Storage
-- API. Um `delete` aqui aborta a transação inteira e o reset não acontece.
-- Use `npm run reset:storage` ou o painel. O bloco 6 mostra o que sobrou.
--
-- NÃO toca nos schemas internos do Supabase (`auth`, `storage`, `realtime`,
-- `vault`, `extensions`, `graphql`): apagá-los quebraria o projeto de um jeito
-- que só a recriação resolve.
--
-- ── COMO USAR ───────────────────────────────────────────────────────────────
--   1. SQL Editor do Supabase → cole este arquivo inteiro → Run.
--   2. `RESET_CONFIRMO=sim npm run reset:storage` para esvaziar o Storage.
--   3. Depois rode `0001_schema.sql` para recriar o schema da Artha.
--   4. Storage → New bucket → nome `midia`, com "Public bucket" DESLIGADO.
--   5. `SEED_CONFIRMO=sim npm run seed` para carregar os dados de demonstração.
--
-- Rodar duas vezes é seguro: tudo é `if exists`.
-- ════════════════════════════════════════════════════════════════════════════


-- ─── 1. O que está prestes a sumir ──────────────────────────────────────────
-- Aparece na aba "Messages"/"Notices" do SQL Editor. Leia antes de seguir.
do $$
declare
  n_tabelas int;
  n_funcoes int;
  n_buckets int;
  n_objetos int;
begin
  select count(*) into n_tabelas
    from information_schema.tables where table_schema = 'public';
  select count(*) into n_funcoes
    from information_schema.routines where routine_schema = 'public';

  select count(*) into n_buckets from storage.buckets;
  select count(*) into n_objetos from storage.objects;

  raise notice '─────────────────────────────────────────────';
  raise notice 'RESET — o que será apagado:';
  raise notice '  schema public : % tabelas/views, % funções', n_tabelas, n_funcoes;
  raise notice '  storage       : % arquivos em % buckets — NÃO apagados aqui,', n_objetos, n_buckets;
  raise notice '                  use: RESET_CONFIRMO=sim npm run reset:storage';
  raise notice '─────────────────────────────────────────────';
end $$;


-- ─── 2. O schema public inteiro ─────────────────────────────────────────────
-- `cascade` derruba, na ordem certa, tudo que dependia: tabelas, views,
-- funções (`tel_norm11`, `sem_acento`, `reservar_agendamentos`), tipos,
-- sequências, índices, triggers e as extensões que moram aqui.
--
-- Isto também remove as tabelas das publicações de Realtime automaticamente —
-- não é preciso mexer em `supabase_realtime` à mão.
drop schema if exists public cascade;
create schema public;


-- ─── 3. Devolver as permissões que o Supabase espera ────────────────────────
-- Recriar o schema o deixa sem grant nenhum. Sem este bloco, a `service_role`
-- não enxerga as tabelas que `0001_schema.sql` vai criar, e TODA rota da API
-- passa a responder "permission denied for schema public".
alter schema public owner to postgres;

grant usage  on schema public to postgres, anon, authenticated, service_role;
grant create on schema public to postgres, service_role;

-- Objetos criados DEPOIS deste ponto já nascem com as permissões corretas.
alter default privileges in schema public
  grant all on tables    to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to postgres, anon, authenticated, service_role;

comment on schema public is 'standard public schema';


-- ─── 4. Usuários de autenticação — OPCIONAL, descomente para apagar ─────────
-- O painel da Artha NÃO usa Supabase Auth (o login é decorativo até o B5), então
-- isto não é necessário para o reset funcionar. Fica comentado de propósito:
-- apagar usuário é irreversível, e se este projeto for compartilhado com
-- qualquer outra coisa, você derruba o acesso dela junto.
--
--   delete from auth.users;


-- ─── 5. Conferência ─────────────────────────────────────────────────────────
-- Esperado: `tabelas_restantes` e `funcoes_restantes` em ZERO.
-- `buckets_restantes` só zera depois do `npm run reset:storage` — vê-lo em 1
-- aqui é normal se você ainda não rodou o script.
select
  (select count(*) from information_schema.tables  where table_schema  = 'public') as tabelas_restantes,
  (select count(*) from information_schema.routines where routine_schema = 'public') as funcoes_restantes,
  (select count(*) from storage.buckets)                                            as buckets_restantes;
