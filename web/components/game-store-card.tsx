import Link from "next/link";
import { GameCoverFrame } from "@/components/game-cover";
import type { CatalogBadge } from "@/lib/catalog-badges";
import { formatBytes } from "@/lib/manifest";

type GameStoreCardProps = {
  title: string;
  coverUrl?: string | null;
  sizeBytes?: number;
  catalogTitle?: string;
  platform?: string;
  extraCount?: number;
  badges?: CatalogBadge[];
  href?: string;
  selected?: boolean;
  onClick?: () => void;
  compact?: boolean;
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
    case "weekly":
      return "bg-amber-500/90 text-black";
    case "utility":
      return "bg-emerald-700/90 text-white";
    case "featured":
      return "bg-amber-400/95 text-black";
    default:
      return "bg-zinc-700/90 text-white";
  }
}

export function GameStoreCard({
  title,
  coverUrl,
  sizeBytes = 0,
  catalogTitle,
  platform,
  extraCount = 0,
  badges = [],
  href,
  selected,
  onClick,
  compact = false,
}: GameStoreCardProps) {
  const displayTitle = formatTitle(title);
  const audioBadges = badges.filter((badge) => badge.kind === "audio");
  const dlcBadges = badges.filter((badge) => badge.kind === "dlc");
  const weeklyBadges = badges.filter((badge) => badge.kind === "weekly");
  const hasCover = Boolean(coverUrl);

  const inner = (
    <>
      <div className="relative aspect-[3/4] w-full overflow-hidden">
        <GameCoverFrame
          title={displayTitle}
          coverUrl={coverUrl}
          badges={audioBadges}
          showTitle={!hasCover}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
        {selected !== undefined && (
          <span
            className={`absolute left-2.5 top-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold backdrop-blur ${
              selected
                ? "bg-accent text-white"
                : "border border-white/40 bg-black/40 text-transparent"
            }`}
          >
            ✓
          </span>
        )}
        {platform && (
          <span className="absolute right-2 top-2 z-10 rounded-md bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-300 backdrop-blur">
            {platform}
          </span>
        )}
        {(dlcBadges.length > 0 || extraCount > 0) && (
          <span className="absolute bottom-2 right-2 z-10 rounded-md bg-accent/85 px-1.5 py-0.5 text-[9px] font-semibold text-white shadow-sm backdrop-blur">
            {dlcBadges[0]?.label ?? `+${extraCount} DLC`}
          </span>
        )}
        {weeklyBadges.length > 0 && (
          <span
            className={`absolute z-10 rounded-md px-1.5 py-0.5 text-[9px] font-semibold shadow-sm backdrop-blur ${badgeClass("weekly")} ${
              dlcBadges.length > 0 || extraCount > 0
                ? "bottom-8 right-2"
                : "bottom-2 right-2"
            }`}
          >
            {weeklyBadges[0].label}
          </span>
        )}
        {catalogTitle && (
          <span className="absolute bottom-2 left-2 right-2 truncate text-[10px] font-medium uppercase tracking-wide text-zinc-300">
            {catalogTitle}
          </span>
        )}
      </div>
      <div className={`space-y-1 text-center ${compact ? "p-3" : "p-4"}`}>
        <h3
          className={`truncate font-semibold text-white ${compact ? "text-sm" : "text-base"}`}
          title={displayTitle}
        >
          {displayTitle}
        </h3>
        {audioBadges.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1">
            {audioBadges.map((badge) => (
              <span
                key={badge.label}
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${badgeClass(badge.tone)}`}
              >
                {badge.label}
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-zinc-500">
          {sizeBytes > 0 ? formatBytes(sizeBytes) : "Incluído no acervo"}
        </p>
      </div>
    </>
  );

  const className = `card-glow block w-full overflow-hidden rounded-2xl border bg-surface text-center ${
    selected
      ? "border-accent ring-1 ring-accent"
      : "border-border"
  }`;

  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {inner}
      </button>
    );
  }

  return <article className={className}>{inner}</article>;
}
