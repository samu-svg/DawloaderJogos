import type { Metadata } from "next";
import { CatalogBrowser } from "@/components/catalog-browser";
import { DesktopDownloadCard } from "@/components/desktop-download-card";
import { listPublicCatalogs } from "@/lib/catalog";
import { getSiteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Catálogos — Dawloader",
  description:
    "Veja os jogos disponíveis e baixe com o app Dawloader no Windows.",
};

type PageProps = {
  searchParams: Promise<{ catalog?: string }>;
};

export default async function BaixarPage({ searchParams }: PageProps) {
  const [{ catalog }, catalogs, siteUrl] = await Promise.all([
    searchParams,
    listPublicCatalogs(),
    getSiteUrl(),
  ]);

  const activeSlug =
    catalogs.find((item) => item.slug === catalog)?.slug ?? catalogs[0]?.slug ?? "";

  return (
    <div className="space-y-10">
      <CatalogBrowser
        catalogs={catalogs}
        activeSlug={activeSlug}
        siteUrl={siteUrl}
      />

      <DesktopDownloadCard showSteps={false} />
    </div>
  );
}
