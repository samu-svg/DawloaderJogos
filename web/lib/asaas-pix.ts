import {
  getAsaasPayment,
  getAsaasPixQrCode,
  parseAsaasExternalReference,
  paymentValueMatchesPlan,
  type AsaasPayment,
} from "@/lib/asaas";
import {
  asaasPaymentIsPaid,
  isAsaasPaymentId,
  toQrView,
  buildPixCheckoutView,
  type PixCheckoutView,
  type PixQrView,
} from "@/lib/asaas-pix-format";
import { logWarn } from "@/lib/logger";
import { asaasCustomerRef, grantPrepaidAccess } from "@/lib/prepaid-access";
import { getPlan } from "@/lib/stripe-plans";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function loadOwnedPixCheckout(
  userId: string,
  paymentId: string,
): Promise<PixCheckoutView | null> {
  if (!isAsaasPaymentId(paymentId)) return null;

  let payment: AsaasPayment | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      payment = await getAsaasPayment(paymentId);
      break;
    } catch {
      if (attempt < 2) await sleep(300 * (attempt + 1));
    }
  }
  if (!payment) return null;

  const parsed = parseAsaasExternalReference(payment.externalReference);
  if (!parsed || parsed.userId !== userId) return null;

  const plan = getPlan(parsed.planId);
  const paid = asaasPaymentIsPaid(payment.status);

  // Conciliação: rede de segurança para quando o webhook falha ou atrasa.
  // Inofensiva ao reabrir um checkout antigo, porque o razão é idempotente
  // por pagamento — reabrir a página não credita mês nenhum de novo.
  if (paid) {
    if (paymentValueMatchesPlan(payment.value, parsed.planId)) {
      await grantPrepaidAccess({
        userId,
        provider: "asaas",
        paymentId: payment.id,
        planId: parsed.planId,
        amountCents: plan.priceCents,
        customerRef: asaasCustomerRef(payment.customer),
      });
    } else {
      logWarn("Asaas: conciliação ignorada por valor divergente", {
        paymentId: payment.id,
        planId: parsed.planId,
        paidValue: payment.value,
        expectedCents: plan.priceCents,
      });
    }
  }

  let qr: PixQrView | null = null;
  if (!paid) {
    try {
      qr = toQrView(await getAsaasPixQrCode(payment.id));
    } catch {
      qr = null;
    }
  }

  return buildPixCheckoutView({
    payment,
    planId: parsed.planId,
    planTitle: plan.title,
    priceLabel: plan.priceLabel,
    qr,
  });
}
