import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GameCard } from "@/components/game-card";
import { GameCoverFrame } from "@/components/game-cover";
import { GameInstallPanel } from "@/components/game-install-panel";
import { SiteHeader } from "@/components/site-header";
import { StoreFooter } from "@/components/store-footer";
import { isPortfolioAdmin } from "@/lib/admin";
import { findAcervoGame, relatedAcervoGames } from "@/lib/games";
import { formatBytes } from "@/lib/manifest";
import { getSiteUrl } from "@/lib/site-url";
import { userHasCatalogAccess } from "@/lib/subscription";
import { currentUser } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ slug: string }>;
};

function formatTitle(label: string): string {
  if (!label) return "Jogo";
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const game = await findAcervoGame(slug);
  if (!game) return { title: "Jogo não encontrado — MontaHD" };

  const title = formatTitle(game.label);
  return {
    title: `${title} — download para ${game.platform} | MontaHD`,
    description: `Baixe ${title} para ${game.platform} com o app MontaHD: download automático, extração e instalação na pasta certa do HD.`,
  };
}

export default async function GamePage({ params }: PageProps) {
  const { slug } = await params;
  const game = await findAcervoGame(slug);
  if (!game) notFound();

  const [user, siteUrl, related] = await Promise.all([
    currentUser(),
    getSiteUrl(),
    relatedAcervoGames(game),
  ]);

  const isAdmin = isPortfolioAdmin(user?.email);
  const hasAccess = user ? await userHasCatalogAccess(user) : false;
  const access = !user ? "anon" : hasAccess ? "liberado" : "sem-assinatura";
  const title = formatTitle(game.label);

  return (
    <>
      <SiteHeader
        email={user?.email}
        showPainelLink={isAdmin}
        hasAccess={hasAccess}
      />
      <main className="content-narrow flex-1 px-6 py-8">
        <div className="page-stack">
        <nav className="flex flex-wrap items-center justify-center gap-2 text-center text-sm text-zinc-500">
          <Link href="/" className="hover:text-zinc-300">
            Jogos
          </Link>
          <span>/</span>
          <span className="text-zinc-400">{game.platform}</span>
          <span>/</span>
          <span className="truncate text-zinc-300">{title}</span>
        </nav>

        <div className="mt-6 grid justify-items-center gap-8 lg:grid-cols-[260px_1fr] lg:items-start">
          <div className="w-full max-w-[260px]">
            <div className="overflow-hidden rounded-2xl border border-border bg-surface">
              <div className="relative aspect-[3/4] w-full">
                <GameCoverFrame title={game.label} coverUrl={game.coverUrl} />
              </div>
            </div>
          </div>

          <div className="space-y-7 text-center">
            <div>
              <span className="rounded-md bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
                {game.platform}
              </span>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {title}
              </h1>
              <p className="mt-2 text-sm text-zinc-400">
                Coleção{" "}
                <Link
                  href={`/?colecao=${game.collectionSlug}`}
                  className="text-accent hover:text-accent-hover"
                >
                  {game.collectionTitle}
                </Link>
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-4 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-4">
              <div>
                <dt className="text-xs uppercase tracking-wider text-zinc-500">
                  Tamanho
                </dt>
                <dd className="mt-1 font-semibold text-white">
                  {game.sizeBytes > 0 ? formatBytes(game.sizeBytes) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-zinc-500">
                  Com extras
                </dt>
                <dd className="mt-1 font-semibold text-white">
                  {game.totalBytes > 0 ? formatBytes(game.totalBytes) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-zinc-500">
                  DLC / extras
                </dt>
                <dd className="mt-1 font-semibold text-white">
                  {game.extraCount > 0 ? game.extraCount : "Nenhum"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-zinc-500">
                  Pasta no HD
                </dt>
                <dd className="mt-1 truncate font-mono text-xs text-zinc-300">
                  {game.destination ?? "definida pelo app"}
                </dd>
              </div>
            </dl>

            <GameInstallPanel
              siteUrl={siteUrl}
              collectionSlug={game.collectionSlug}
              entryIds={game.entryIds}
              gameTitle={title}
              access={access}
            />

            <section className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="text-base font-semibold text-white">
                Como instalar
              </h2>
              <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-6 text-zinc-400">
                <li>Instale o app MontaHD no Windows (versão portable).</li>
                <li>
                  Clique em <strong className="text-zinc-200">Instalar no HD</strong>{" "}
                  nesta página — o app abre já com o jogo marcado.
                </li>
                <li>Escolha a pasta raiz do HD e confirme.</li>
                <li>
                  O app baixa, confere a integridade, descompacta e organiza tudo
                  na pasta correta.
                </li>
              </ol>
            </section>
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-16">
            <h2 className="section-heading text-xl sm:text-2xl">
              Mais jogos de {game.platform}
            </h2>
            <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {related.map((item) => (
                <li key={item.id}>
                  <GameCard
                    title={item.label}
                    slug={item.slug}
                    coverUrl={item.coverUrl}
                    sizeBytes={item.totalBytes}
                    platform={item.platform}
                    extraCount={item.extraCount}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        <StoreFooter />
        </div>
      </main>
    </>
  );
}
