import Link from "next/link";
import { redirect } from "next/navigation";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { SiteHeader } from "@/components/site-header";
import { currentAppUser } from "@/lib/auth";
import { PASSWORD_RECOVERY_PATH } from "@/lib/password-recovery";
import { userHasCatalogAccess } from "@/lib/subscription";

export default async function EsqueciSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; expirado?: string }>;
}) {
  const user = await currentAppUser();
  if (user?.mustResetPassword) redirect(PASSWORD_RECOVERY_PATH);
  if (user) {
    const hasAccess = await userHasCatalogAccess(user);
    redirect(hasAccess ? "/baixar" : "/assinar?next=/baixar");
  }

  const { erro, expirado } = await searchParams;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Esqueceu a senha?
          </h1>
          <p className="text-sm text-zinc-500">
            Informe o e-mail da conta. Se ele estiver cadastrado, você receberá
            um link. Abra o e-mail neste celular e toque no link — não precisa
            ser o mesmo navegador do computador.
          </p>
        </div>
        <div className="mt-8 rounded-2xl border border-border bg-surface p-6">
          {erro === "1" ? (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              Não foi possível abrir o link. Solicite uma nova recuperação.
            </p>
          ) : null}
          {expirado === "1" ? (
            <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              O link expirou, já foi usado ou não abriu neste aparelho. Peça
              outro e-mail abaixo e abra o link neste celular.
            </p>
          ) : null}
          <ForgotPasswordForm />
        </div>
        <p className="mt-6 text-center text-xs text-zinc-600">
          <Link href="/login" className="hover:text-zinc-400">
            ← Voltar ao login
          </Link>
        </p>
      </main>
    </>
  );
}
