import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { SiteHeader } from "@/components/site-header";
import { currentUser } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{ cadastro?: string }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const user = await currentUser();
  if (user) redirect("/painel");

  const { cadastro } = await searchParams;
  const cadastroFechado = cadastro === "fechado";

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Acesso restrito ao administrador do catálogo.
          </p>
        </div>
        {cadastroFechado && (
          <p className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            Cadastro público desativado. Use a conta de administrador.
          </p>
        )}
        <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <LoginForm />
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
