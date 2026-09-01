"use client";

import { useState } from "react";

export function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false);

  async function openPortal() {
    setLoading(true);
    const response = await fetch("/api/stripe/portal", { method: "POST" });
    const data = (await response.json()) as { url?: string };
    if (data.url) window.location.href = data.url;
    else setLoading(false);
  }

  return (
    <button
      type="button"
      onClick={() => void openPortal()}
      disabled={loading}
      className="rounded-xl border border-border px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-600 hover:text-white disabled:opacity-60"
    >
      {loading ? "Abrindo..." : "Ver recibos"}
    </button>
  );
}
