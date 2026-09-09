import { PAID_PLAN_FEATURES, PAID_PLAN_NAME, PLAN_SOFTWARE_LINE } from "@/lib/plan-copy";

export function AppValueProps() {
  return (
    <section>
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          O que o {PAID_PLAN_NAME} libera
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          {PLAN_SOFTWARE_LINE} Os arquivos do acervo entram junto enquanto o
          acesso estiver ativo.
        </p>
      </div>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {PAID_PLAN_FEATURES.map((text) => (
          <li
            key={text}
            className="flex gap-3 rounded-2xl border border-border/70 bg-surface/60 px-4 py-3.5"
          >
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[11px] font-bold text-accent-hover">
              ✓
            </span>
            <p className="text-sm font-medium text-white">{text}</p>
          </li>
        ))}
        <li className="flex gap-3 rounded-2xl border border-border/70 bg-surface/60 px-4 py-3.5">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[11px] font-bold text-accent-hover">
            ✓
          </span>
          <p className="text-sm font-medium text-white">
            Licença do app no Windows, com atualizações no período
          </p>
        </li>
      </ul>
    </section>
  );
}
