const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

export function subscriptionIsActive(
  subscription:
    | { status: string; current_period_end?: string | null }
    | null
    | undefined,
): boolean {
  if (!subscription) return false;
  if (!ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) return false;

  if (subscription.current_period_end) {
    const end = new Date(subscription.current_period_end);
    if (end.getTime() <= Date.now()) return false;
  }

  return true;
}
