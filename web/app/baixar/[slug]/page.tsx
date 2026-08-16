import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { DesktopDownloadCard } from "@/components/desktop-download-card";
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
  const hasLocalImport = portfolio.entries.some(
    (entry) => entry.group === "pasta-local",
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
          {portfolio.entries.length} arquivo(s)
          {totalBytes > 0 ? ` · ${formatBytes(totalBytes)}` : ""}
        </p>
      </div>

      <DesktopDownloadCard
        title="1. Baixe o aplicativo"
        description="Instale o Dawloader no Windows antes de baixar este pacote."
        showSteps={false}
      />

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-semibold">2. Arquivos neste pacote</h2>
        {portfolio.entries.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            Este portfólio ainda não tem arquivos cadastrados.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
                  <th className="py-2 pr-4 font-medium">Nome</th>
                  <th className="py-2 pr-4 font-medium">Tipo</th>
                  <th className="py-2 pr-4 font-medium">Pasta no HD</th>
                  <th className="py-2 font-medium">Tamanho</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-zinc-100 dark:border-zinc-900"
                  >
                    <td className="py-3 pr-4">
                      {entry.label}
                      {entry.optional && (
                        <span className="ml-1 text-zinc-500">· opcional</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {groupLabel(entry.group) ?? "—"}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                      {entry.destination}
                    </td>
                    <td className="py-3 text-zinc-600 dark:text-zinc-400">
                      {entry.sizeBytes > 0 ? formatBytes(entry.sizeBytes) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/30">
        <h2 className="text-lg font-semibold">3. Usar no app</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          Com o{" "}
          <a href={desktopDownload.href} download={desktopDownload.fileName} className="underline">
            Dawloader
          </a>{" "}
          aberto, cole os dados abaixo, carregue o manifesto e escolha o HD.
          {hasLocalImport
            ? " Para pastas do TeraBox, baixe o .zip no PC e use Instalar zip no app — ele descompacta e grava na pasta certa."
            : " Depois inicie o download dos arquivos."}
        </p>

        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          <li>Cole a URL do site e o slug abaixo.</li>
          <li>Clique em <strong>Carregar manifesto</strong>.</li>
          <li>Escolha a pasta raiz do HD.</li>
          {hasLocalImport ? (
            <>
              <li>
                Baixe o <strong>.zip</strong> do TeraBox (ou similar) no seu PC.
              </li>
              <li>
                No app, clique em <strong>Instalar zip</strong> na linha do jogo.
              </li>
            </>
          ) : (
            <li>Inicie o download no app.</li>
          )}
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
