import weeklyData from "@/content/weekly-games.json";

type WeeklyGamesConfig = {
  label: string;
  weekOf: string;
  entryIds: string[];
};

const config = weeklyData as WeeklyGamesConfig;

const WEEKLY_IDS = new Set(config.entryIds);

export function weeklyGamesLabel(): string {
  return config.label || "Lançamentos da semana";
}

export function weeklyGamesWeekOf(): string {
  return config.weekOf;
}

export function isWeeklyGame(entryId: string): boolean {
  return WEEKLY_IDS.has(entryId);
}

export function weeklyGameIds(): string[] {
  return [...config.entryIds];
}
