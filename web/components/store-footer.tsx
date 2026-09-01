import Image from "next/image";
import Link from "next/link";

export function StoreFooter() {
  return (
    <footer className="mt-24 border-t border-border pt-10 pb-10">
      <div className="content-narrow flex flex-col items-center gap-6 px-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <Image
            src="/montahd-icon.png"
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 rounded-lg"
          />
          <div>
            <p className="font-semibold text-white">
              Monta<span className="text-gradient">HD</span>
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
              Software que baixa, descompacta e monta o seu HD. Você paga pelo
              app, não pelos arquivos — acervo incluído no plano, sem
              anúncios.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-5 text-sm text-zinc-500">
          <Link href="/" className="hover:text-zinc-300">
            Jogos
          </Link>
          <Link href="/app" className="hover:text-zinc-300">
            O app
          </Link>
          <Link href="/assinar" className="hover:text-zinc-300">
            Liberar
          </Link>
        </div>
      </div>
    </footer>
  );
}
