import { isGtaVGame } from "./gta-v.ts";

type VipAudio = "dublado" | "pt-br" | "ingles" | "desconhecido";

export type VipGameRef = {
  id: string;
  label: string;
  displayTitle?: string;
  audio?: VipAudio | null;
};

export const VIP_REQUIRED_MESSAGE =
  "Este jogo é VIP. Assine o Completo para baixar.";

export function isVipGame(ref: VipGameRef): boolean {
  if (isGtaVGame(ref)) return true;
  if (ref.audio === "dublado") return true;

  for (const text of [ref.label, ref.displayTitle]) {
    if (!text) continue;
    if (text.toLowerCase().includes("dublado")) return true;
  }

  return false;
}
