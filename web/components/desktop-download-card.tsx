import { DesktopDownloadPicker } from "@/components/desktop-download-links";

export function DesktopDownloadCard({
  title = "App MontaHD para Windows",
  description = "Instale uma vez. Depois, os jogos escolhidos aqui são baixados, extraídos e organizados no HD automaticamente.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-accent/25 bg-gradient-to-br from-violet-600/15 via-surface to-cyan-500/10 px-5 py-5 sm:px-7 sm:py-6">
      <div className="space-y-5">
        <div className="max-w-2xl space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-2">
            Primeiro passo
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
            {title}
          </h2>
          <p className="text-sm leading-6 text-zinc-400">{description}</p>
          <p className="text-xs leading-5 text-zinc-500">
            Windows 10/11 (32 e 64-bit) e Windows 7/8/8.1. Instale só a versão do
            seu sistema — a sugerida vem marcada.
          </p>
        </div>
        <DesktopDownloadPicker />
      </div>
    </section>
  );
}
