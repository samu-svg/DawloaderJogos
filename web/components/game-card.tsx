import Link from "next/link";
import { GameCoverFrame } from "@/components/game-cover";
import type { CatalogBadge } from "@/lib/catalog-badges";
import { formatBytes } from "@/lib/manifest";

type GameCardProps = {
  title: string;
  slug: string;
  coverUrl?: string | null;
  sizeBytes?: number;
  platform: string;
  extraCount?: number;
  badges?: CatalogBadge[];
  showTitleOnCover?: boolean;
};

function formatTitle(label: string): string {
  if (!label) return "Jogo";
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function badgeClass(tone: CatalogBadge["tone"]): string {
  switch (tone) {
    case "dublado":
      return "bg-emerald-600/90 text-white";
    case "pt-br":
      return "bg-sky-600/90 text-white";
    case "dlc":
      return "bg-accent/85 text-white";
  }
}

export function GameCard({
  title,
  slug,
  coverUrl,
  sizeBytes = 0,
  platform,
  extraCount = 0,
  badges = [],
  showTitleOnCover = false,
}: GameCardProps) {
  const displayTitle = formatTitle(title);
  const audioBadges = badges.filter((badge) => badge.kind === "audio");
  const dlcBadges = badges.filter((badge) => badge.kind === "dlc");
  const hasCover = Boolean(coverUrl);
  const showCoverTitle = showTitleOnCover || !hasCover;

  return (
    <Link
      href={`/jogo/${slug}`}
      className="card-glow group block overflow-hidden rounded-xl border border-border bg-surface"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden">
        <GameCoverFrame
          title={displayTitle}
          coverUrl={coverUrl}
          badges={showCoverTitle ? audioBadges : []}
          showTitle={showCoverTitle}
        />
        <span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300 backdrop-blur">
          {platform}
        </span>
        {audioBadges.length > 0 && hasCover && (
          <div className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] flex-wrap gap-1">
            {audioBadges.map((badge) => (
              <span
                key={badge.label}
                className={`rounded-md px-2 py-0.5 text-[10px] font-semibold backdrop-blur ${badgeClass(badge.tone)}`}
              >
                {badge.label}
              </span>
            ))}
          </div>
        )}
        {(dlcBadges.length > 0 || extraCount > 0) && (
          <span className="absolute right-2 top-2 rounded-md bg-accent/85 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
            {dlcBadges[0]?.label ?? `+${extraCount} DLC`}
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 flex h-10 items-center justify-center bg-accent/90 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100">
          Ver e baixar
        </span>
      </div>
      <div className="space-y-1 p-3 text-center">
        <h3 className="truncate text-sm font-semibold text-white" title={displayTitle}>
          {displayTitle}
        </h3>
        <p className="text-xs text-zinc-500">
          {sizeBytes > 0 ? formatBytes(sizeBytes) : "Tamanho sob consulta"}
        </p>
      </div>
    </Link>
  );
}
