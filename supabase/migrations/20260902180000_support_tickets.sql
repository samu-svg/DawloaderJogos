-- Suporte in-site: tickets + mensagens. Sem SELECT público.
-- Admin via private.is_admin() (schema não exposto no PostgREST).

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Snapshot no momento da abertura (admin não lê profiles alheios via RLS).
  user_email text not null,
  subject text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_tickets_status_check
    check (status in ('open', 'answered', 'closed')),
  constraint support_tickets_subject_len
    check (char_length(subject) between 3 and 120),
  constraint support_tickets_email_len
    check (char_length(user_email) between 3 and 320)
);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint support_messages_body_len
    check (char_length(body) between 1 and 4000)
);

create index support_tickets_user_id_idx on public.support_tickets (user_id);
create index support_tickets_status_updated_idx
  on public.support_tickets (status, updated_at desc);
create index support_messages_ticket_id_idx
  on public.support_messages (ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

revoke all on table public.support_tickets from anon, public;
revoke all on table public.support_messages from anon, public;
grant select, insert, update on table public.support_tickets to authenticated;
grant select, insert on table public.support_messages to authenticated;

-- Tickets: dono ou admin
create policy support_tickets_select on public.support_tickets
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    or (select private.is_admin())
  );

create policy support_tickets_insert_own on public.support_tickets
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'open'
  );

create policy support_tickets_update on public.support_tickets
  for update to authenticated
  using (
    (select auth.uid()) = user_id
    or (select private.is_admin())
  )
  with check (
    (select auth.uid()) = user_id
    or (select private.is_admin())
  );

-- Mensagens: só se vê o ticket
create policy support_messages_select on public.support_messages
  for select to authenticated
  using (
    exists (
      select 1
      from public.support_tickets t
      where t.id = support_messages.ticket_id
        and (
          t.user_id = (select auth.uid())
          or (select private.is_admin())
        )
    )
  );

create policy support_messages_insert on public.support_messages
  for insert to authenticated
  with check (
    (select auth.uid()) = author_id
    and exists (
      select 1
      from public.support_tickets t
      where t.id = ticket_id
        and t.status <> 'closed'
        and (
          t.user_id = (select auth.uid())
          or (select private.is_admin())
        )
    )
  );

-- Impede o dono de alterar subject/email/user_id ou reabrir via UPDATE direto.
-- Atualizações internas (trigger de mensagem) usam app.support_internal=1.
create or replace function public.support_tickets_guard_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('app.support_internal', true) = '1' then
    return new;
  end if;

  if (select private.is_admin()) then
    if new.user_id is distinct from old.user_id
      or new.user_email is distinct from old.user_email
      or new.created_at is distinct from old.created_at then
      raise exception 'forbidden ticket field change';
    end if;
    return new;
  end if;

  if new.user_id is distinct from old.user_id
    or new.user_email is distinct from old.user_email
    or new.subject is distinct from old.subject
    or new.created_at is distinct from old.created_at then
    raise exception 'forbidden ticket field change';
  end if;

  if new.status is distinct from old.status and new.status <> 'closed' then
    raise exception 'users may only close tickets';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.support_tickets_guard_update() from public;

create trigger support_tickets_before_update
  before update on public.support_tickets
  for each row
  execute function public.support_tickets_guard_update();

create or replace function public.support_on_message_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
  current_status text;
begin
  select user_id, status
    into owner_id, current_status
  from public.support_tickets
  where id = new.ticket_id
  for update;

  if owner_id is null then
    raise exception 'ticket not found';
  end if;

  if current_status = 'closed' then
    raise exception 'ticket is closed';
  end if;

  perform set_config('app.support_internal', '1', true);

  if new.author_id = owner_id then
    update public.support_tickets
    set status = 'open',
        updated_at = now()
    where id = new.ticket_id;
  else
    update public.support_tickets
    set status = 'answered',
        updated_at = now()
    where id = new.ticket_id;
  end if;

  return new;
end;
$$;

revoke all on function public.support_on_message_insert() from public;
revoke execute on function public.support_on_message_insert() from anon, authenticated;

create trigger support_messages_after_insert
  after insert on public.support_messages
  for each row
  execute function public.support_on_message_insert();
