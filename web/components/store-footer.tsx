import Link from "next/link";

export function StoreFooter() {
  return (
    <footer className="mt-24 border-t border-border pt-10 pb-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-white">MontaHD</p>
          <p className="mt-1 max-w-md text-sm text-zinc-500">
            O app que baixa, descompacta e monta o seu HD. Acervo incluído na
            assinatura, sem anúncios.
          </p>
        </div>
        <div className="flex flex-wrap gap-5 text-sm text-zinc-500">
          <Link href="/" className="hover:text-zinc-300">
            Jogos
          </Link>
          <Link href="/app" className="hover:text-zinc-300">
            O app
          </Link>
          <Link href="/assinar" className="hover:text-zinc-300">
            Assinatura
          </Link>
        </div>
      </div>
    </footer>
  );
}
