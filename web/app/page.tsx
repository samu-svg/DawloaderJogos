import Link from "next/link";
import { DesktopDownloadCard } from "@/components/desktop-download-card";
import { SiteHeader } from "@/components/site-header";
import { isPortfolioAdmin } from "@/lib/admin";
import { listPublicPortfolios } from "@/lib/catalog";
import { currentUser } from "@/lib/supabase/server";

export default async function HomePage() {
  const [user, portfolios] = await Promise.all([
    currentUser(),
    listPublicPortfolios(),
  ]);
  const isAdmin = isPortfolioAdmin(user?.email);

  return (
    <>
      <SiteHeader email={user?.email} showPainelLink={isAdmin} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-16 sm:py-20">
        <div className="max-w-2xl space-y-6">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
            Downloads para o seu HD
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Baixe jogos prontos e instale na pasta certa.
          </h1>
          <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Escolha um pacote no catálogo, abra o app Dawloader no Windows e
            confirme o download. Arquivos .zip são descompactados sozinhos —
            você recebe a pasta do jogo em <strong>Games</strong>,{" "}
            <strong>Content</strong> ou onde estiver configurado.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <a
              href={portfolios.length ? "#catalogo" : "/baixar"}
              className="rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              Ver catálogo
            </a>
            <Link
              href="/baixar"
              className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Como funciona
            </Link>
            {isAdmin && (
              <Link
                href="/painel"
                className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Administrar
              </Link>
            )}
          </div>
        </div>

        <div className="mt-12">
          <DesktopDownloadCard
            title="1. Baixe o app Dawloader"
            description="Instale no Windows (portable, sem setup). É ele que baixa os jogos e grava cada um na pasta correta do HD."
            showSteps
          />
        </div>

        <section className="mt-16 grid gap-6 sm:grid-cols-3">
          {[
            {
              title: "2. Escolha os jogos",
              text: "Abra um pacote no catálogo e veja o que está disponível — capa, tamanho e pasta de destino.",
            },
            {
              title: "3. Carregue no app",
              text: "Cole a URL deste site e o código do pacote. Escolha o HD de destino e marque o que quer baixar.",
            },
            {
              title: "4. Pronto no HD",
              text: "O app baixa, descompacta quando for zip e organiza tudo. Só abrir a pasta e jogar.",
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

        <section id="catalogo" className="mt-16 scroll-mt-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Catálogo</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Pacotes públicos disponíveis para download.
              </p>
            </div>
            {portfolios.length > 0 && (
              <Link
                href="/baixar"
                className="text-sm font-medium underline text-zinc-600 dark:text-zinc-400"
              >
                Ver todos
              </Link>
            )}
          </div>

          {!portfolios.length ? (
            <div className="mt-6 rounded-2xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
              <p className="text-zinc-600 dark:text-zinc-400">
                Nenhum pacote publicado ainda. Volte em breve.
              </p>
            </div>
          ) : (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {portfolios.slice(0, 4).map((portfolio) => (
                <li key={portfolio.id}>
                  <Link
                    href={`/baixar/${portfolio.slug}`}
                    className="block h-full rounded-2xl border border-zinc-200 bg-white p-5 transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
                  >
                    <h3 className="font-semibold">{portfolio.title}</h3>
                    {portfolio.description && (
                      <p className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                        {portfolio.description}
                      </p>
                    )}
                    <p className="mt-4 text-xs text-zinc-500">
                      {portfolio.entryCount} jogo(s) · atualizado{" "}
                      {new Date(portfolio.updatedAt).toLocaleDateString("pt-BR")}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {!user && (
          <p className="mt-16 text-center text-xs text-zinc-500">
            Administrador?{" "}
            <Link href="/login" className="underline">
              Entrar
            </Link>
          </p>
        )}
      </main>
    </>
  );
}
