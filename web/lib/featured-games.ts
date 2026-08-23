/**
 * Jogos mais famosos e com maior chance de download no acervo Xbox 360.
 * Ordem = rank (1 = mais popular). IDs são prefixos do UUID da entry principal.
 */
const FEATURED_RANK: Record<string, number> = {
  // Esportes — altíssima demanda no Brasil
  c3dbe2a1: 1, // FIFA 15 PT-BR
  "5f202930": 2, // FIFA 19
  d412001a: 3, // PES 2018 PT-BR
  d9241d79: 4, // Copa do Mundo FIFA 2014 (En,Pt)
  cb2e042f: 5, // PES 2010 + DLC
  "1ba41a65": 6, // FIFA 06

  // FPS / ação — clássicos da geração
  d80f6c03: 7, // Call of Duty 4
  "3271e47f": 8, // Call of Duty Black Ops (+ DLC)
  "76ed2aa2": 9, // Metro 2033 PTBR
  "48742df4": 10, // Medal of Honor 2010 PTBR
  "6f6264fa": 11, // Dead Island
  "9a924ed9": 12, // Titanfall

  // Hack and slash / ação
  df92d381: 13, // Devil May Cry 4
  e9f69fad: 14, // Devil May Cry HD Collection
  "79faa2f3": 15, // DmC Devil May Cry
  c5cf14dd: 16, // Dragon Age 2 PT-BR
  "50404115": 17, // Asura's Wrath PT-BR

  // Dragon Ball — franquia muito buscada
  "586ba480": 18, // Raging Blast 2
  "42d2f8f8": 19, // Ultimate Tenkaichi
  "4ef233c7": 20, // HD Collection
  ef873916: 21, // Raging Blast
  "9c6113be": 22, // Burst Limit

  // Mundo aberto / sandbox
  d0c95662: 23, // Saints Row The Third
  bbbd64bc: 24, // Mafia II
  c3effe68: 25, // Far Cry 2

  // Coletâneas e clássicos
  "2820c254": 26, // Half-Life 2 Orange Box
  b78e07fc: 27, // Portal Still Alive (Dublado)
  "57a108e4": 28, // Life is Strange Completo
  da29129a: 29, // Star Wars TFU Ultimate Sith
  "06d1e7a2": 30, // Star Wars TFU 2 (+ DLC)

  // Outros populares
  "090d0775": 31, // Transformers Fall of Cybertron
  "8f29db94": 32, // Skate 2
  "5e4ed040": 33, // DiRT 3 Complete Edition
  fd15402e: 34, // Alice Madness Returns PT-BR
  "5185be31": 35, // Hot Wheels (Dublado)
  "6e66d037": 36, // Sonic Unleashed
  "0403964f": 37, // Turok PT-BR
};

export function featuredRank(entryId: string): number | null {
  const prefix = entryId.slice(0, 8).toLowerCase();
  return FEATURED_RANK[prefix] ?? null;
}

export function isFeatured(entryId: string): boolean {
  return featuredRank(entryId) !== null;
}

export const FEATURED_SECTION_LIMIT = 18;
