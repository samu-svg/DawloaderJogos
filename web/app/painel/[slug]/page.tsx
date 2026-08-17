import Link from "next/link";
import { notFound } from "next/navigation";
import { PortfolioEditor } from "@/components/portfolio-editor";
import { createClient, currentUser } from "@/lib/supabase/server";

export default async function PortfolioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [user, supabase] = await Promise.all([currentUser(), createClient()]);

  if (!user) notFound();

  const { data: portfolio } = await supabase
    .from("portfolios")
    .select("*")
    .eq("slug", slug)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!portfolio) notFound();

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
      <PortfolioEditor portfolio={portfolio} entries={entries ?? []} />
    </div>
  );
}
