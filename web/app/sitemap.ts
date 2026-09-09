import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";
import { loadAcervo } from "@/lib/games";

/** Atualiza o sitemap a cada hora com novos jogos do acervo. */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { games } = await loadAcervo();
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: absoluteUrl("/app"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/cadastro"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  const gamePages: MetadataRoute.Sitemap = games.map((game) => ({
    url: absoluteUrl(`/jogo/${game.slug}`),
    lastModified: game.updatedAt ? new Date(game.updatedAt) : now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...gamePages];
}
