import Link from "next/link";
import { STRIPE_PLANS } from "@/lib/stripe-plans";

function formatBrl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function AppPlanCard({
  hasAccess,
  loggedIn,
  paymentsEnabled,
}: {
  planLabel?: string;
  hasAccess: boolean;
  loggedIn: boolean;
  paymentsEnabled: boolean;
}) {
  const href = hasAccess
    ? "/baixar"
    : loggedIn
      ? "/assinar"
      : "/cadastro?next=/assinar";
  const monthlyBase = STRIPE_PLANS[0].priceCents / 100;

  if (hasAccess) {
    return (
      <section className="mx-auto max-w-xl rounded-[28px] border border-emerald-400/25 bg-gradient-to-br from-emerald-500/12 via-surface to-surface p-8 text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
          Plano ativo
        </p>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-white">
          App e acervo liberados
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Baixe o instalador, selecione os jogos e monte seu HD.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/baixar"
            className="rounded-2xl bg-accent px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition hover:bg-accent-hover"
          >
            Montar meu HD
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-2">
          Planos MontaHD
        </p>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Libere o <span className="text-gradient">MontaHD</span>
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-400">
          Cartão recorrente ou PIX à vista. Cancele o cartão quando quiser; no
          PIX o acesso vale só pelo tempo do plano.
        </p>
        {!paymentsEnabled && (
          <p className="mt-3 text-sm text-amber-300/80">
            Pagamentos em configuração neste ambiente.
          </p>
        )}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {STRIPE_PLANS.map((plan) => {
          const total = plan.priceCents / 100;
          const monthly = total / plan.months;
          const featured = plan.id === "2m";

          return (
            <article
              key={plan.id}
              className={`relative flex flex-col rounded-[28px] border p-6 ${
                featured
                  ? "border-accent/50 bg-gradient-to-b from-violet-600/20 via-surface to-surface shadow-[0_24px_80px_rgba(109,40,217,0.18)]"
                  : "border-border/80 bg-surface/80"
              }`}
            >
              {featured && (
                <p className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-accent/40 bg-accent px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
                  Recomendado
                </p>
              )}
              <p className="text-sm font-semibold text-zinc-300">{plan.title}</p>
              <p className="mt-3 text-4xl font-bold tracking-tight text-white">
                {plan.priceLabel}
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                {plan.months === 1
                  ? "Acesso por 30 dias"
                  : monthly < monthlyBase
                    ? `${formatBrl(monthly)}/mês · ${plan.months} meses`
                    : `${plan.months} meses de acesso`}
              </p>
              <p className="mt-2 text-xs text-zinc-600">
                PIX à vista ou cartão {plan.cardCadence}
              </p>
              <Link
                href={href}
                className={`mt-6 rounded-2xl px-4 py-3 text-center text-sm font-semibold transition ${
                  featured
                    ? "bg-accent text-white shadow-lg shadow-accent/25 hover:bg-accent-hover"
                    : "border border-border text-zinc-200 hover:border-zinc-500 hover:text-white"
                }`}
              >
                Escolher {plan.title}
              </Link>
            </article>
          );
        })}
      </div>

      <div className="mt-6 grid gap-3 text-center text-xs leading-5 text-zinc-500 sm:grid-cols-2">
        <p className="rounded-2xl border border-border/70 bg-background/40 px-4 py-3">
          <strong className="font-medium text-zinc-300">Cartão:</strong> renovação
          automática no fim do período. Cancele quando quiser.
        </p>
        <p className="rounded-2xl border border-border/70 bg-background/40 px-4 py-3">
          <strong className="font-medium text-zinc-300">PIX:</strong> pagamento à
          vista, sem renovação. O acesso vale pelo tempo do plano.
        </p>
      </div>
    </section>
  );
}
