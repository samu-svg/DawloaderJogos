import Link from "next/link";
import { DesktopDownloadPicker } from "@/components/desktop-download-links";

function DesktopDownloadSignupGate({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "flex flex-col items-center gap-2 text-center"
          : "mx-auto flex max-w-md flex-col items-center gap-3 text-center"
      }
    >
      <p className="text-sm leading-6 text-zinc-400">
        Crie a conta, confirme o e-mail e volte aqui para baixar o instalador.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link
          href="/cadastro?next=/app"
          className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover"
        >
          Criar conta grátis
        </Link>
        <Link
          href="/login?next=/app"
          className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:text-white"
        >
          Entrar
        </Link>
      </div>
    </div>
  );
}

export function DesktopDownloadCard({
  title = "Vamos baixar o aplicativo?",
  description = "Com a conta confirmada, baixe o instalador. Se o Google ou o Chrome bloquear, clique em Manter ou Aceitar.",
  variant = "strip",
  loggedIn = false,
}: {
  title?: string;
  description?: string;
  variant?: "full" | "strip" | "inline";
  loggedIn?: boolean;
}) {
  const strip = variant === "strip";
  const inline = variant === "inline";
  const gateTitle = "Crie sua conta para baixar o app";
  const gateDescription =
    "O MontaHD só funciona com cadastro concluído — conta criada e e-mail confirmado.";

  if (inline) {
    return (
      <section className="rounded-xl border border-accent/20 bg-surface/70 px-4 py-2.5">
        <div className="flex flex-col items-center gap-2 text-center">
          <div>
            <h2 className="text-sm font-semibold text-white">
              {loggedIn ? title : gateTitle}
            </h2>
            <p className="text-[11px] leading-4 text-zinc-400">
              {loggedIn ? description : gateDescription}
            </p>
          </div>
          {loggedIn ? (
            <DesktopDownloadPicker variant="inline" loggedIn />
          ) : (
            <DesktopDownloadSignupGate compact />
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      className={
        strip
          ? "mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-accent/25 bg-gradient-to-br from-violet-600/15 via-surface to-cyan-500/10 px-4 py-3.5"
          : "overflow-hidden rounded-[28px] border border-accent/25 bg-gradient-to-br from-violet-600/15 via-surface to-cyan-500/10 px-5 py-5 sm:px-7 sm:py-6"
      }
    >
      <div className={strip ? "space-y-3 text-center" : "space-y-5"}>
        <div className={strip ? "space-y-1" : "max-w-2xl space-y-2"}>
          {!strip && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-2">
              {loggedIn ? "Depois do cadastro" : "Antes do app"}
            </p>
          )}
          <h2
            className={
              strip
                ? "text-base font-semibold tracking-tight text-white"
                : "text-lg font-semibold tracking-tight text-white sm:text-xl"
            }
          >
            {loggedIn ? title : gateTitle}
          </h2>
          <p className="text-xs leading-5 text-zinc-400">
            {loggedIn ? description : gateDescription}
          </p>
        </div>
        {loggedIn ? (
          <DesktopDownloadPicker variant={strip ? "strip" : "full"} loggedIn />
        ) : (
          <DesktopDownloadSignupGate />
        )}
      </div>
    </section>
  );
}
