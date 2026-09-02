import { getPlan, type PlanId, STRIPE_PLANS } from "@/lib/stripe-plans";

const SANDBOX_BASE = "https://api-sandbox.asaas.com/v3";
const PRODUCTION_BASE = "https://api.asaas.com/v3";

export type AsaasPayment = {
  id: string;
  customer: string;
  billingType: string;
  value: number;
  status: string;
  invoiceUrl?: string | null;
  externalReference?: string | null;
};

export type AsaasCustomer = {
  id: string;
  email?: string | null;
};

export type AsaasWebhookEvent = {
  id: string;
  event: string;
  payment?: AsaasPayment;
};

export function asaasApiKey(): string | null {
  return process.env.ASAAS_API_KEY?.trim() || null;
}

export function asaasApiBaseUrl(): string {
  const custom = process.env.ASAAS_API_URL?.trim().replace(/\/$/, "");
  if (custom) return custom;

  const sandbox = process.env.ASAAS_SANDBOX?.trim();
  if (sandbox === "true") return SANDBOX_BASE;
  if (sandbox === "false") return PRODUCTION_BASE;

  const key = asaasApiKey();
  if (key?.startsWith("$aact_")) return SANDBOX_BASE;
  return PRODUCTION_BASE;
}

export function asaasWebhookToken(): string | null {
  return process.env.ASAAS_WEBHOOK_TOKEN?.trim() || null;
}

export function planPixAmount(planId: PlanId): number {
  const plan = getPlan(planId);
  const digits = plan.priceLabel.replace(/[^\d,]/g, "");
  const normalized = digits.replace(",", ".");
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Valor PIX inválido para o plano ${planId}.`);
  }
  return value;
}

export function asaasPixAvailablePlans(): PlanId[] {
  if (!asaasPixEnabled()) return [];
  return STRIPE_PLANS.map((plan) => plan.id);
}

export function asaasPixEnabled(): boolean {
  if (process.env.ASAAS_PIX_ENABLED === "false") return false;
  return Boolean(asaasApiKey());
}

export function parseAsaasExternalReference(
  reference: string | null | undefined,
): { userId: string; planId: PlanId } | null {
  if (!reference?.trim()) return null;

  const [userId, planId] = reference.split(":");
  if (!userId || !planId) return null;
  if (planId !== "1m" && planId !== "2m" && planId !== "3m") return null;

  return { userId, planId };
}

export function buildAsaasExternalReference(userId: string, planId: PlanId): string {
  return `${userId}:${planId}`;
}

async function asaasRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const key = asaasApiKey();
  if (!key) {
    throw new Error("ASAAS_API_KEY não está definida.");
  }

  const headers = new Headers(init.headers);
  headers.set("access_token", key);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${asaasApiBaseUrl()}${path}`, {
    ...init,
    headers,
  });

  const text = await response.text();
  let data: unknown = {};
  if (text.trim()) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "errors" in data &&
      Array.isArray((data as { errors?: Array<{ description?: string }> }).errors)
        ? (data as { errors: Array<{ description?: string }> }).errors
            .map((item) => item.description)
            .filter(Boolean)
            .join("; ")
        : undefined;

    throw new Error(message || `Asaas API error (${response.status}).`);
  }

  return data as T;
}

export async function findAsaasCustomerByEmail(
  email: string,
): Promise<AsaasCustomer | null> {
  const query = new URLSearchParams({ email });
  const result = await asaasRequest<{ data?: AsaasCustomer[] }>(
    `/customers?${query.toString()}`,
  );
  return result.data?.[0] ?? null;
}

export async function createAsaasCustomer(input: {
  name: string;
  email: string;
}): Promise<AsaasCustomer> {
  return asaasRequest<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      notificationDisabled: true,
    }),
  });
}

export async function ensureAsaasCustomer(input: {
  name: string;
  email: string;
}): Promise<AsaasCustomer> {
  const existing = await findAsaasCustomerByEmail(input.email);
  if (existing) return existing;
  return createAsaasCustomer(input);
}

export async function createAsaasPixPayment(input: {
  customerId: string;
  value: number;
  dueDate: string;
  externalReference: string;
  description: string;
}): Promise<AsaasPayment> {
  return asaasRequest<AsaasPayment>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: input.customerId,
      billingType: "PIX",
      value: input.value,
      dueDate: input.dueDate,
      externalReference: input.externalReference,
      description: input.description,
    }),
  });
}

export function asaasDueDateToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
