import Link from "next/link";
import { GameCoverFrame } from "@/components/game-cover";
import { formatBytes } from "@/lib/manifest";

type GameStoreCardProps = {
  title: string;
  coverUrl?: string | null;
  sizeBytes?: number;
  catalogTitle?: string;
  href?: string;
  selected?: boolean;
  onClick?: () => void;
  compact?: boolean;
};

function formatTitle(label: string): string {
  if (!label) return "Jogo";
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function GameStoreCard({
  title,
  coverUrl,
  sizeBytes = 0,
  catalogTitle,
  href,
  selected,
  onClick,
  compact = false,
}: GameStoreCardProps) {
  const inner = (
    <>
      <div className="relative aspect-[3/4] w-full overflow-hidden">
        <GameCoverFrame title={title} coverUrl={coverUrl} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
        {selected !== undefined && (
          <span
            className={`absolute left-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold backdrop-blur ${
              selected
                ? "bg-accent text-white"
                : "border border-white/40 bg-black/40 text-transparent"
            }`}
          >
            ✓
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
          title={formatTitle(title)}
        >
          {formatTitle(title)}
        </h3>
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
