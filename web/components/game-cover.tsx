"use client";

import type { CatalogBadge } from "@/lib/catalog-badges";

type GameCoverFrameProps = {
  title: string;
  coverUrl?: string | null;
  className?: string;
  badges?: CatalogBadge[];
  showTitle?: boolean;
};

function initial(title: string): string {
  const letter = title.trim().charAt(0);
  return letter ? letter.toUpperCase() : "?";
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

function Fallback({
  title,
  className = "",
  badges = [],
  showTitle = false,
}: {
  title: string;
  className?: string;
  badges?: CatalogBadge[];
  showTitle?: boolean;
}) {
  const audioBadges = badges.filter((badge) => badge.kind === "audio");

  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-violet-900/40 via-zinc-900 to-zinc-950 px-3 text-center ${className}`}
      aria-hidden
    >
      {showTitle ? (
        <>
          <p className="line-clamp-3 text-xs font-semibold leading-snug text-white/90">
            {title}
          </p>
          {audioBadges.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1">
              {audioBadges.map((badge) => (
                <span
                  key={badge.label}
                  className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${badgeClass(badge.tone)}`}
                >
                  {badge.label}
                </span>
              ))}
            </div>
          )}
        </>
      ) : (
        <span className="text-3xl font-semibold text-violet-200/80">
          {initial(title)}
        </span>
      )}
    </div>
  );
}

/** Capa do jogo com fallback quando não há imagem ou o link falha. */
export function GameCoverFrame({
  title,
  coverUrl,
  className = "",
  badges = [],
  showTitle = false,
}: GameCoverFrameProps) {
  if (!coverUrl) {
    return (
      <Fallback
        title={title}
        className={className}
        badges={badges}
        showTitle={showTitle || badges.length > 0}
      />
    );
  }

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      <Fallback title={title} className="absolute inset-0" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={coverUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className="relative h-full w-full object-cover"
        onError={(event) => {
          event.currentTarget.remove();
        }}
      />
    </div>
  );
}
