import {
  getAsaasPayment,
  getAsaasPixQrCode,
  parseAsaasExternalReference,
  paymentValueMatchesPlan,
  type AsaasPayment,
} from "@/lib/asaas";
import {
  asaasPaymentIsExpired,
  asaasPaymentIsPaid,
  isAsaasPaymentId,
  qrCodeIsExpired,
  type PixCheckoutView,
  type PixQrView,
} from "@/lib/asaas-pix-format";
import { logWarn } from "@/lib/logger";
import { asaasCustomerRef, grantPrepaidAccess } from "@/lib/prepaid-access";
import { getPlan } from "@/lib/stripe-plans";

function toQrView(paymentQr: {
  encodedImage?: string | null;
  payload?: string | null;
  expirationDate?: string | null;
}): PixQrView | null {
  const encodedImage = paymentQr.encodedImage?.trim();
  const payload = paymentQr.payload?.trim();
  if (!encodedImage || !payload) return null;
  return {
    encodedImage,
    payload,
    expirationDate: paymentQr.expirationDate?.trim() || null,
  };
}

export async function loadOwnedPixCheckout(
  userId: string,
  paymentId: string,
): Promise<PixCheckoutView | null> {
  if (!isAsaasPaymentId(paymentId)) return null;

  let payment: AsaasPayment;
  try {
    payment = await getAsaasPayment(paymentId);
  } catch {
    return null;
  }

  const parsed = parseAsaasExternalReference(payment.externalReference);
  if (!parsed || parsed.userId !== userId) return null;

  const plan = getPlan(parsed.planId);
  const paid = asaasPaymentIsPaid(payment.status);
  let expired = asaasPaymentIsExpired(payment.status);

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
      if (qr && qrCodeIsExpired(qr.expirationDate)) expired = true;
    } catch {
      qr = null;
    }
  }

  return {
    paymentId: payment.id,
    status: payment.status,
    paid,
    expired,
    planId: parsed.planId,
    planTitle: plan.title,
    priceLabel: plan.priceLabel,
    value: payment.value,
    qr,
  };
}
