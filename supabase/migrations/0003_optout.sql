-- supabase/migrations/0003_optout.sql
-- Opt-out do disparo. Spec 2026-09-26 §5.4.
--
-- COLUNA, NÃO TAG. `tags` é reescrita por qualquer `qualificarLead` e se perde
-- em silêncio. Opt-out perdido é template de marketing para quem pediu para
-- parar: violação de política da Meta, e é a reputação do número que paga.
--
-- Guarda QUANDO, não um booleano: é o que se apresenta se alguém reclamar.
alter table leads add column if not exists optout_em timestamptz;
