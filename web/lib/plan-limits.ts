/** Máximo de HDs ativos por assinatura (padrão: 1). */
export function planMaxHds(): number {
  const parsed = Number(process.env.PLAN_MAX_HDS);
  if (Number.isFinite(parsed) && parsed >= 1) {
    return Math.floor(parsed);
  }
  return 1;
}
