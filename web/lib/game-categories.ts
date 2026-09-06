import categoryMap from "../content/game-categories.json";
import { gamePageMeta } from "./game-pages.ts";

export const GAME_CATEGORY_LABELS = {
  acao: "Ação",
  aventura: "Aventura",
  esportes: "Esportes",
  corrida: "Corrida",
  fps: "Tiro",
  luta: "Luta",
  rpg: "RPG",
  terror: "Terror",
  "mundo-aberto": "Mundo aberto",
  musica: "Música",
  familia: "Família",
  estrategia: "Estratégia",
  plataforma: "Plataforma",
  colecao: "Coletânea",
  arcade: "Arcade",
  kinect: "Kinect",
} as const;

export type GameCategoryId = keyof typeof GAME_CATEGORY_LABELS;

const EXPLICIT_MAP = categoryMap as Record<string, GameCategoryId[]>;

const CATEGORY_ORDER: GameCategoryId[] = [
  "arcade",
  "kinect",
  "mundo-aberto",
  "acao",
  "fps",
  "esportes",
  "corrida",
  "luta",
  "rpg",
  "terror",
  "aventura",
  "plataforma",
  "musica",
  "familia",
  "estrategia",
  "colecao",
];

type Rule = {
  categories: GameCategoryId[];
  pattern: RegExp;
};

const INFERENCE_RULES: Rule[] = [
  { categories: ["colecao"], pattern: /\b(cole[cç][aã]o|collection|pack|pacote|legends|cl[aá]ssicos|brazukas|natal)\b/i },
  { categories: ["esportes"], pattern: /\b(fifa|pes\b|pro evolution|ea fc|f1\b|nba\b|nfl\b|madden|nhl\b|copa do mundo|football|soccer|ufc\b|wwe\b)/i },
  { categories: ["corrida"], pattern: /\b(forza|need for speed|nfs\b|dirt\b|ride\b|ridge racer|burnout|grid\b|motorstorm|skate\b|mx\b|baja\b)/i },
  { categories: ["luta"], pattern: /\b(dragon ball|tekken|mortal kombat|street fighter|soulcalibur|ufc\b|wwe\b|def jam|naruto\b|burst limit|raging blast|tenkaichi)/i },
  { categories: ["musica"], pattern: /\b(guitar hero|rock band|dance central|just dance|aerosmith|warriors of rock)/i },
  { categories: ["familia"], pattern: /\b(lego\b|disney|pixar|barbie|ben 10|spongebob|hot wheels|cars\b|toy story|kinect|chavo|ducktales|mickey|turtles in time)/i },
  { categories: ["terror"], pattern: /\b(resident evil|dead space|f\.?e\.?a\.?r|silent hill|dead island|alan wake|evil within|amnesia|zombie|undead|bioshock)/i },
  { categories: ["fps"], pattern: /\b(call of duty|cod\b|battlefield|halo\b|metro\b|medal of honor|titanfall|borderlands|duke nukem|crysis|far cry|ghost recon|rainbow six)/i },
  { categories: ["mundo-aberto", "acao"], pattern: /\b(gta\b|grand theft auto|saints row|mafia\b|red dead|watch dogs|sleeping dogs|bully\b|assassin'?s creed|godfather|just cause)/i },
  { categories: ["rpg"], pattern: /\b(dragon age|elder scrolls|skyrim|fallout|mass effect|final fantasy|dark souls|fable\b|borderlands|kingdoms of amalur|witcher)/i },
  { categories: ["estrategia"], pattern: /\b(civilization|command & conquer|starcraft|age of empires|xcom|worms\b)/i },
  { categories: ["plataforma"], pattern: /\b(mario\b|sonic\b|banjo|rayman|castlevania|megaman|mega man|spongebob|ducktales)/i },
  { categories: ["aventura"], pattern: /\b(tomb raider|uncharted|life is strange|telltaile|walking dead|portal\b|back to the future|harry potter|indiana jones|alice madness)/i },
  { categories: ["acao"], pattern: /\b(devil may cry|dmc\b|gears of war|batman|transformers|star wars|asura|bayonetta|prototype|infamous|prototype|max payne|turok\b|titanfall|deadpool|dante'?s inferno)/i },
];

const DEFAULT_CATEGORY: GameCategoryId[] = ["acao"];

function sortCategories(categories: GameCategoryId[]): GameCategoryId[] {
  const unique = [...new Set(categories)];
  return unique.sort(
    (a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b),
  );
}

export function inferGameCategories(
  label: string,
  displayTitle?: string,
  description?: string,
): GameCategoryId[] {
  const haystack = [label, displayTitle, description]
    .filter(Boolean)
    .join(" ");

  for (const rule of INFERENCE_RULES) {
    if (rule.pattern.test(haystack)) {
      return sortCategories(rule.categories);
    }
  }

  return DEFAULT_CATEGORY;
}

export function gameCategoriesForEntry(
  entryId: string,
  label: string,
  displayTitle?: string,
): GameCategoryId[] {
  const explicit = EXPLICIT_MAP[entryId];
  if (explicit?.length) return sortCategories(explicit);

  const meta = gamePageMeta(entryId);
  return inferGameCategories(
    label,
    displayTitle ?? meta?.displayTitle,
    meta?.description,
  );
}

export function categoryLabel(id: GameCategoryId): string {
  return GAME_CATEGORY_LABELS[id];
}

export function allCategoryIds(): GameCategoryId[] {
  return [...CATEGORY_ORDER];
}

export function gameMatchesCategory(
  categories: GameCategoryId[],
  filter: GameCategoryId | null,
): boolean {
  if (!filter) return true;
  return categories.includes(filter);
}
