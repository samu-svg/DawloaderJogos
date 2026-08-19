import Link from "next/link";
import { formatBytes } from "@/lib/manifest";

type AppHeroProps = {
  loggedIn: boolean;
  hasAccess: boolean;
  gameCount: number;
  collectionCount: number;
  totalBytes: number;
  planLabel: string;
};

export function AppHero({
  loggedIn,
  hasAccess,
  gameCount,
  collectionCount,
  totalBytes,
  planLabel,
}: AppHeroProps) {
  const primaryHref = hasAccess
    ? "/baixar"
    : loggedIn
      ? "/assinar"
      : "/cadastro?next=/assinar";
  const primaryLabel = hasAccess
    ? "Abrir meu acervo"
    : loggedIn
      ? "Liberar o app"
      : "Liberar o app";

  return (
    <section className="hero-glow relative overflow-hidden rounded-3xl border border-border">
      <div className="grid-lines absolute inset-0 opacity-60" aria-hidden />
      <div className="relative px-8 py-16 text-center sm:px-14 sm:py-20">
        <span className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent-muted px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
          App para Windows
          <span className="h-1.5 w-1.5 rounded-full bg-accent-2" />
        </span>

        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl">
          <span className="text-gradient">Ele monta o seu HD</span>
          <br />
          enquanto você assiste.
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
          Você assina o <strong className="text-white">MontaHD</strong>, o app
          baixa e organiza cada jogo na pasta certa — sozinho, sem anúncios, sem
          arquivo solto. Com o app liberado, o acervo inteiro fica disponível
          para instalar.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={primaryHref}
            className="rounded-xl bg-accent px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition hover:bg-accent-hover"
          >
            {primaryLabel}
          </Link>
          <Link
            href="/"
            className="rounded-xl border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-medium text-zinc-200 backdrop-blur transition hover:border-white/30 hover:text-white"
          >
            Ver os jogos
          </Link>
          {!hasAccess && (
            <span className="text-sm text-zinc-400">{planLabel}</span>
          )}
        </div>

        <dl className="mx-auto mt-12 grid max-w-2xl grid-cols-3 gap-6 border-t border-white/10 pt-7">
          <div>
            <dt className="text-xs uppercase tracking-wider text-zinc-500">
              Jogos no acervo
            </dt>
            <dd className="mt-1 text-2xl font-bold text-white">{gameCount}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-zinc-500">
              Coleções
            </dt>
            <dd className="mt-1 text-2xl font-bold text-white">
              {collectionCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-zinc-500">
              Tamanho total
            </dt>
            <dd className="mt-1 text-2xl font-bold text-white">
              {totalBytes > 0 ? formatBytes(totalBytes) : "—"}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
