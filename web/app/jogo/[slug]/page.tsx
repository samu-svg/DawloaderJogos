import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GameCard } from "@/components/game-card";
import { GameCoverFrame } from "@/components/game-cover";
import { GameInstallPanel } from "@/components/game-install-panel";
import { SiteHeader } from "@/components/site-header";
import { StoreFooter } from "@/components/store-footer";
import { isPortfolioAdmin } from "@/lib/admin";
import {
  catalogBadgesForGame,
  catalogDisplayTitle,
  resolveCoverUrl,
} from "@/lib/catalog-badges";
import { toCatalogGameItem } from "@/lib/catalog-items";
import {
  audioLabel,
  gamePageMeta,
  hasPackageDetails,
  installFolderKind,
  localCoverUrl,
} from "@/lib/game-pages";
import { findAcervoGame, relatedAcervoGames } from "@/lib/games";
import { formatBytes } from "@/lib/manifest";
import { getSiteUrl } from "@/lib/site-url";
import { currentAppUser } from "@/lib/auth";
import { userHasCatalogAccess } from "@/lib/subscription";

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

  const meta = gamePageMeta(game.id);
  const title = meta?.displayTitle ?? formatTitle(game.label);
  return {
    title: `${title} — download para ${game.platform} | MontaHD`,
    description:
      meta?.description ??
      `Baixe ${title} para ${game.platform} com o app MontaHD: download automático, extração e instalação na pasta certa do HD.`,
  };
}

export default async function GamePage({ params }: PageProps) {
  const { slug } = await params;
  const game = await findAcervoGame(slug);
  if (!game) notFound();

  const [appUser, siteUrl, related] = await Promise.all([
    currentAppUser(),
    getSiteUrl(),
    relatedAcervoGames(game),
  ]);

  const isAdmin = isPortfolioAdmin(appUser?.email);
  const hasAccess = appUser ? await userHasCatalogAccess(appUser) : false;
  const access = !appUser ? "anon" : hasAccess ? "liberado" : "sem-assinatura";
  const meta = gamePageMeta(game.id);
  const title = catalogDisplayTitle(game.id, game.label, game.extraCount);
  const coverUrl = resolveCoverUrl(game.id, game.coverUrl, localCoverUrl);
  const folder = installFolderKind(game.destination, meta?.installHint);
  const dlcNotes = meta?.dlcNotes ?? [];
  const technicalNotes = meta?.technicalNotes ?? [];
  const showPackageDetails = hasPackageDetails(
    meta,
    game.extras,
    game.destination,
    game.totalBytes,
    game.sizeBytes,
  );

  return (
    <>
      <SiteHeader
        email={appUser?.email}
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
          <Link
            href={`/?colecao=${game.collectionSlug}`}
            className="hover:text-zinc-300"
          >
            {game.platform}
          </Link>
          <span>/</span>
          <span className="truncate text-zinc-300">{title}</span>
        </nav>

        <div className="mt-6 grid justify-items-center gap-8 lg:grid-cols-[260px_1fr] lg:items-start">
          <div className="w-full max-w-[260px]">
            <div className="overflow-hidden rounded-2xl border border-border bg-surface">
              <div className="relative aspect-[3/4] w-full">
                <GameCoverFrame
                  title={title}
                  coverUrl={coverUrl}
                  badges={catalogBadgesForGame(game.id, game.extraCount).filter(
                    (badge) => badge.kind === "audio",
                  )}
                  showTitle={!coverUrl}
                />
              </div>
            </div>
          </div>

          <div className="space-y-7 text-center lg:text-left">
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
                {" · "}
                <Link
                  href={`/baixar?catalog=${game.collectionSlug}`}
                  className="text-accent hover:text-accent-hover"
                >
                  Instalar vários de uma vez
                </Link>
              </p>
            </div>

            {meta?.description && (
              <section className="rounded-2xl border border-border bg-surface p-5 text-left">
                <h2 className="text-base font-semibold text-white">
                  Sobre o jogo
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  {meta.description}
                </p>
              </section>
            )}

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
                  Áudio
                </dt>
                <dd className="mt-1 font-semibold text-white">
                  {meta ? audioLabel(meta.audio) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-zinc-500">
                  DLC / extras
                </dt>
                <dd className="mt-1 font-semibold text-white">
                  {game.extraCount > 0 ? game.extraCount : "Nenhum no catálogo"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-zinc-500">
                  Pasta no HD
                </dt>
                <dd className="mt-1 font-semibold text-white">{folder.label}</dd>
              </div>
            </dl>

            {showPackageDetails && (
              <section className="rounded-2xl border border-border bg-surface p-5 text-left">
                <h2 className="text-base font-semibold text-white">
                  Detalhes do pacote
                </h2>
                <ul className="mt-3 space-y-3 text-sm leading-6 text-zinc-400">
                  <li>
                    <span className="font-medium text-zinc-200">
                      Instalação
                    </span>
                    <span className="mt-0.5 block">{folder.detail}</span>
                    {game.destination && (
                      <span className="mt-0.5 block truncate font-mono text-xs text-zinc-500">
                        {game.destination}
                      </span>
                    )}
                  </li>
                  {meta?.audioNote && (
                    <li>
                      <span className="font-medium text-zinc-200">Áudio</span>
                      <span className="mt-0.5 block">{meta.audioNote}</span>
                    </li>
                  )}
                  {game.totalBytes > game.sizeBytes && (
                    <li>
                      <span className="font-medium text-zinc-200">
                        Tamanho com extras
                      </span>
                      <span className="mt-0.5 block">
                        {formatBytes(game.totalBytes)} (jogo principal:{" "}
                        {formatBytes(game.sizeBytes)}).
                      </span>
                    </li>
                  )}
                  {game.extras.map((extra) => (
                    <li key={extra.id}>
                      <span className="font-medium text-zinc-200">
                        {extra.label}
                      </span>
                      {extra.sizeBytes > 0
                        ? ` · ${formatBytes(extra.sizeBytes)}`
                        : ""}
                      <span className="mt-0.5 block font-mono text-xs text-zinc-500">
                        {extra.destination}
                      </span>
                    </li>
                  ))}
                  {dlcNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                  {technicalNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </section>
            )}

            <GameInstallPanel
              siteUrl={siteUrl}
              collectionSlug={game.collectionSlug}
              entryIds={game.entryIds}
              gameTitle={title}
              access={access}
            />

            <section className="rounded-2xl border border-border bg-surface p-5 text-left">
              <h2 className="text-base font-semibold text-white">
                Como instalar
              </h2>
              <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-6 text-zinc-400">
                <li>Instale o app MontaHD no Windows (versão portable).</li>
                <li>
                  Assine o software para liberar downloads — você não paga pelos
                  arquivos individualmente.
                </li>
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
              Outros jogos populares
            </h2>
            <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {related.map((item) => {
                const card = toCatalogGameItem(item);
                return (
                <li key={item.id}>
                  <GameCard
                    title={card.displayTitle}
                    slug={card.slug}
                    coverUrl={card.coverUrl}
                    sizeBytes={card.sizeBytes}
                    platform={card.platform}
                    extraCount={card.extraCount}
                    badges={card.badges}
                  />
                </li>
                );
              })}
            </ul>
          </section>
        )}

        <StoreFooter />
        </div>
      </main>
    </>
  );
}
