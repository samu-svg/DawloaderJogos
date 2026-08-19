import Link from "next/link";

/** Explica em poucas linhas o papel do app, na página onde ficam os jogos. */
export function MontaHDStrip({ hasAccess }: { hasAccess: boolean }) {
  return (
    <section className="hero-glow relative overflow-hidden rounded-2xl border border-border">
      <div className="grid-lines absolute inset-0 opacity-50" aria-hidden />
      <div className="relative flex flex-col gap-5 px-6 py-7 sm:px-9 sm:py-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-200">
            Como o download funciona
            <span className="h-1.5 w-1.5 rounded-full bg-accent-2" />
          </span>
          <h2 className="mt-3 text-xl font-bold tracking-tight text-white sm:text-2xl">
            Os downloads acontecem no{" "}
            <span className="text-gradient">MontaHD</span>, o app que organiza o
            seu HD
          </h2>
          <p className="mt-2.5 text-sm leading-6 text-zinc-300">
            Escolha os jogos aqui e o app baixa, verifica, descompacta e coloca
            cada arquivo na pasta certa do HD — sem anúncios e sem trabalho
            manual. O acesso ao app libera o acervo inteiro.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <Link
            href="/app"
            className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition hover:bg-accent-hover"
          >
            Conhecer o app
          </Link>
          {hasAccess && (
            <Link
              href="/baixar"
              className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium text-zinc-200 transition hover:border-white/30 hover:text-white"
            >
              Meu acervo
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
