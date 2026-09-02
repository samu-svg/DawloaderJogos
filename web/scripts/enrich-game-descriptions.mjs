/**
 * Enriquece description (resumo curto) e longDescription (sinopse completa)
 * em xbox360-game-pages.json. Só altera esses dois campos.
 *
 *   node scripts/enrich-game-descriptions.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const pagesPath = path.join(import.meta.dirname, "../content/xbox360-game-pages.json");
const pages = JSON.parse(readFileSync(pagesPath, "utf8"));

/** @type {Record<string, { description?: string; longDescription: string }>} */
const OVERRIDES = JSON.parse(
  readFileSync(path.join(import.meta.dirname, "game-description-overrides.json"), "utf8"),
);

function sentences(text) {
  return (text.match(/[^.!?]+[.!?]+/g) ?? [text]).map((s) => s.trim()).filter(Boolean);
}

function toShortDescription(text, max = 200) {
  const parts = sentences(text);
  let out = parts[0] ?? text;
  if (out.length < 90 && parts[1]) out = `${out} ${parts[1]}`;
  if (out.length > max) {
    const cut = out.slice(0, max - 1);
    const lastSpace = cut.lastIndexOf(" ");
    out = `${cut.slice(0, lastSpace > 60 ? lastSpace : max - 1)}…`;
  }
  return out;
}

function genreExtras(title) {
  const t = title.toLowerCase();
  if (/fifa|pes|pro evolution|futebol|copa do mundo|ea fc|fifa street/i.test(t)) {
    return "Partidas licenciadas, modos de carreira e competições online ou locais recriam a emoção dos gramados com elencos, estádios e regras da época em que o jogo foi lançado.";
  }
  if (/call of duty|battlefield|medal of honor|metro|titanfall|wolfenstein|f\.e\.a\.r/i.test(t)) {
    return "Campanha cinematográfica, armas da era e multijogador competitivo definem a experiência, com mapas memoráveis e progressão que mantiveram milhões de jogadores online durante anos.";
  }
  if (/gears of war/i.test(t)) {
    return "O combate por cobertura, armas icônicas como a Lancer e chefes colossais Locust criam confrontos intensos, reforçados por cooperação em campanha e modos Horde e Versus.";
  }
  if (/resident evil|dead space|alan wake|f\.e\.a\.r/i.test(t)) {
    return "Atmosfera opressiva, recursos escassos e inimigos aterrorizantes exigem cautela e munição bem administrada, com momentos de tensão que marcaram o survival horror da geração.";
  }
  if (/assassin|batman|hitman|splinter cell|ghost recon/i.test(t)) {
    return "Infiltração, gadgets e combate furtivo permitem abordagens variadas: eliminar alvos em silêncio, enfrentar guardas de frente ou explorar cenários históricos e urbanos detalhados.";
  }
  if (/dragon ball|naruto/i.test(t)) {
    return "Lutadores e transformações do anime ganham vida em arenas destrutíveis, com especiais cinematográficos, modos história e duelos locais ou online para fãs da franquia.";
  }
  if (/lego/i.test(t)) {
    return "Quebra-cabeças, coleta de tijolos e humor familiar da Traveller's Tales tornam a aventura acessível em cooperação local, recriando cenas e personagens icônicos em blocos LEGO.";
  }
  if (/need for speed|forza|dirt|ridge racer|hot wheels|cars 3|baja/i.test(t)) {
    return "Corridas em pistas licenciadas ou urbanas, customização de veículos e perseguições policiais oferecem adrenalina tanto no modo carreira quanto em multijogador.";
  }
  if (/devil may cry|bayonetta|metal gear rising|dante's inferno|asura/i.test(t)) {
    return "Combos estilosos, chefes épicos e sequências cinematográficas premiam domínio do sistema de combate, com ranks de estilo e habilidades que incentivam rejogabilidade.";
  }
  if (/guitar hero/i.test(t)) {
    return "Sincronize botões coloridos com riffs e solos lendários em setlists de rock clássico, com dificuldade progressiva e multijogador local para bandas de sala.";
  }
  if (/minecraft/i.test(t)) {
    return "Construa, explore e sobreviva em mundos gerados proceduralmente, sozinho ou em split-screen, com atualizações que expandiram o conteúdo ao longo dos anos no Xbox 360.";
  }
  if (/gta|saints row|sleeping dogs|mafia|saboteur|red dead|bully|godfather/i.test(t)) {
    return "Mundo aberto vivo, missões principais e secundárias, veículos e liberdade para causar caos ou seguir a narrativa em um sandbox que define a diversão da geração.";
  }
  if (/portal|half-life|orange box/i.test(t)) {
    return "Física inteligente e design de níveis premiado desafiam o raciocínio espacial, com humor seco e reviravoltas narrativas que elevaram os puzzles em primeira pessoa.";
  }
  if (/tekken|street fighter|mortal kombat|king of fighters|soul calibur|ultimate marvel|fight night|ufc|rumble roses/i.test(t)) {
    return "Elenco extenso, profundidade competitiva e modos arcade, história e online fazem das lutas uma referência para sessões rápidas ou torneios entre amigos.";
  }
  if (/transformers|marvel|spider-man|captain america|superman|hulk|star wars|warhammer|ben 10|avatar:/i.test(t)) {
    return "Poderes de super-herói, combate espetacular e cenários ligados ao universo licenciado trazem fan service e ação acessível para fãs das franquias.";
  }
  if (/telltale|walking dead|back to the future|life is strange/i.test(t)) {
    return "Escolhas com consequências moldam a história episódica, com diálogos marcantes e drama emocional que colocam as decisões do jogador no centro da narrativa.";
  }
  if (/dlc|god dublado|tradução|disco 2|pack|compilação|jogos final/i.test(t)) {
    return "Este pacote complementa ou instala conteúdo adicional no HD; consulte os detalhes do pacote na página para ordem de instalação e pasta de destino (Games ou Content).";
  }
  return "Campanha, desafios extras e recursos sociais do Xbox 360 — como conquistas e multijogador quando disponível — prolongam a experiência além da história principal.";
}

function buildLongDescription(title, existing, overrideLong) {
  if (overrideLong) return overrideLong;

  const parts = sentences(existing);
  const intro =
    parts.length >= 2 ? `${parts[0]} ${parts[1]}` : existing;
  const mid = genreExtras(title);
  const closing = `${title} no Xbox 360 permanece uma referência da biblioteca da plataforma, ideal para quem monta um HD de jogos clássicos com o MontaHD.`;

  return [intro, mid, closing].join("\n\n");
}

let updated = 0;
for (const [id, meta] of Object.entries(pages)) {
  const title = meta.displayTitle ?? "Jogo";
  const existing = meta.description ?? "";
  const override = OVERRIDES[id];

  const longDescription =
    override?.longDescription ?? buildLongDescription(title, existing, null);
  const description =
    override?.description ?? toShortDescription(existing || longDescription);

  if (meta.description !== description || meta.longDescription !== longDescription) {
    meta.description = description;
    meta.longDescription = longDescription;
    updated++;
  }
}

writeFileSync(pagesPath, `${JSON.stringify(pages, null, 2)}\n`);
console.log(`Updated ${updated} of ${Object.keys(pages).length} game descriptions.`);
