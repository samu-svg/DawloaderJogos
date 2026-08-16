import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { currentUser } from "@/lib/supabase/server";

export default async function HomePage() {
  const user = await currentUser();

  return (
    <>
      <SiteHeader email={user?.email} showPainelLink={Boolean(user)} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-20">
        <div className="max-w-2xl space-y-6">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
            Organizador de downloads
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Monte um portfólio. O app baixa e organiza no HD.
          </h1>
          <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Você cadastra os arquivos, define em qual pasta cada um vai no disco
            e compartilha o manifesto. O aplicativo de desktop faz o resto.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            {user ? (
              <Link
                href="/painel"
                className="rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                Ir para o painel
              </Link>
            ) : (
              <>
                <Link
                  href="/cadastro"
                  className="rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                  Criar conta
                </Link>
                <Link
                  href="/login"
                  className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  Entrar
                </Link>
              </>
            )}
          </div>
        </div>

        <section className="mt-20 grid gap-6 sm:grid-cols-3">
          {[
            {
              title: "1. Cadastre",
              text: "Crie um portfólio e adicione arquivos com link e pasta de destino.",
            },
            {
              title: "2. Publique",
              text: "Deixe o portfólio público para gerar o manifesto da API.",
            },
            {
              title: "3. Baixe",
              text: "O app de desktop lê o manifesto e grava tudo no HD certo.",
            },
          ].map((step) => (
            <div
              key={step.title}
              className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800"
            >
              <h2 className="font-semibold">{step.title}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {step.text}
              </p>
            </div>
          ))}
        </section>
      </main>
    </>
  );
}
