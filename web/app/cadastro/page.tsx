import Link from "next/link";
import { redirect } from "next/navigation";
import { CadastroForm } from "@/components/cadastro-form";
import { SiteHeader } from "@/components/site-header";
import { currentUser } from "@/lib/supabase/server";

export default async function CadastroPage() {
  const user = await currentUser();
  if (user) redirect("/painel");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Criar conta</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Monte portfólios e defina onde cada arquivo vai no HD.
          </p>
        </div>
        <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <CadastroForm />
        </div>
        <p className="mt-6 text-center text-xs text-zinc-500">
          Já tem conta?{" "}
          <Link href="/login" className="underline">
            Entrar
          </Link>
        </p>
      </main>
    </>
  );
}
