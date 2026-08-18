-- Só o administrador pode criar portfólios (por enquanto).
drop policy if exists portfolios_insert_own on public.portfolios;

create policy portfolios_insert_admin on public.portfolios
  for insert to authenticated
  with check (
    (select auth.uid()) = owner_id
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'douradosamuel50@gmail.com'
  );
