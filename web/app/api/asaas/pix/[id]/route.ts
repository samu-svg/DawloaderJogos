import { NextResponse } from "next/server";
import { loadOwnedPixCheckout } from "@/lib/asaas-pix";
import { getApiUser } from "@/lib/auth";
import { logError } from "@/lib/logger";
import { passwordIsExpired } from "@/lib/password-policy";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const limited = await enforceRateLimit(
    request,
    "asaas-pix-status",
    RATE_LIMITS.medium,
  );
  if (limited) return limited;

  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login para pagar." }, { status: 401 });
  }

  const userLimited = await enforceRateLimit(
    request,
    "asaas-pix-status",
    RATE_LIMITS.medium,
    user.id,
  );
  if (userLimited) return userLimited;

  if (passwordIsExpired(user.passwordChangedAt)) {
    return NextResponse.json(
      { error: "Senha expirada. Atualize em /conta.", code: "PASSWORD_EXPIRED" },
      { status: 403 },
    );
  }

  const { id } = await context.params;

  try {
    const view = await loadOwnedPixCheckout(user.id, id);
    if (!view) {
      return NextResponse.json(
        { error: "Pagamento não encontrado." },
        { status: 404 },
      );
    }
    return NextResponse.json(view);
  } catch (error) {
    logError("Asaas PIX status failed", error, { paymentId: id, userId: user.id });
    return NextResponse.json(
      { error: "Não foi possível consultar o pagamento PIX." },
      { status: 502 },
    );
  }
}
