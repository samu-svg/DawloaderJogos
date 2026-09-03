"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  formatCountdown,
  parseAsaasDateTime,
  pixQrImageSrc,
  type PixCheckoutView,
} from "@/lib/asaas-pix-format";

const POLL_MS = 3000;

const STEPS = [
  {
    title: "Abra o app do banco",
    text: "Entre na área PIX do seu banco ou carteira digital.",
  },
  {
    title: "Escaneie ou cole o código",
    text: "Use a câmera no QR Code ou a opção Copia e Cola.",
  },
  {
    title: "Confirme o valor",
    text: "O acesso é liberado automaticamente nesta tela.",
  },
] as const;

async function copyFromField(field: HTMLTextAreaElement, text: string): Promise<boolean> {
  field.focus();
  field.select();
  field.setSelectionRange(0, text.length);

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Continua no execCommand — alguns navegadores bloqueiam a Clipboard API.
  }

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  }
}

function PixBadge() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-teal-400/35 bg-teal-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-300">
      <span className="h-1.5 w-1.5 rounded-full bg-teal-400 shadow-[0_0_10px_rgba(45,212,191,0.8)]" />
      PIX à vista
    </span>
  );
}

function StatusPill({
  paid,
  expired,
}: {
  paid: boolean;
  expired: boolean;
}) {
  if (paid) {
    return (
      <p
        role="status"
        aria-live="polite"
        className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-300"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 text-[11px] font-bold text-emerald-950">
          ✓
        </span>
        Pagamento confirmado. Liberando seu acesso…
      </p>
    );
  }

  if (expired) {
    return (
      <p
        role="status"
        aria-live="polite"
        className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-200"
      >
        Este PIX expirou. Gere um novo código na página de planos.
      </p>
    );
  }

  return (
    <p
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2.5 rounded-2xl border border-teal-400/25 bg-teal-500/10 px-4 py-3 text-sm font-medium text-teal-100"
    >
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-teal-400" />
      </span>
      Aguardando pagamento…
    </p>
  );
}

function useCountdown(expirationDate: string | null) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return useMemo(() => {
    if (now === null) return null;
    const end = parseAsaasDateTime(expirationDate);
    if (!end) return null;
    return Math.max(0, end.getTime() - now);
  }, [expirationDate, now]);
}

