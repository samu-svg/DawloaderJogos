import Link from "next/link";
import { PasswordChangeForm } from "@/components/password-change-form";
import { SiteHeader } from "@/components/site-header";
import { requireAppUser } from "@/lib/auth";
import { passwordIsExpired } from "@/lib/password-policy";
import { canAccessPainel } from "@/lib/rbac";

export default async function ContaPage({
  searchParams,
}: {
  searchParams: Promise<{ rotacao?: string }>;
}) {
  const user = await requireAppUser({ skipPasswordCheck: true });
  const { rotacao } = await searchParams;
  const expired = passwordIsExpired(user.passwordChangedAt) || rotacao === "1";

  return (
    <>
      <SiteHeader
        email={user.email}
        showPainelLink={canAccessPainel(user.role)}
      />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Conta</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Troque a senha a cada 90 dias. Mínimo de 12 caracteres.
        </p>
        <div className="mt-8 rounded-2xl border border-border bg-surface p-6">
          <PasswordChangeForm expired={expired} />
        </div>
        <p className="mt-6 flex flex-wrap items-center justify-center gap-4 text-center text-xs text-zinc-600">
          <Link href="/conta/assinatura" className="hover:text-zinc-400">
            Meu plano
          </Link>
          <Link href="/suporte" className="hover:text-zinc-400">
            Suporte
          </Link>
          <Link href="/baixar" className="hover:text-zinc-400">
            ← Voltar ao acervo
          </Link>
        </p>
      </main>
    </>
  );
}
