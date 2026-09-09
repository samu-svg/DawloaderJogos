import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { SiteHeader } from "@/components/site-header";
import { currentAppUser } from "@/lib/auth";
import { PASSWORD_RECOVERY_PATH } from "@/lib/password-recovery";
import { afterAuthPath, userHasCatalogAccess } from "@/lib/subscription";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redefinida?: string }>;
}) {
  const user = await currentAppUser();
  if (user?.mustResetPassword) redirect(PASSWORD_RECOVERY_PATH);
  if (user) {
    const hasAccess = await userHasCatalogAccess(user);
    redirect(afterAuthPath(hasAccess));
  }

  const { redefinida } = await searchParams;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Entrar
          </h1>
          <p className="text-sm text-zinc-500">
            Acesse sua conta para baixar jogos no HD.
          </p>
        </div>
        <div className="mt-8 rounded-2xl border border-border bg-surface p-6">
          {redefinida === "1" ? (
            <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
              Senha redefinida. Entre com a nova senha.
            </p>
          ) : null}
          <Suspense fallback={<p className="text-sm text-zinc-500">Carregando...</p>}>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-xs text-zinc-600">
          <Link href="/" className="hover:text-zinc-400">
            ← Voltar para o acervo
          </Link>
        </p>
      </main>
    </>
  );
}
