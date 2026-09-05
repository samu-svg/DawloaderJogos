import { DesktopDownloadPicker } from "@/components/desktop-download-links";

export function DesktopDownloadCard({
  title = "Vamos baixar o aplicativo?",
  description = "O aplicativo é totalmente seguro. Se o Google ou o Chrome bloquear o download, clique em Manter ou Aceitar.",
  variant = "strip",
}: {
  title?: string;
  description?: string;
  variant?: "full" | "strip" | "inline";
}) {
  const strip = variant === "strip";
  const inline = variant === "inline";

  if (inline) {
    return (
      <section className="rounded-xl border border-accent/20 bg-surface/70 px-4 py-2.5">
        <div className="flex flex-col items-center gap-2 text-center">
          <div>
            <h2 className="text-sm font-semibold text-white">{title}</h2>
            <p className="text-[11px] leading-4 text-zinc-400">{description}</p>
          </div>
          <DesktopDownloadPicker variant="inline" />
        </div>
      </section>
    );
  }

  return (
    <section
      className={
        strip
          ? "mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-accent/25 bg-gradient-to-br from-violet-600/15 via-surface to-cyan-500/10 px-4 py-3.5"
          : "overflow-hidden rounded-[28px] border border-accent/25 bg-gradient-to-br from-violet-600/15 via-surface to-cyan-500/10 px-5 py-5 sm:px-7 sm:py-6"
      }
    >
      <div className={strip ? "space-y-3 text-center" : "space-y-5"}>
        <div className={strip ? "space-y-1" : "max-w-2xl space-y-2"}>
          {!strip && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-2">
              Primeiro passo
            </p>
          )}
          <h2
            className={
              strip
                ? "text-base font-semibold tracking-tight text-white"
                : "text-lg font-semibold tracking-tight text-white sm:text-xl"
            }
          >
            {title}
          </h2>
          <p className="text-xs leading-5 text-zinc-400">{description}</p>
        </div>
        <DesktopDownloadPicker variant={strip ? "strip" : "full"} />
      </div>
    </section>
  );
}
