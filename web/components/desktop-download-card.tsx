import { getDesktopDownloadInfo } from "@/lib/desktop-download";

export function DesktopDownloadCard({
  title = "App MontaHD para Windows",
  description = "Instale uma vez. Depois, os jogos escolhidos aqui são baixados, extraídos e organizados no HD automaticamente.",
}: {
  title?: string;
  description?: string;
}) {
  const download = getDesktopDownloadInfo();

  return (
    <section className="overflow-hidden rounded-[28px] border border-accent/25 bg-gradient-to-br from-violet-600/15 via-surface to-cyan-500/10 px-5 py-5 sm:px-7 sm:py-6">
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-2">
            Primeiro passo
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
            {title}
          </h2>
          <p className="text-sm leading-6 text-zinc-400">{description}</p>
          <p className="text-xs text-zinc-600">
            {download.platform} · v{download.version} · {download.sizeLabel} ·
            atalhos na área de trabalho e no Menu Iniciar
          </p>
        </div>
        <a
          href={download.href}
          download={download.fileName}
          className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-accent px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition hover:bg-accent-hover"
        >
          Baixar instalador
        </a>
      </div>
    </section>
  );
}
