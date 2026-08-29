-- Derruba a policy `entries_select_public` de public.entries.
--
-- O QUE ISSO FECHA
-- A policy (criada em 20260816180000_create_portfolios_and_entries.sql) dava
-- SELECT para os roles `anon` E `authenticated` em toda entry cujo portfólio
-- tivesse is_public = true. Como a NEXT_PUBLIC_SUPABASE_ANON_KEY é pública (vai
-- no bundle do site), qualquer pessoa podia chamar
--   GET /rest/v1/entries?select=external_url,storage_key
-- e obter o link direto de download do catálogo, contornando o paywall de
-- assinatura sem nem fazer login.
--
-- POR QUE NÃO FOI UM REVOKE DE COLUNAS
-- A primeira tentativa foi `revoke select (storage_key, external_url) ... from
-- anon`, que não funciona: o Supabase concede SELECT a anon/authenticated em
-- nível de TABELA, e o Postgres não permite revogar um subconjunto de colunas de
-- um grant de tabela — o privilégio de tabela continua cobrindo todas as colunas.
-- Seria preciso revogar a tabela inteira e re-conceder coluna por coluna, o que
-- quebraria a cada coluna nova. Derrubar a policy resolve por completo.
--
-- POR QUE É SEGURO
-- Depois do drop, a única policy de SELECT restante em entries é
-- `entries_all_own`, que exige p.owner_id = auth.uid(). A leitura pública passa a
-- ser exclusividade da service role, que ignora RLS — e SUPABASE_SERVICE_ROLE_KEY
-- está configurada nos três ambientes da Vercel, então
-- `createPublicReaderClient()` (web/lib/supabase/server.ts) nunca cai no fallback
-- anônimo. Catálogo público (web/lib/catalog.ts) e manifesto seguem funcionando,
-- e o painel do dono continua lendo pela `entries_all_own`.
--
-- SE A SERVICE ROLE FOR REMOVIDA NO FUTURO
-- O fallback anônimo volta a valer e, sem esta policy, o role `anon` não lê
-- nenhuma entry: as páginas públicas listam portfólios com zero jogos. É falha
-- FECHADA — o site quebra visivelmente, mas nenhum link de download vaza. A
-- correção nesse caso é repor a variável, não recriar a policy.

do $$
begin
  if not exists (
    select 1 from pg_class
    where oid = 'public.entries'::regclass and relrowsecurity
  ) then
    raise exception 'RLS não está habilitada em public.entries; derrubar a policy não protegeria nada.';
  end if;
end
$$;

drop policy if exists entries_select_public on public.entries;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'entries'
      and policyname = 'entries_select_public'
  ) then
    raise exception 'A policy entries_select_public ainda existe; o drop não teve efeito.';
  end if;
end
$$;

-- COMO REVERTER (rollback de emergência — reabre o vazamento)
-- Use só se o catálogo público cair por falta da service role e não for possível
-- repor a variável de ambiente na hora.
--
-- create policy entries_select_public on public.entries
--   for select to anon, authenticated using (
--     exists (
--       select 1 from public.portfolios p
--       where p.id = entries.portfolio_id and p.is_public
--     )
--   );
