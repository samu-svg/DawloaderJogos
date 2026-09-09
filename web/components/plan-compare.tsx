import Link from "next/link";
import {
  FREE_PLAN_FEATURES,
  FREE_PLAN_NAME,
  PAID_PLAN_FEATURES,
  PAID_PLAN_NAME,
  PLAN_SOFTWARE_LINE,
  freePlanSummary,
  paidPlanSummary,
} from "@/lib/plan-copy";
import { lowestPlanPriceLabel } from "@/lib/stripe-plans";

type PlanCompareProps = {
  hasAccess?: boolean;
  loggedIn?: boolean;
  compact?: boolean;
  showCtas?: boolean;
};

export function PlanCompare({
  hasAccess = false,
  loggedIn = false,
  compact = false,
  showCtas = true,
}: PlanCompareProps) {
  if (hasAccess) return null;

  const paidHref = loggedIn ? "/assinar" : "/cadastro?next=/assinar";
  const freeHref = loggedIn ? "/#jogos" : "/cadastro";
  const priceLabel = lowestPlanPriceLabel();

  return (
    <section id="planos" className="scroll-mt-24">
      {!compact && (
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-2">
            Planos MontaHD
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {FREE_PLAN_NAME} agora. {PAID_PLAN_NAME} quando quiser.
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-400">
            {PLAN_SOFTWARE_LINE} Comece no {FREE_PLAN_NAME} e passe para o{" "}
            {PAID_PLAN_NAME} para montar o HD em lote.
          </p>
        </div>
      )}

      <div
        className={`grid gap-4 ${compact ? "sm:grid-cols-2" : "mt-8 sm:grid-cols-2"}`}
      >
        <article className="flex flex-col rounded-[24px] border border-cyan-400/20 bg-gradient-to-b from-cyan-500/10 via-surface to-surface p-5 text-left sm:p-6">
          <p className="inline-flex w-fit rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200">
            {FREE_PLAN_NAME}
          </p>
          <h3 className="mt-3 text-xl font-bold tracking-tight text-white">
            MontaHD {FREE_PLAN_NAME}
          </h3>
          <p className="mt-1 text-sm leading-6 text-zinc-400">{freePlanSummary()}</p>
          <ul className="mt-4 space-y-2 text-sm text-zinc-300">
            {FREE_PLAN_FEATURES.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-0.5 text-cyan-300" aria-hidden>
                  ✓
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          {showCtas ? (
            <Link
              href={freeHref}
              className="mt-6 rounded-2xl border border-cyan-400/30 px-4 py-2.5 text-center text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/60 hover:bg-cyan-500/10 hover:text-white"
            >
              {loggedIn ? "Escolher um jogo" : "Criar conta grátis"}
            </Link>
          ) : (
            <p className="mt-6 text-xs font-medium text-cyan-200/80">Incluso na conta</p>
          )}
        </article>

        <article className="relative flex flex-col rounded-[24px] border border-accent/50 bg-gradient-to-b from-violet-600/25 via-surface to-surface p-5 text-left shadow-[0_24px_80px_rgba(109,40,217,0.18)] sm:p-6">
          <p className="inline-flex w-fit rounded-full border border-accent/40 bg-accent px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
            {PAID_PLAN_NAME}
          </p>
          <h3 className="mt-3 text-xl font-bold tracking-tight text-white">
            MontaHD {PAID_PLAN_NAME}
          </h3>
          <p className="mt-1 text-sm leading-6 text-zinc-300">{paidPlanSummary()}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {priceLabel} · 1, 2 ou 3 meses · cartão ou PIX
          </p>
          <ul className="mt-4 space-y-2 text-sm text-zinc-200">
            {PAID_PLAN_FEATURES.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-0.5 text-accent-hover" aria-hidden>
                  ✓
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          {showCtas ? (
            <Link
              href={paidHref}
              className="mt-6 rounded-2xl bg-accent px-4 py-2.5 text-center text-sm font-semibold text-white shadow-lg shadow-accent/25 transition hover:bg-accent-hover"
            >
              Assinar {PAID_PLAN_NAME}
            </Link>
          ) : (
            <p className="mt-6 text-xs font-medium text-accent-hover">
              Escolha 1, 2 ou 3 meses abaixo
            </p>
          )}
        </article>
      </div>
    </section>
  );
}
