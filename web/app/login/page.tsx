import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { SiteHeader } from "@/components/site-header";
import { currentUser } from "@/lib/supabase/server";

export default async function LoginPage() {
  const user = await currentUser();
  if (user) redirect("/baixar");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Acesse o catálogo e baixe jogos com o app Dawloader.
          </p>
        </div>
        <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <Suspense fallback={<p className="text-sm text-zinc-500">Carregando...</p>}>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-xs text-zinc-500">
          <Link href="/" className="underline">
            Voltar para a página inicial
          </Link>
        </p>
      </main>
    </>
  );
}
