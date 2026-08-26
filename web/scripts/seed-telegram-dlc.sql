INSERT INTO public.entries (id, portfolio_id, label, destination, size_bytes, kind, storage_key, is_optional, group_name, sort_order, cover_url)
VALUES
('a1b2c3d1-0001-4000-8000-00000000002d', 'e0cbb9ed-9936-40ea-9dca-eb6bbfcbecda', 'Dead Space — DLC Extraction', 'Content/0000000000000000/45410857.zip', 191686028, 'hosted', 'jogos/content/45410857.zip', true, 'conteudo', 101, null),
('a1b2c3d1-0001-4000-8000-00000000002e', 'e0cbb9ed-9936-40ea-9dca-eb6bbfcbecda', 'Marvel Ultimate Alliance 2 — DLC', 'Content/0000000000000000/4156082F.zip', 163266938, 'hosted', 'jogos/content/4156082F.zip', true, 'conteudo', 102, null),
('a1b2c3d1-0001-4000-8000-00000000002f', 'e0cbb9ed-9936-40ea-9dca-eb6bbfcbecda', 'Gears of War — Map Pack DLC', 'Content/0000000000000000/4D5307D5.zip', 344805746, 'hosted', 'jogos/content/4D5307D5.zip', true, 'conteudo', 103, null),
('a1b2c3d1-0001-4000-8000-000000000030', 'e0cbb9ed-9936-40ea-9dca-eb6bbfcbecda', 'Tomb Raider Underworld — DLC Beneath the Ashes', 'Content/0000000000000000/534307EC.zip', 2463454208, 'hosted', 'jogos/content/534307EC.zip', true, 'conteudo', 104, null)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  destination = EXCLUDED.destination,
  size_bytes = EXCLUDED.size_bytes,
  storage_key = EXCLUDED.storage_key,
  is_optional = EXCLUDED.is_optional,
  group_name = EXCLUDED.group_name,
  sort_order = EXCLUDED.sort_order;
