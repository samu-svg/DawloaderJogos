import { NextResponse } from "next/server";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createPublicReaderClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logger";
import { mergeCatalogTitleIds, xbox360TitleIdMap } from "@/lib/xbox360-title-ids";

export const dynamic = "force-dynamic";

/**
 * Metadados públicos para o MontaHD rotular jogos/DLC no HD.
 * Só label/destino/grupo — sem URLs de download.
 */
export async function GET(request: Request) {
  const limited = await enforceRateLimit(request, "catalog-labels", RATE_LIMITS.medium);
  if (limited) return limited;

  try {
    const supabase = await createPublicReaderClient();
    const { data: portfolios, error: portfolioError } = await supabase
      .from("portfolios")
      .select("id")
      .eq("is_public", true);

    if (portfolioError) throw new Error(portfolioError.message);

    const portfolioIds = (portfolios ?? []).map((row) => row.id);
    if (portfolioIds.length === 0) {
      return NextResponse.json(
        { labels: [], titleIds: xbox360TitleIdMap() },
        { headers: { "cache-control": "public, max-age=60" } },
      );
    }

    const { data: entries, error } = await supabase
      .from("entries")
      .select("id, label, destination, group_name")
      .in("portfolio_id", portfolioIds)
      .order("sort_order", { ascending: true });

    if (error) throw new Error(error.message);

    const labels = (entries ?? [])
      .filter((row) => row.label?.trim() && row.destination?.trim())
      .map((row) => ({
        id: row.id,
        label: row.label.trim(),
        destination: row.destination.trim(),
        group: row.group_name ?? undefined,
      }));

    const titleIds = mergeCatalogTitleIds(xbox360TitleIdMap(), labels);

    return NextResponse.json(
      { labels, titleIds },
      { headers: { "cache-control": "public, max-age=300, stale-while-revalidate=600" } },
    );
  } catch (error) {
    logError("Falha ao listar rótulos do catálogo", error);
    return NextResponse.json(
      { error: "Não foi possível carregar os nomes do catálogo." },
      { status: 500 },
    );
  }
}
