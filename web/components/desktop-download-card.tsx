import { getDesktopDownloadInfo } from "@/lib/desktop-download";

export function DesktopDownloadCard({
  title = "Seu app MontaHD",
  description = "Instale o app no Windows para que os jogos escolhidos aqui sejam baixados, descompactados e organizados no HD automaticamente.",
}: {
  title?: string;
  description?: string;
}) {
  const download = getDesktopDownloadInfo();

  return (
    <section className="rounded-2xl border border-border bg-surface p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl space-y-2">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <p className="text-sm leading-6 text-zinc-400">{description}</p>
          <p className="text-xs text-zinc-600">
            {download.platform} · versão {download.version} ·{" "}
            {download.sizeLabel} · o Windows pode pedir &quot;Executar mesmo
            assim&quot; por não ser assinado.
          </p>
        </div>
        <a
          href={download.href}
          download={download.fileName}
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover"
        >
          Baixar o app
        </a>
      </div>
    </section>
  );
}
