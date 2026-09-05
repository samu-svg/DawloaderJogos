import Link from "next/link";
import { redirect } from "next/navigation";
import { ConfirmEmailForm } from "@/components/confirm-email-form";
import { SiteHeader } from "@/components/site-header";
import { currentAppUser } from "@/lib/auth";
import { CONFIRM_EMAIL_PENDING_MESSAGE } from "@/lib/auth-messages";
import {
  PASSWORD_RECOVERY_PATH,
  isWellFormedEmail,
} from "@/lib/password-recovery";
import { userHasCatalogAccess } from "@/lib/subscription";

export default async function ConfirmarEmailPage({
  searchParams,
}: {
  searchParams: Promise<{
    email?: string;
    enviado?: string;
    erro?: string;
    expirado?: string;
    pendente?: string;
  }>;
}) {
  const user = await currentAppUser();
  if (user?.mustResetPassword) redirect(PASSWORD_RECOVERY_PATH);
  if (user) {
    const hasAccess = await userHasCatalogAccess(user);
    redirect(hasAccess ? "/baixar" : "/assinar?next=/baixar");
  }

  const params = await searchParams;
  const email = params.email?.trim().toLowerCase() ?? "";
  const initialEmail = isWellFormedEmail(email) ? email : "";

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Confirmar e-mail
          </h1>
          <p className="text-sm text-zinc-500">
            Cole o código que enviamos. Não precisa clicar no link do e-mail —
            se o Gmail ou o Outlook abrirem sozinhos, o código continua
            valendo.
          </p>
        </div>
        <div className="mt-8 rounded-2xl border border-border bg-surface p-6">
          {params.erro === "1" ? (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              Não foi possível abrir o link. Cole o código do e-mail nesta tela
              ou peça outro.
            </p>
          ) : null}
          {params.expirado === "1" ? (
            <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              O link expirou ou já foi usado. Cole o código aqui, ou peça outro
              e-mail.
            </p>
          ) : null}
          {params.pendente === "1" ? (
            <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              {CONFIRM_EMAIL_PENDING_MESSAGE}
            </p>
          ) : null}
          <ConfirmEmailForm
            initialEmail={initialEmail}
            alreadySent={params.enviado === "1" && Boolean(initialEmail)}
          />
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
