import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { DesktopDownloadCard } from "@/components/desktop-download-card";
import { GameCoverFrame } from "@/components/game-cover";
import { getPublicPortfolio, groupLabel } from "@/lib/catalog";
import { getDesktopDownloadInfo } from "@/lib/desktop-download";
import { formatBytes } from "@/lib/manifest";
import { getSiteUrl } from "@/lib/site-url";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const portfolio = await getPublicPortfolio(slug);
  if (!portfolio) return { title: "Não encontrado — Dawloader" };
  return {
    title: `${portfolio.title} — Baixar — Dawloader`,
    description:
      portfolio.description ??
      `Baixe ${portfolio.entryCount} arquivo(s) com o app Dawloader.`,
  };
}

export default async function BaixarPortfolioPage({ params }: PageProps) {
  const { slug } = await params;
  const [portfolio, siteUrl] = await Promise.all([
    getPublicPortfolio(slug),
    getSiteUrl(),
  ]);

  if (!portfolio) notFound();

  const desktopDownload = getDesktopDownloadInfo();
  const totalBytes = portfolio.entries.reduce(
    (sum, entry) => sum + entry.sizeBytes,
    0,
  );

  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/baixar"
          className="text-sm text-zinc-600 underline dark:text-zinc-400"
        >
          ← Voltar ao catálogo
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          {portfolio.title}
        </h1>
        {portfolio.description && (
          <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
            {portfolio.description}
          </p>
        )}
        <p className="mt-3 text-sm text-zinc-500">
          {portfolio.entries.length} jogo(s)
          {totalBytes > 0 ? ` · ${formatBytes(totalBytes)}` : ""}
        </p>
      </div>

      <DesktopDownloadCard
        title="1. Baixe o aplicativo"
        description="Instale o Dawloader no Windows antes de baixar este pacote."
        showSteps={false}
      />

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-semibold">2. Jogos neste pacote</h2>
        {portfolio.entries.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            Este portfólio ainda não tem jogos cadastrados.
          </p>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {portfolio.entries.map((entry) => (
              <li
                key={entry.id}
                className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40"
              >
                <div className="aspect-[3/4] w-full">
                  <GameCoverFrame title={entry.label} coverUrl={entry.coverUrl} />
                </div>
                <div className="space-y-2 p-4">
                  <div>
                    <h3 className="font-semibold leading-snug">{entry.label}</h3>
                    {entry.optional && (
                      <span className="text-xs text-zinc-500">Opcional</span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {groupLabel(entry.group) ?? "—"}
                    {entry.sizeBytes > 0 ? ` · ${formatBytes(entry.sizeBytes)}` : ""}
                  </p>
                  <p className="font-mono text-xs text-zinc-500">{entry.destination}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/30">
        <h2 className="text-lg font-semibold">3. Usar no app</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          Com o{" "}
          <a href={desktopDownload.href} download={desktopDownload.fileName} className="underline">
            Dawloader
          </a>{" "}
          aberto, cole os dados abaixo e o app baixa e organiza os jogos no HD.
          Arquivos .zip são descompactados automaticamente na pasta certa.
        </p>

        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          <li>Cole a URL do site e o slug abaixo.</li>
          <li>Clique em <strong>Carregar manifesto</strong>.</li>
          <li>Escolha a pasta de destino no HD.</li>
          <li>Marque os jogos e clique em <strong>Iniciar download</strong>.</li>
        </ol>

        <div className="mt-6 space-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              URL do site
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <code className="rounded-lg bg-white/80 px-3 py-2 font-mono text-sm dark:bg-zinc-950/80">
                {siteUrl}
              </code>
              <CopyButton value={siteUrl} />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Slug do portfólio
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <code className="rounded-lg bg-white/80 px-3 py-2 font-mono text-sm dark:bg-zinc-950/80">
                {portfolio.slug}
              </code>
              <CopyButton value={portfolio.slug} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
