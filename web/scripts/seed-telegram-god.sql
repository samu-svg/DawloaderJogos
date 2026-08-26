INSERT INTO public.entries (id, portfolio_id, label, destination, size_bytes, kind, storage_key, is_optional, group_name, sort_order, cover_url)
VALUES
('a1b2c3d1-0001-4000-8000-000000000027', 'e0cbb9ed-9936-40ea-9dca-eb6bbfcbecda', 'Minecraft: Xbox 360 Edition', 'Content/0000000000000000/584111F7.zip', 2013976589, 'hosted', 'jogos/Minecraft Ultime Edition +(Todas DLCs).zip', false, 'jogo', 95, 'https://download-ssl.xbox.com/content/images/66acd000-77fe-1000-9115-d802584111f7/1033/boxartlg.jpg'),
('a1b2c3d1-0001-4000-8000-000000000028', 'e0cbb9ed-9936-40ea-9dca-eb6bbfcbecda', 'Ben 10: Ultimate Alien Cosmic Destruction PT-BR', 'Content/0000000000000000/445007F7.zip', 5456330889, 'hosted', 'jogos/Ben 10 Ultimate Alien Cosmic Destruction br.zip', false, 'jogo', 96, 'https://download-ssl.xbox.com/content/images/66acd000-77fe-1000-9115-d802445007f7/1033/boxartlg.jpg'),
('a1b2c3d1-0001-4000-8000-000000000029', 'e0cbb9ed-9936-40ea-9dca-eb6bbfcbecda', 'Battlefield: Bad Company 2 PT-BR', 'Content/0000000000000000/454108A8.zip', 5230697950, 'hosted', 'jogos/BattleField Bad Company 2 PT-BR.zip', false, 'jogo', 97, 'https://download-ssl.xbox.com/content/images/66acd000-77fe-1000-9115-d802454108a8/1033/boxartlg.jpg'),
('a1b2c3d1-0001-4000-8000-00000000002a', 'e0cbb9ed-9936-40ea-9dca-eb6bbfcbecda', 'Borderlands 2 PT-BR', 'Content/0000000000000000/5454087C.zip', 5948625318, 'hosted', 'jogos/Bordelands 2  PT-BR.zip', false, 'jogo', 98, 'https://download-ssl.xbox.com/content/images/66acd000-77fe-1000-9115-d8025454087c/1033/boxartlg.jpg'),
('a1b2c3d1-0001-4000-8000-00000000002b', 'e0cbb9ed-9936-40ea-9dca-eb6bbfcbecda', 'Prototype 2', 'Content/0000000000000000/415608A7.zip', 7838841868, 'hosted', 'jogos/Prototype 2.zip', false, 'jogo', 99, 'https://download-ssl.xbox.com/content/images/66acd000-77fe-1000-9115-d802415608a7/1033/boxartlg.jpg'),
('a1b2c3d1-0001-4000-8000-00000000002c', 'e0cbb9ed-9936-40ea-9dca-eb6bbfcbecda', 'Gears of War: Judgment PT-BR', 'Content/0000000000000000/4D530A26.zip', 7498086952, 'hosted', 'jogos/Gears of War Judgment - Dublado.zip', false, 'jogo', 100, 'https://download-ssl.xbox.com/content/images/66acd000-77fe-1000-9115-d8024d530a26/1033/boxartlg.jpg')
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  destination = EXCLUDED.destination,
  size_bytes = EXCLUDED.size_bytes,
  storage_key = EXCLUDED.storage_key,
  sort_order = EXCLUDED.sort_order,
  cover_url = EXCLUDED.cover_url;
