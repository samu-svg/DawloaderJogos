import type { Metadata } from "next";
import Link from "next/link";
import { listPublicPortfolios } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Baixar — Dawloader",
  description:
    "Catálogo público de portfólios. Escolha um pacote e baixe com o app de desktop.",
};

export default async function BaixarPage() {
  const portfolios = await listPublicPortfolios();

  return (
    <div className="space-y-8">
      <div className="max-w-2xl space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Baixar jogos</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Escolha um portfólio abaixo. O aplicativo de desktop baixa os arquivos
          e organiza cada um na pasta certa do HD que você escolher.
        </p>
      </div>

      {!portfolios.length ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
          <p className="text-zinc-600 dark:text-zinc-400">
            Nenhum portfólio público disponível no momento.
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            Quem publica um portfólio precisa marcar a opção &quot;Portfólio
            público&quot; no painel.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {portfolios.map((portfolio) => (
            <li key={portfolio.id}>
              <Link
                href={`/baixar/${portfolio.slug}`}
                className="block h-full rounded-2xl border border-zinc-200 bg-white p-5 transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
              >
                <h2 className="font-semibold">{portfolio.title}</h2>
                {portfolio.description && (
                  <p className="mt-2 line-clamp-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {portfolio.description}
                  </p>
                )}
                <p className="mt-4 text-xs text-zinc-500">
                  {portfolio.entryCount} arquivo(s) · atualizado{" "}
                  {new Date(portfolio.updatedAt).toLocaleDateString("pt-BR")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="font-semibold">Como funciona</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          <li>Abra a página de um portfólio e anote o slug.</li>
          <li>
            No app Dawloader, informe a URL deste site e o slug do portfólio.
          </li>
          <li>
            Escolha a pasta raiz do HD e confirme — cada arquivo vai para a
            pasta sugerida (Games, Content, etc.).
          </li>
        </ol>
      </section>
    </div>
  );
}
