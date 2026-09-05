import Link from "next/link";
import { formatBytesDetailed } from "@/lib/manifest";

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
  const primaryLabel = hasAccess ? "Montar meu HD" : "Ver os planos";

  return (
    <header className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-2">
        App para Windows
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-5xl">
        Ele monta o seu <span className="text-gradient">HD</span>
      </h1>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-400 sm:text-base">
        Você paga pelo <strong className="text-zinc-200">software MontaHD</strong>,
        não pelos arquivos. O app baixa, verifica, descompacta e coloca cada
        jogo na pasta certa — sem anúncios. Planos de 1, 2 ou 3 meses, no cartão
        ou no PIX.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href={primaryHref}
          className="rounded-2xl bg-accent px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition hover:bg-accent-hover"
        >
          {primaryLabel}
        </Link>
        <Link
          href="/"
          className="rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium text-zinc-200 transition hover:border-white/30 hover:text-white"
        >
          Ver o acervo
        </Link>
      </div>
      {!hasAccess && (
        <p className="mt-4 text-sm text-zinc-500">{planLabel}</p>
      )}

      <dl className="mt-10 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border/70 bg-surface/60 px-3 py-4">
          <dt className="text-[11px] uppercase tracking-wider text-zinc-500">
            Jogos
          </dt>
          <dd className="mt-1 text-xl font-bold text-white sm:text-2xl">
            {gameCount}
          </dd>
        </div>
        <div className="rounded-2xl border border-border/70 bg-surface/60 px-3 py-4">
          <dt className="text-[11px] uppercase tracking-wider text-zinc-500">
            Coleções
          </dt>
          <dd className="mt-1 text-xl font-bold text-white sm:text-2xl">
            {collectionCount}
          </dd>
        </div>
        <div className="rounded-2xl border border-border/70 bg-surface/60 px-3 py-4">
          <dt className="text-[11px] uppercase tracking-wider text-zinc-500">
            Acervo
          </dt>
          <dd className="mt-1 text-xl font-bold text-white sm:text-2xl">
            {totalBytes > 0 ? formatBytesDetailed(totalBytes) : "—"}
          </dd>
        </div>
      </dl>
    </header>
  );
}
