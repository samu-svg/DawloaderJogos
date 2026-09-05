import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border pt-8 pb-4">
      <div className="flex flex-col gap-3 text-sm text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
        <p>MontaHD — aplicativo de download e organização de arquivos.</p>
        <div className="flex flex-wrap gap-4">
          <Link href="/baixar" className="hover:text-zinc-400">
            Montar meu HD
          </Link>
          <Link href="/assinar" className="hover:text-zinc-400">
            Acesso
          </Link>
          <Link href="/suporte" className="hover:text-zinc-400">
            Suporte
          </Link>
        </div>
      </div>
    </footer>
  );
}
