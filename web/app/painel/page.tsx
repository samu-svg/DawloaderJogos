import Link from "next/link";
import { PortfolioListCard } from "@/components/portfolio-list-card";
import { requireRole } from "@/lib/auth";
import { canCreatePortfolio } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";

export default async function PainelPage() {
  const user = await requireRole("admin", "editor");
  const allowCreate = canCreatePortfolio(user.role);
  const supabase = await createClient();

  const { data: portfolios, error } = await supabase
    .from("portfolios")
    .select("id, slug, title, description, is_public")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

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
        {allowCreate && (
          <Link
            href="/painel/novo"
            className="inline-flex items-center justify-center rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Novo portfólio
          </Link>
        )}
      </div>

      {!portfolios?.length ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
          <p className="text-zinc-600 dark:text-zinc-400">
            {allowCreate
              ? "Você ainda não criou nenhum portfólio."
              : "Nenhum portfólio disponível para esta conta."}
          </p>
          {allowCreate && (
            <Link
              href="/painel/novo"
              className="mt-4 inline-block text-sm font-medium underline"
            >
              Criar o primeiro
            </Link>
          )}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {portfolios.map((portfolio) => (
            <li key={portfolio.id}>
              <PortfolioListCard
                slug={portfolio.slug}
                title={portfolio.title}
                description={portfolio.description}
                isPublic={portfolio.is_public}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
