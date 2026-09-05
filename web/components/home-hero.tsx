import Link from "next/link";
import { DesktopDownloadCard } from "@/components/desktop-download-card";
import { formatBytes } from "@/lib/manifest";

type HomeHeroProps = {
  hasAccess: boolean;
  gameCount: number;
  totalBytes: number;
};

export function HomeHero({
  hasAccess,
  gameCount,
  totalBytes,
}: HomeHeroProps) {
  return (
    <section className="relative">
      <div
        className="pointer-events-none absolute inset-x-[-3rem] -top-20 h-72 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.2),transparent_62%)]"
        aria-hidden
      />

      <div className="relative space-y-8 text-center">
        <header>
          <p className="page-eyebrow">Xbox 360</p>
          <h1 className="page-title">
            Downloads de <span className="text-gradient">jogos</span>
          </h1>
          <p className="page-lead">
            Abra a página do jogo e instale no HD pelo MontaHD. Você paga pelo
            software — os arquivos não são vendidos separadamente.
          </p>
        </header>

        <dl className="mx-auto flex max-w-xl flex-wrap items-center justify-center gap-2">
          <div className="rounded-full border border-border bg-surface/80 px-3.5 py-1.5">
            <dt className="sr-only">Jogos no acervo</dt>
            <dd className="text-xs font-medium text-zinc-300">
              <span className="font-semibold text-white">{gameCount}</span>{" "}
              jogos
            </dd>
          </div>
          {totalBytes > 0 && (
            <div className="rounded-full border border-border bg-surface/80 px-3.5 py-1.5">
              <dt className="sr-only">Tamanho total</dt>
              <dd className="text-xs font-medium text-zinc-300">
                <span className="font-semibold text-white">
                  {formatBytes(totalBytes)}
                </span>{" "}
                no acervo
              </dd>
            </div>
          )}
          <div className="rounded-full border border-border bg-surface/80 px-3.5 py-1.5">
            <dt className="sr-only">Anúncios</dt>
            <dd className="text-xs font-medium text-zinc-300">Sem anúncios</dd>
          </div>
        </dl>

        <div className="overflow-hidden rounded-2xl border border-border/80 bg-surface/60 px-5 py-4 text-left sm:px-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <div className="max-w-lg text-center sm:text-left">
              <p className="text-sm font-semibold text-white">
                Os downloads acontecem no{" "}
                <span className="text-gradient">MontaHD</span>
              </p>
              <p className="mt-1 text-sm leading-6 text-zinc-400">
                O app baixa, verifica, descompacta e coloca cada jogo na pasta
                certa do HD.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-center gap-2">
              <Link
                href="/app"
                className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition hover:bg-accent-hover"
              >
                Conhecer o app
              </Link>
              {hasAccess ? (
                <Link
                  href="/baixar"
                  className="rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-white/30 hover:text-white"
                >
                  Montar meu HD
                </Link>
              ) : (
                <Link
                  href="#jogos"
                  className="rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-white/30 hover:text-white"
                >
                  Ver o acervo
                </Link>
              )}
            </div>
          </div>
        </div>

        <DesktopDownloadCard />
      </div>
    </section>
  );
}
