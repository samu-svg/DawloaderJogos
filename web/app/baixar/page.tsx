import type { Metadata } from "next";
import { AbadAvatarBanner } from "@/components/abadavatar-banner";
import { CatalogBrowser } from "@/components/catalog-browser";
import { DesktopDownloadCard } from "@/components/desktop-download-card";
import { toCatalogGameItems } from "@/lib/catalog-items";
import { currentAppUser } from "@/lib/auth";
import { loadAcervo } from "@/lib/games";
import { getSiteUrl } from "@/lib/site-url";
import { userHasCatalogAccess } from "@/lib/subscription";

export const metadata: Metadata = {
  title: "Meu acervo — MontaHD",
  description: "Escolha os jogos do acervo e deixe o app montar o seu HD.",
};

type PageProps = {
  searchParams: Promise<{ catalog?: string; semanal?: string }>;
};

export default async function BaixarPage({ searchParams }: PageProps) {
  const [{ catalog, semanal }, appUser, { games, collections }, siteUrl] =
    await Promise.all([
      searchParams,
      currentAppUser(),
      loadAcervo(),
      getSiteUrl(),
    ]);

  const hasAccess = appUser ? await userHasCatalogAccess(appUser) : false;

  const activeSlug =
    collections.find((item) => item.slug === catalog)?.slug ??
    collections[0]?.slug ??
    "";

  return (
    <div className="space-y-8">
      <AbadAvatarBanner
        siteUrl={siteUrl}
        loggedIn={Boolean(appUser)}
        hasAccess={hasAccess}
      />
      <DesktopDownloadCard />
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
