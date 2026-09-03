import {
  paymentValueMatchesCents,
  webhookTokenMatches,
} from "@/lib/asaas-webhook-events";
import { getPlan, type PlanId, STRIPE_PLANS } from "@/lib/stripe-plans";

export {
  asaasEventAction,
  parseAsaasExternalReference,
  type AsaasEventAction,
} from "@/lib/asaas-webhook-events";

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

export type AsaasPixQrCode = {
  encodedImage?: string | null;
  payload?: string | null;
  expirationDate?: string | null;
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
  if (key?.startsWith("$aact_hmlg_")) return SANDBOX_BASE;
  return PRODUCTION_BASE;
}

export function asaasWebhookToken(): string | null {
  return process.env.ASAAS_WEBHOOK_TOKEN?.trim() || null;
}

export function asaasWebhookTokenMatches(received: string | null): boolean {
  return webhookTokenMatches(received, asaasWebhookToken());
}

export function planPixAmount(planId: PlanId): number {
  return getPlan(planId).priceCents / 100;
}

export function paymentValueMatchesPlan(
  value: number | null | undefined,
  planId: PlanId,
): boolean {
  return paymentValueMatchesCents(value, getPlan(planId).priceCents);
}

export function asaasPixAvailablePlans(): PlanId[] {
  if (!asaasPixEnabled()) return [];
  return STRIPE_PLANS.map((plan) => plan.id);
}

export function asaasPixEnabled(): boolean {
  if (process.env.ASAAS_PIX_ENABLED === "false") return false;
  return Boolean(asaasApiKey());
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
  headers.set("User-Agent", "MontaHD/0.6.23 (https://montahd.vercel.app)");
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
  cpfCnpj: string;
}): Promise<AsaasCustomer> {
  return asaasRequest<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      cpfCnpj: input.cpfCnpj,
      notificationDisabled: true,
    }),
  });
}

export async function updateAsaasCustomer(
  customerId: string,
  input: {
    name: string;
    email: string;
    cpfCnpj: string;
  },
): Promise<AsaasCustomer> {
  return asaasRequest<AsaasCustomer>(`/customers/${customerId}`, {
    method: "PUT",
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      cpfCnpj: input.cpfCnpj,
      notificationDisabled: true,
    }),
  });
}

export async function ensureAsaasCustomer(input: {
  name: string;
  email: string;
  cpfCnpj: string;
}): Promise<AsaasCustomer> {
  const existing = await findAsaasCustomerByEmail(input.email);
  if (existing) return updateAsaasCustomer(existing.id, input);
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

export async function getAsaasPayment(paymentId: string): Promise<AsaasPayment> {
  return asaasRequest<AsaasPayment>(`/payments/${paymentId}`);
}

export async function getAsaasPixQrCode(paymentId: string): Promise<AsaasPixQrCode> {
  return asaasRequest<AsaasPixQrCode>(`/payments/${paymentId}/pixQrCode`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForAsaasPixQrCode(
  paymentId: string,
  attempts = 4,
): Promise<AsaasPixQrCode> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const qr = await getAsaasPixQrCode(paymentId);
      if (qr.encodedImage?.trim() && qr.payload?.trim()) return qr;
      lastError = new Error("QR Code PIX ainda não está pronto.");
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts - 1) {
      await sleep(350 * (attempt + 1));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Não foi possível gerar o QR Code PIX.");
}

export function asaasDueDateToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}
