import Link from "next/link";
import { getDesktopDownloadInfo } from "@/lib/desktop-download";

const INCLUDED = [
  "Licença do software MontaHD para Windows, sempre atualizado",
  "Acesso total ao acervo enquanto a assinatura estiver ativa",
  "Instalação automática com extração e verificação",
  "Qualquer pasta do HD — sem vincular disco à conta",
  "Nenhum anúncio, nenhum encurtador, nenhuma espera",
  "Cancele quando quiser pelo portal da assinatura",
];

export function AppPlanCard({
  planLabel,
  hasAccess,
  loggedIn,
  paymentsEnabled,
}: {
  planLabel: string;
  hasAccess: boolean;
  loggedIn: boolean;
  paymentsEnabled: boolean;
}) {
  const download = getDesktopDownloadInfo();
  const href = hasAccess ? "/baixar" : loggedIn ? "/assinar" : "/cadastro?next=/assinar";
  const label = hasAccess
    ? "Abrir meu acervo"
    : loggedIn
      ? "Assinar o app"
      : "Criar conta e assinar";

  return (
    <section className="mt-20">
      <div className="relative overflow-hidden rounded-3xl border border-accent/30 bg-gradient-to-br from-violet-600/15 via-surface to-cyan-500/10 p-8 text-center sm:p-12">
        <div className="mx-auto grid max-w-3xl gap-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-2">
              O que você compra
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Acesso ao MontaHD
            </h2>
            <p className="mt-3 leading-7 text-zinc-300">
              Você paga pelo <strong className="text-white">software</strong>,
              não pelos arquivos dos portfólios. Planos de 1, 2 ou 3 meses liberam o
              MontaHD — a ferramenta que baixa, descompacta e monta o seu HD. Cartão
              recorrente ou PIX à vista.
            </p>
            <p className="mt-6 text-3xl font-bold text-white">{planLabel}</p>
            {!paymentsEnabled && (
              <p className="mt-2 text-sm text-amber-300/80">
                Pagamentos em configuração — o acervo está aberto para testes.
              </p>
            )}
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={href}
                className="rounded-xl bg-accent px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition hover:bg-accent-hover"
              >
                {label}
              </Link>
              {hasAccess && (
                <a
                  href={download.href}
                  download={download.fileName}
                  className="rounded-xl border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-medium text-zinc-200 transition hover:border-white/30 hover:text-white"
                >
                  Baixar o app ({download.version})
                </a>
              )}
            </div>
          </div>

          <ul className="mx-auto max-w-md space-y-3 text-left">
            {INCLUDED.map((item) => (
              <li key={item} className="flex gap-3 text-sm leading-6 text-zinc-300">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[11px] font-bold text-accent-hover">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
