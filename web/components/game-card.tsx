import Link from "next/link";
import { GameCoverFrame } from "@/components/game-cover";
import { formatBytes } from "@/lib/manifest";

type GameCardProps = {
  title: string;
  slug: string;
  coverUrl?: string | null;
  sizeBytes?: number;
  platform: string;
  extraCount?: number;
};

function formatTitle(label: string): string {
  if (!label) return "Jogo";
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function GameCard({
  title,
  slug,
  coverUrl,
  sizeBytes = 0,
  platform,
  extraCount = 0,
}: GameCardProps) {
  return (
    <Link
      href={`/jogo/${slug}`}
      className="card-glow group block overflow-hidden rounded-xl border border-border bg-surface"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden">
        <GameCoverFrame title={title} coverUrl={coverUrl} />
        <span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300 backdrop-blur">
          {platform}
        </span>
        {extraCount > 0 && (
          <span className="absolute right-2 top-2 rounded-md bg-accent/85 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
            +{extraCount} DLC
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 flex h-10 items-center justify-center bg-accent/90 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100">
          Ver e baixar
        </span>
      </div>
      <div className="space-y-1 p-3 text-center">
        <h3
          className="truncate text-sm font-semibold text-white"
          title={formatTitle(title)}
        >
          {formatTitle(title)}
        </h3>
        <p className="text-xs text-zinc-500">
          {sizeBytes > 0 ? formatBytes(sizeBytes) : "Tamanho sob consulta"}
        </p>
      </div>
    </Link>
  );
}
