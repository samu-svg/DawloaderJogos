import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { currentAppUser } from "@/lib/auth";
import { canAccessPainel } from "@/lib/rbac";

export default async function AssinarSucessoPage() {
  const user = await currentAppUser();

  return (
    <>
      <SiteHeader
        email={user?.email}
        showPainelLink={user ? canAccessPainel(user.role) : false}
        hasAccess
      />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Pagamento recebido
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Pagamento confirmado. Em alguns segundos o app e o acervo serão
          liberados — se pagou com PIX, pode levar um instante após a
          confirmação bancária.
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
