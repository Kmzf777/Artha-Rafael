---
paths:
  - "supabase/**"
---

# Migrations do Supabase

- Numeração sequencial: `supabase/migrations/000N_<assunto>.sql`.
- **Aplicação é manual**, colando o SQL no SQL Editor do Supabase, e acontece
  **antes** do deploy do código que usa a mudança. Não há CLI do Supabase nem
  passo de migração no deploy da Vercel.
- O modo de falha é mudo: o PostgREST recusa escrita em coluna que não existe, o
  webhook ainda responde 200 e o número para de responder sem erro visível (ver
  DEPLOY.md, "Migration antes do código").
- Ao criar uma migration, registre no ROADMAP se ela já foi aplicada.
- Tabela nova liga RLS sem policy (`deny all`), como as de `0001_schema.sql`: só
  o servidor acessa, pela service role.
- `0000_reset.sql` apaga o schema `public` inteiro. Nunca rode em produção.
