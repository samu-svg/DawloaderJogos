import Link from "next/link";
import { createClient, currentUser } from "@/lib/supabase/server";

export default async function PainelPage() {
  const user = await currentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: portfolios } = await supabase
    .from("portfolios")
    .select("id, slug, title, description, is_public, updated_at")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Meus portfólios</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Cada portfólio define quais arquivos baixar e em qual pasta do HD
            colocar.
          </p>
        </div>
        <Link
          href="/painel/novo"
          className="inline-flex items-center justify-center rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          Novo portfólio
        </Link>
      </div>

      {!portfolios?.length ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
          <p className="text-zinc-600 dark:text-zinc-400">
            Você ainda não criou nenhum portfólio.
          </p>
          <Link
            href="/painel/novo"
            className="mt-4 inline-block text-sm font-medium underline"
          >
            Criar o primeiro
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {portfolios.map((portfolio) => (
            <li key={portfolio.id}>
              <Link
                href={`/painel/${portfolio.slug}`}
                className="block rounded-2xl border border-zinc-200 bg-white p-5 transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold">{portfolio.title}</h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      portfolio.is_public
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
                    }`}
                  >
                    {portfolio.is_public ? "Público" : "Privado"}
                  </span>
                </div>
                {portfolio.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {portfolio.description}
                  </p>
                )}
                <p className="mt-4 font-mono text-xs text-zinc-500">
                  /api/portfolios/{portfolio.slug}/manifest
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
