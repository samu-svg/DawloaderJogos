import { redirect } from "next/navigation";
import { signOut } from "@/lib/actions/auth";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { SiteHeader } from "@/components/site-header";
import { currentAppUser } from "@/lib/auth";
import { FORGOT_PASSWORD_PATH } from "@/lib/password-recovery";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-policy";

export default async function RedefinirSenhaPage() {
  const user = await currentAppUser();
  if (!user) redirect(`${FORGOT_PASSWORD_PATH}?expirado=1`);
  if (!user.mustResetPassword) redirect("/conta");

  return (
    <>
      <SiteHeader email={user.email} />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Nova senha
          </h1>
          <p className="text-sm text-zinc-500">
            Defina uma senha com pelo menos {PASSWORD_MIN_LENGTH} caracteres.
            Por segurança, as outras sessões serão encerradas.
          </p>
        </div>
        <div className="mt-8 rounded-2xl border border-border bg-surface p-6">
          <ResetPasswordForm />
        </div>
        <form action={signOut} className="mt-6 text-center text-xs text-zinc-600">
          <button type="submit" className="hover:text-zinc-400">
            Sair
          </button>
        </form>
      </main>
    </>
  );
}
