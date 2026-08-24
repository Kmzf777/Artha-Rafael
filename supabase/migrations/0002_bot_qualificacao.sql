-- supabase/migrations/0002_bot_qualificacao.sql
-- Bot de qualificação por botões. Spec 2026-08-24, §3.6 e §6.2.

-- O id do botão tocado. `content` continua guardando o TÍTULO, que é o que a
-- tela de Conversas mostra; o id é o que o roteiro usa para rotear, porque
-- título é copy e muda sem aviso.
--   interactive.button_reply.id  → mensagem interativa do bot
--   button.payload               → botão de resposta rápida de template
alter table messages add column if not exists button_id text;

-- Trava de concorrência do bot. NÃO é máquina de estados: guarda só o fato de
-- que aquele inbound já foi tratado. O estado do roteiro é derivado do
-- histórico de mensagens (§3.5).
--
-- A Meta reentrega quando a resposta demora mais que ~5s. Reentrega em série a
-- derivação resolve sozinha; duas entregas SIMULTÂNEAS leem o mesmo histórico
-- antes de qualquer uma escrever, e as duas mandariam o botão. O insert antes
-- do envio é o que serializa.
create table if not exists bot_acoes (
  inbound_message_id text primary key,
  criado_em timestamptz not null default now()
);

alter table bot_acoes enable row level security;
-- Sem policy: `deny all`, como todas as outras tabelas. O acesso é pelo
-- service role do servidor, que ignora RLS.
