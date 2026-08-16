import Link from "next/link";
import { getDesktopDownloadInfo } from "@/lib/desktop-download";

export function DesktopDownloadCard({
  title = "Baixar o aplicativo Dawloader",
  description = "Necessário para baixar os jogos e organizar cada arquivo na pasta certa do HD. Funciona no Windows — versão portable, sem instalação.",
  showSteps = false,
}: {
  title?: string;
  description?: string;
  showSteps?: boolean;
}) {
  const download = getDesktopDownloadInfo();

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xl space-y-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {description}
          </p>
          <p className="text-xs text-zinc-500">
            {download.platform} · versão {download.version} ·{" "}
            {download.sizeLabel}
          </p>
        </div>
        <a
          href={download.href}
          download={download.fileName}
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          Baixar app para Windows
        </a>
      </div>

      {showSteps && (
        <ol className="mt-5 list-decimal space-y-2 border-t border-zinc-200 pt-5 pl-5 text-sm leading-6 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          <li>
            Baixe e execute o{" "}
            <Link href={download.href} className="underline">
              Dawloader
            </Link>
            .
          </li>
          <li>Escolha um portfólio abaixo e copie o slug na página dele.</li>
          <li>No app, cole a URL deste site, carregue o manifesto e escolha o HD. Para TeraBox, use <strong>Instalar zip</strong>.</li>
        </ol>
      )}

      <p className="mt-4 text-xs text-zinc-500">
        O Windows pode avisar que o app não é assinado — clique em &quot;Mais
        informações&quot; e depois &quot;Executar mesmo assim&quot;.
      </p>
    </section>
  );
}
