import { freeDownloadSpeedLabel } from "./plan-limits.ts";

export const FREE_PLAN_NAME = "Grátis";
export const PAID_PLAN_NAME = "Completo";

export function freePlanSpeedLabel(): string {
  return `até ${freeDownloadSpeedLabel()}`;
}

export function freePlanSummary(): string {
  return `Um jogo por vez, ${freePlanSpeedLabel()}.`;
}

export function paidPlanSummary(): string {
  return "Acervo em lote e velocidade máxima.";
}

export const FREE_PLAN_FEATURES = [
  "Cadastro grátis para baixar o app",
  "Um jogo por vez, direto no HD",
  "Download limitado no app",
] as const;

export const PAID_PLAN_FEATURES = [
  "Vários jogos de uma vez",
  "Velocidade máxima, sem teto",
  "Jogos VIP: dublados e GTA V",
  "Montagem em lote no site Montar meu HD",
] as const;

export const PLAN_SOFTWARE_LINE =
  "Você paga pelo software MontaHD, não pelos arquivos.";

export function siteMetaDescription(): string {
  return `${PLAN_SOFTWARE_LINE} No ${FREE_PLAN_NAME}, um jogo por vez (${freePlanSpeedLabel()}). No ${PAID_PLAN_NAME}, lote e velocidade máxima. Planos de 1, 2 ou 3 meses.`;
}
