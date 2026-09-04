-- Marca sessão vinda de recuperação de senha. O cliente autenticado não
-- consegue limpar esta coluna (UPDATE autenticado só em display_name).

alter table public.profiles
  add column if not exists password_reset_required boolean not null default false;

comment on column public.profiles.password_reset_required is
  'True after a recovery link is used until the password is actually changed.';
