import { NextResponse } from "next/server";
import { recordAudit, requestIp } from "@/lib/audit";
import {
  asaasDueDateToday,
  asaasPixEnabled,
  buildAsaasExternalReference,
  createAsaasPixPayment,
  ensureAsaasCustomer,
  planPixAmount,
  waitForAsaasPixQrCode,
} from "@/lib/asaas";
import { pixCheckoutPath } from "@/lib/asaas-pix-format";
import { getApiUser } from "@/lib/auth";
import { logError } from "@/lib/logger";
import { passwordIsExpired } from "@/lib/password-policy";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { digitsOnly, isValidCpfCnpj } from "@/lib/cpf-cnpj";
import { getPlan, isPlanId } from "@/lib/stripe-plans";

type CheckoutBody = {
  plan?: string;
  cpfCnpj?: string;
};

function asaasUserError(error: unknown): string | null {
  const message = error instanceof Error ? error.message : "";
  if (/cpf|cnpj/i.test(message)) {
    return "Informe um CPF ou CNPJ válido para pagar com PIX.";
  }
  return null;
}

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "asaas-checkout", RATE_LIMITS.tight);
  if (limited) return limited;

  if (!asaasPixEnabled()) {
    return NextResponse.json(
      { error: "Pagamento via PIX não está disponível no momento." },
      { status: 503 },
    );
  }

  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login para pagar." }, { status: 401 });
  }

  const userLimited = await enforceRateLimit(
    request,
    "asaas-checkout",
    RATE_LIMITS.tight,
    user.id,
  );
  if (userLimited) return userLimited;

  if (passwordIsExpired(user.passwordChangedAt)) {
    return NextResponse.json(
      { error: "Senha expirada. Atualize em /conta.", code: "PASSWORD_EXPIRED" },
      { status: 403 },
    );
  }

  let body: CheckoutBody = {};
  try {
    body = (await request.json()) as CheckoutBody;
  } catch {
    body = {};
  }

  const planId = body.plan?.trim() || "1m";
  if (!isPlanId(planId)) {
    return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
  }

  const plan = getPlan(planId);
  const cpfCnpj = digitsOnly(body.cpfCnpj ?? "");
  if (!isValidCpfCnpj(cpfCnpj)) {
    return NextResponse.json(
      { error: "Informe um CPF ou CNPJ válido para pagar com PIX." },
      { status: 400 },
    );
  }

  try {
    const customer = await ensureAsaasCustomer({
      name: user.email.split("@")[0] || "Cliente MontaHD",
      email: user.email,
      cpfCnpj,
    });

    const payment = await createAsaasPixPayment({
      customerId: customer.id,
      value: planPixAmount(planId),
      dueDate: asaasDueDateToday(),
      externalReference: buildAsaasExternalReference(user.id, planId),
      description: `MontaHD — ${plan.title}`,
    });

    const qr = await waitForAsaasPixQrCode(payment.id);
    if (!qr.encodedImage?.trim() || !qr.payload?.trim()) {
      return NextResponse.json(
        { error: "Não foi possível gerar o QR Code PIX." },
        { status: 502 },
      );
    }

    await recordAudit({
      actorId: user.id,
      action: "asaas.checkout",
      entity: "subscription",
      entityId: payment.id,
      ip: requestIp(request),
      metadata: { plan: planId, method: "pix" },
    });

    return NextResponse.json({ url: pixCheckoutPath(payment.id) });
  } catch (error) {
    logError("Asaas checkout failed", error, { plan: planId, userId: user.id });
    return NextResponse.json(
      {
        error:
          asaasUserError(error) ??
          "Não foi possível iniciar o pagamento PIX. Tente outro plano ou forma de pagamento, ou tente de novo em instantes.",
      },
      { status: 502 },
    );
  }
}
