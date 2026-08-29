import Link from "next/link";
import { redirect } from "next/navigation";
import { PortfolioEditor } from "@/components/portfolio-editor";
import { requireRole } from "@/lib/auth";
import { isR2Configured } from "@/lib/r2-configured";
import { canDeletePortfolio } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";

export default async function PortfolioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireRole("admin", "editor");
  const supabase = await createClient();

  const { data: portfolio } = await supabase
    .from("portfolios")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!portfolio) {
    redirect("/painel");
  }

  const { data: entries } = await supabase
    .from("entries")
    .select("*")
    .eq("portfolio_id", portfolio.id)
    .order("sort_order", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/painel"
          className="text-sm text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Meus portfólios
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          {portfolio.title}
        </h1>
        <p className="mt-2 font-mono text-sm text-zinc-500">
          slug: {portfolio.slug}
        </p>
      </div>
      <PortfolioEditor
        portfolio={portfolio}
        entries={entries ?? []}
        r2Enabled={isR2Configured()}
        canDelete={canDeletePortfolio(user.role)}
      />
    </div>
  );
}
