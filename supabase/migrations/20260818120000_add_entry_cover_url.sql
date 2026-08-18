alter table public.entries
  add column cover_url text;

comment on column public.entries.cover_url is
  'URL pública da capa do jogo (jpg, png, webp). Opcional.';
