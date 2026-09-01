import { requireEditablePortfolio } from "@/lib/catalog";
import { getApiUser } from "@/lib/auth";
import { passwordIsExpired } from "@/lib/password-policy";
import { isR2Configured } from "@/lib/r2-configured";
import { canEditPortfolio } from "@/lib/rbac";

export type UploadAuthResult =
  | {
      ok: true;
      userId: string;
      portfolio: { id: string; slug: string; ownerId: string };
    }
  | { ok: false; status: number; error: string };

export async function requirePortfolioUploadAccess(
  portfolioSlug: string,
): Promise<UploadAuthResult> {
  if (!isR2Configured()) {
    return {
      ok: false,
      status: 503,
      error: "Armazenamento R2 não configurado no servidor.",
    };
  }

  const user = await getApiUser();
  if (!user) {
    return { ok: false, status: 401, error: "Faça login." };
  }

  if (passwordIsExpired(user.passwordChangedAt)) {
    return {
      ok: false,
      status: 403,
      error: "Sua senha expirou. Troque em /conta antes de enviar arquivos.",
    };
  }

  if (!canEditPortfolio(user.role)) {
    return {
      ok: false,
      status: 403,
      error: "Portfólio não encontrado ou sem permissão.",
    };
  }

  const portfolio = await requireEditablePortfolio(portfolioSlug, user);
  if (!portfolio) {
    return {
      ok: false,
      status: 403,
      error: "Portfólio não encontrado ou sem permissão.",
    };
  }

  return { ok: true, userId: user.id, portfolio };
}
