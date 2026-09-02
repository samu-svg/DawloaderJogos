import type { Metadata } from "next";
import { AbadAvatarBanner } from "@/components/abadavatar-banner";
import { GameCatalog } from "@/components/game-catalog";
import { MontaHDStrip } from "@/components/montahd-strip";
import { SiteHeader } from "@/components/site-header";
import { StoreFooter } from "@/components/store-footer";
import { canAccessPainel } from "@/lib/rbac";
import { toCatalogGameItems } from "@/lib/catalog-items";
import { loadAcervo } from "@/lib/games";
import { currentAppUser } from "@/lib/auth";
import { getSiteUrl } from "@/lib/site-url";
import { userHasCatalogAccess } from "@/lib/subscription";

export const metadata: Metadata = {
  title: "MontaHD — Downloads de jogos de Xbox 360",
  description:
    "Acervo de jogos de Xbox 360 para instalar no HD. Você paga pelo software MontaHD, não pelos arquivos — o app baixa, descompacta e organiza cada jogo na pasta certa.",
};

type PageProps = {
  searchParams: Promise<{ colecao?: string; semanal?: string }>;
};

export default async function HomePage({ searchParams }: PageProps) {
  const [{ colecao, semanal }, appUser, { games, collections }, siteUrl] =
    await Promise.all([
      searchParams,
      currentAppUser(),
      loadAcervo(),
      getSiteUrl(),
    ]);

  const isAdmin = appUser ? canAccessPainel(appUser.role) : false;
  const hasAccess = appUser ? await userHasCatalogAccess(appUser) : false;

  const items = toCatalogGameItems(games);

  return (
    <>
      <SiteHeader
        email={appUser?.email}
        showPainelLink={isAdmin}
        hasAccess={hasAccess}
      />
      <main className="content-narrow flex-1 px-6 py-8">
        <div className="page-stack">
        <header className="page-header">
          <p className="page-eyebrow">Xbox 360</p>
          <h1 className="page-title">Downloads de jogos</h1>
          <p className="page-lead">
            Navegue pelo acervo, abra a página do jogo e instale no HD pelo app
            MontaHD. Você paga pelo software — os arquivos não são vendidos
            separadamente.
          </p>
        </header>

        <MontaHDStrip hasAccess={hasAccess} />

        <AbadAvatarBanner
          siteUrl={siteUrl}
          loggedIn={Boolean(appUser)}
          hasAccess={hasAccess}
        />

        <div className="mt-10">
          <GameCatalog
            games={items}
            collections={collections}
            initialCollection={
              collections.some((item) => item.slug === colecao)
                ? (colecao ?? null)
                : null
            }
            initialWeekly={semanal === "1"}
          />
        </div>

        <StoreFooter />
        </div>
      </main>
    </>
  );
}
