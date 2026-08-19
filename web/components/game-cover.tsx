"use client";

type GameCoverFrameProps = {
  title: string;
  coverUrl?: string | null;
  className?: string;
};

function initial(title: string): string {
  const letter = title.trim().charAt(0);
  return letter ? letter.toUpperCase() : "?";
}

function Fallback({ title, className = "" }: { title: string; className?: string }) {
  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-900/40 via-zinc-900 to-zinc-950 text-3xl font-semibold text-violet-200/80 ${className}`}
      aria-hidden
    >
      {initial(title)}
    </div>
  );
}

/** Capa do jogo com fallback quando não há imagem ou o link falha. */
export function GameCoverFrame({
  title,
  coverUrl,
  className = "",
}: GameCoverFrameProps) {
  if (!coverUrl) {
    return <Fallback title={title} className={className} />;
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
