import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { isPortfolioAdmin } from "@/lib/admin";
import { currentUser } from "@/lib/supabase/server";

export default async function AssinarSucessoPage() {
  const user = await currentUser();

  return (
    <>
      <SiteHeader
        email={user?.email}
        showPainelLink={isPortfolioAdmin(user?.email)}
        hasAccess
      />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Pagamento recebido
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Estamos confirmando sua assinatura. Em alguns segundos o app e o acervo
          serão liberados — atualize a página se necessário.
        </p>
        <Link
          href="/baixar"
          className="mx-auto mt-8 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover"
        >
          Abrir meu acervo
        </Link>
      </main>
    </>
  );
}