export function PixCheckout({ initial }: { initial: PixCheckoutView }) {
  const router = useRouter();
  const payloadRef = useRef<HTMLTextAreaElement>(null);
  const [view, setView] = useState(initial);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const remaining = useCountdown(view.qr?.expirationDate ?? null);
  const expired = view.expired || remaining === 0;

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/asaas/pix/${encodeURIComponent(view.paymentId)}`, {
      cache: "no-store",
    });
    if (!response.ok) return;
    const next = (await response.json()) as PixCheckoutView;
    setView(next);
  }, [view.paymentId]);

  useEffect(() => {
    if (view.paid || expired) return;

    let cancelled = false;

    async function tick() {
      if (cancelled || document.visibilityState === "hidden") return;
      try {
        await refresh();
      } catch {
        // Mantém o QR visível se a consulta falhar.
      }
    }

    const id = window.setInterval(() => {
      void tick();
    }, POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [expired, refresh, view.paid]);

  useEffect(() => {
    if (!view.paid) return;
    const id = window.setTimeout(() => {
      router.push("/assinar/sucesso");
      router.refresh();
    }, 1200);
    return () => window.clearTimeout(id);
  }, [router, view.paid]);

  async function handleCopy() {
    const payload = view.qr?.payload;
    const field = payloadRef.current;
    if (!payload || !field) return;
    setCopyError(null);
    const ok = await copyFromField(field, payload);
    if (!ok) {
      setCopyError("Código selecionado — pressione Ctrl+C para copiar.");
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  async function handleCheckNow() {
    setChecking(true);
    try {
      await refresh();
    } finally {
      setChecking(false);
    }
  }

  if (view.paid) {
    return (
      <div className="mx-auto w-full max-w-lg rounded-[28px] border border-emerald-400/25 bg-gradient-to-br from-emerald-500/15 via-surface to-surface p-8 text-center sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400 text-3xl font-bold text-emerald-950">
          ✓
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-white">
          Pagamento confirmado
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Estamos liberando o MontaHD e o acervo. Você entra em instantes.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:items-start">
      <section className="overflow-hidden rounded-[28px] border border-teal-400/20 bg-gradient-to-br from-teal-500/10 via-surface to-violet-600/10 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <PixBadge />
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Pague com PIX
            </h1>
            <p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">
              Escaneie o QR Code ou copie o código. A confirmação é automática —
              não feche esta página até o pagamento aparecer aqui.
            </p>
          </div>
          <p className="text-right">
            <span className="block text-xs uppercase tracking-[0.18em] text-zinc-500">
              Total
            </span>
            <span className="mt-1 block text-3xl font-bold tracking-tight text-white">
              {view.priceLabel}
            </span>
          </p>
        </div>

        <div className="mt-7 flex flex-col">
          <div className="order-2 flex flex-col items-center lg:order-1">
            <div className="rounded-[24px] bg-white p-4 shadow-[0_12px_40px_rgba(13,148,136,0.18)]">
              {view.qr?.encodedImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={pixQrImageSrc(view.qr.encodedImage)}
                  alt="QR Code PIX para pagamento"
                  width={256}
                  height={256}
                  className="h-52 w-52 bg-white object-contain sm:h-64 sm:w-64"
                />
              ) : (
                <div className="flex h-52 w-52 items-center justify-center sm:h-64 sm:w-64">
                  <p className="px-4 text-center text-sm text-zinc-500">
                    Gerando QR Code…
                  </p>
                </div>
              )}
            </div>
            <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
              Aponte a câmera do app do banco
            </p>
          </div>

          <div className="relative my-6 order-3 lg:order-2">
            <div className="h-px bg-border" />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              <span className="lg:hidden">ou escaneie o QR</span>
              <span className="hidden lg:inline">ou copie o código</span>
            </span>
          </div>

          <div className="order-1 lg:order-3">
            {view.qr?.payload ? (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="w-full rounded-2xl bg-teal-500 px-5 py-3.5 text-sm font-semibold text-teal-950 shadow-lg shadow-teal-500/20 transition hover:bg-teal-400"
                >
                  {copied ? "Código PIX copiado" : "Copiar código PIX"}
                </button>
                <textarea
                  ref={payloadRef}
                  readOnly
                  value={view.qr.payload}
                  rows={3}
                  spellCheck={false}
                  onFocus={(event) => event.currentTarget.select()}
                  className="max-h-24 w-full resize-none overflow-auto break-all rounded-2xl border border-border bg-background/70 px-4 py-3 font-mono text-[11px] leading-5 text-zinc-400 outline-none focus:border-teal-400/50"
                  aria-label="Código PIX copia e cola"
                />
                {copyError && <p className="text-sm text-teal-200">{copyError}</p>}
              </div>
            ) : (
              <p className="rounded-2xl border border-border bg-background/60 px-4 py-3 text-center text-sm text-zinc-400">
                O código PIX ainda está sendo gerado. Aguarde uns segundos.
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <StatusPill paid={false} expired={expired} />
          {remaining !== null && remaining > 0 && !expired && (
            <p className="text-center text-xs text-zinc-500">
              QR Code válido por{" "}
              <span className="font-semibold text-zinc-300">
                {formatCountdown(remaining)}
              </span>
            </p>
          )}
          <button
            type="button"
            disabled={checking || expired}
            onClick={() => void handleCheckNow()}
            className="w-full rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:opacity-50"
          >
            {checking ? "Verificando…" : "Já paguei — verificar agora"}
          </button>
        </div>
      </section>

      <aside className="space-y-4 lg:sticky lg:top-24">
        <section className="rounded-[28px] border border-border/80 bg-surface/80 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Resumo
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-zinc-500">Plano</dt>
              <dd className="font-medium text-white">{view.planTitle}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-zinc-500">Valor</dt>
              <dd className="font-semibold text-white">{view.priceLabel}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-zinc-500">Forma</dt>
              <dd className="text-teal-300">PIX à vista</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-zinc-500">Renovação</dt>
              <dd className="text-zinc-300">Sem cobrança automática</dd>
            </div>
          </dl>
          <p className="mt-5 rounded-2xl border border-border bg-background/50 px-4 py-3 text-xs leading-5 text-zinc-500">
            O acesso vale pelo tempo do plano escolhido e começa assim que o
            banco confirmar o PIX.
          </p>
        </section>

        <section className="rounded-[28px] border border-border/80 bg-surface/80 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Como pagar
          </h2>
          <ol className="mt-4 space-y-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-500/15 text-xs font-bold text-teal-300">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-white">{step.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-zinc-500">
                    {step.text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {expired ? (
          <Link
            href="/assinar"
            className="flex items-center justify-center rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover"
          >
            Gerar um novo PIX
          </Link>
        ) : (
          <Link
            href="/assinar"
            className="flex items-center justify-center rounded-2xl border border-border px-5 py-3 text-sm text-zinc-400 transition hover:border-zinc-500 hover:text-white"
          >
            Voltar aos planos
          </Link>
        )}

        <p className="px-1 text-center text-[11px] leading-5 text-zinc-600">
          Pagamento instantâneo via PIX. Se o valor não aparecer em alguns
          minutos, fale com o{" "}
          <Link href="/suporte" className="text-zinc-400 underline-offset-2 hover:text-white hover:underline">
            suporte
          </Link>
          .
        </p>
      </aside>
    </div>
  );
}
