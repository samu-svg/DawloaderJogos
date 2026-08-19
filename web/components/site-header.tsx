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
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3.5">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400 text-sm font-bold text-white">
              M
            </span>
            <span className="text-lg font-semibold tracking-tight">MontaHD</span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
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
          </nav>
        </div>
        <nav className="flex items-center gap-2 text-sm">
          {showPainelLink && (
            <Link
              href="/painel"
              className="hidden rounded-lg px-3 py-1.5 text-zinc-400 transition hover:bg-surface-hover hover:text-white sm:inline"
            >
              Admin
            </Link>
          )}
          {email ? (
            <>
              <span className="hidden max-w-[160px] truncate text-zinc-500 lg:inline">
                {email}
              </span>
              <Link
                href={hasAccess ? "/baixar" : "/assinar"}
                className="rounded-lg bg-accent px-4 py-1.5 font-medium text-white transition hover:bg-accent-hover"
              >
                {hasAccess ? "Meu acervo" : "Liberar o app"}
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
