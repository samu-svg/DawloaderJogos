import Link from "next/link";
import { signOut } from "@/lib/actions/auth";

export function SiteHeader({
  email,
  showPainelLink = false,
}: {
  email?: string | null;
  showPainelLink?: boolean;
}) {
  return (
    <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Dawloader
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {showPainelLink && (
            <Link
              href="/painel"
              className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              Meus portfólios
            </Link>
          )}
          {email ? (
            <>
              <span className="hidden text-zinc-500 sm:inline">{email}</span>
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-full border border-zinc-300 px-4 py-1.5 text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  Sair
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                Entrar
              </Link>
              <Link
                href="/cadastro"
                className="rounded-full bg-zinc-950 px-4 py-1.5 text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                Criar conta
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
