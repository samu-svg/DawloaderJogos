import Link from "next/link";
import { redirect } from "next/navigation";
import { CadastroForm } from "@/components/cadastro-form";
import { SiteHeader } from "@/components/site-header";
import { currentUser } from "@/lib/supabase/server";

export default async function CadastroPage() {
  const user = await currentUser();
  if (user) redirect("/baixar");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Criar conta
          </h1>
          <p className="text-sm text-zinc-500">
            Crie sua conta para liberar o app MontaHD e o acervo completo.
          </p>
        </div>
        <div className="mt-8 rounded-2xl border border-border bg-surface p-6">
          <CadastroForm />
        </div>
        <p className="mt-6 text-center text-xs text-zinc-600">
          Já tem conta?{" "}
          <Link href="/login" className="text-accent hover:text-accent-hover">
            Entrar
          </Link>
        </p>
      </main>
    </>
  );
}
