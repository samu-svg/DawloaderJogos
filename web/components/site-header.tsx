import Image from "next/image";
import Link from "next/link";
import { signOut } from "@/lib/actions/auth";

export function SiteHeader({
  email,
  showPainelLink = false,
  hasAccess = false,
}: {
  email?: string | null;
  showPainelLink?: boolean;
  hasAccess?: boolean;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="content-narrow grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-6 py-3.5">
        <nav className="hidden items-center gap-1 justify-self-start sm:flex">
          <Link
            href="/"
            className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition hover:bg-surface-hover hover:text-white"
          >
            Jogos
          </Link>
          <Link
            href="/app"
            className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition hover:bg-surface-hover hover:text-white"
          >
            O app
          </Link>
          {showPainelLink && (
            <Link
              href="/painel"
              className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition hover:bg-surface-hover hover:text-white"
            >
              Admin
            </Link>
          )}
        </nav>

        <Link
          href="/"
          className="flex items-center justify-center gap-2.5 justify-self-center"
        >
          <Image
            src="/montahd-icon.png"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 rounded-lg"
            priority
          />
          <span className="text-lg font-semibold tracking-tight">
            Monta<span className="text-gradient">HD</span>
          </span>
        </Link>

        <nav className="flex items-center justify-end gap-2 justify-self-end text-sm">
          {email ? (
            <>
              <span className="hidden max-w-[140px] truncate text-zinc-500 xl:inline">
                {email}
              </span>
              <Link
                href="/suporte"
                className="hidden rounded-lg px-3 py-1.5 text-zinc-400 transition hover:text-white sm:inline"
              >
                Suporte
              </Link>
              <Link
                href="/conta"
                className="hidden rounded-lg px-3 py-1.5 text-zinc-400 transition hover:text-white sm:inline"
              >
                Conta
              </Link>
              <Link
                href={hasAccess ? "/baixar" : "/assinar"}
                className="rounded-lg bg-accent px-4 py-1.5 font-medium text-white transition hover:bg-accent-hover"
              >
                {hasAccess ? "Montar meu HD" : "Liberar o app"}
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-lg border border-border px-3 py-1.5 text-zinc-400 transition hover:border-zinc-600 hover:text-white"
                >
                  Sair
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3 py-1.5 text-zinc-400 transition hover:text-white"
              >
                Entrar
              </Link>
              <Link
                href="/cadastro?next=/assinar"
                className="rounded-lg bg-accent px-4 py-1.5 font-medium text-white transition hover:bg-accent-hover"
              >
                Liberar o app
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
