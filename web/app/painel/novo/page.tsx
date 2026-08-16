import Link from "next/link";
import { NovoPortfolioForm } from "@/components/novo-portfolio-form";

export default function NovoPortfolioPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link
          href="/painel"
          className="text-sm text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Voltar
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Novo portfólio</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Depois de criar, você adiciona os arquivos e define a pasta de destino
          de cada um.
        </p>
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <NovoPortfolioForm />
      </div>
    </div>
  );
}
