import type { Metadata } from "next";
import { CatalogBrowser } from "@/components/catalog-browser";
import { DesktopDownloadCard } from "@/components/desktop-download-card";
import { toCatalogGameItems } from "@/lib/catalog-items";
import { loadAcervo } from "@/lib/games";
import { getSiteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Montar meu HD — MontaHD",
  description: "Selecione os jogos e deixe o MontaHD baixar, verificar e montar no seu HD.",
};

type PageProps = {
  searchParams: Promise<{ catalog?: string; semanal?: string }>;
};

export default async function BaixarPage({ searchParams }: PageProps) {
  const [{ catalog, semanal }, { games, collections }, siteUrl] =
    await Promise.all([searchParams, loadAcervo(), getSiteUrl()]);

  const activeSlug =
    collections.find((item) => item.slug === catalog)?.slug ??
    collections[0]?.slug ??
    "";

  return (
    <div className="space-y-6">
      <DesktopDownloadCard variant="inline" />
      <CatalogBrowser
        games={toCatalogGameItems(games)}
        collections={collections}
        activeSlug={activeSlug}
        siteUrl={siteUrl}
        initialWeekly={semanal === "1"}
      />
    </div>
  );
}
