import { authCallbackUrl } from "./email-confirmation.ts";
import {
  decideExistingSignup,
  findUserInAdminList,
  isAuthEmailConfirmed,
  parseAdminUsersList,
  type ExistingSignupDecision,
} from "./auth-user-status.ts";
import { logError } from "./logger.ts";
import {
  authMailConfigured,
  sendConfirmationMail,
} from "./password-recovery-mail.ts";
import { createServiceRoleClient } from "./supabase/service-role.ts";

type GenerateLinkResult = {
  properties?: {
    email_otp?: string;
    action_link?: string;
  } | null;
};

async function sendGeneratedConfirmation(
  email: string,
  data: GenerateLinkResult | null | undefined,
): Promise<boolean> {
  const otp = data?.properties?.email_otp;
  const actionLink = data?.properties?.action_link;
  if (!otp || !actionLink) {
    logError("generateLink de confirmação veio sem código ou link");
    return false;
  }
  const sent = await sendConfirmationMail({ to: email, otp, actionLink });
  if (!sent.ok) {
    logError("Falha ao enviar e-mail de confirmação via Resend", sent.reason);
    return false;
  }
  return true;
}

export function tryServiceRoleClient() {
  try {
    return createServiceRoleClient();
  } catch (error) {
    logError("Service role indisponível para e-mail de confirmação", error);
    return null;
  }
}

async function findAuthUserByEmail(email: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;

  const endpoint = new URL("/auth/v1/admin/users", url.replace(/\/$/, ""));
  endpoint.searchParams.set("filter", email);
  endpoint.searchParams.set("page", "1");
  endpoint.searchParams.set("per_page", "50");

  try {
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
      },
    });
    if (!response.ok) {
      logError("Falha ao buscar usuário por e-mail", undefined, {
        status: response.status,
      });
      return null;
    }
    const body: unknown = await response.json();
    return findUserInAdminList(parseAdminUsersList(body), email);
  } catch (error) {
    logError("Falha ao buscar usuário por e-mail", error);
    return null;
  }
}

async function inspectExistingSignup(
  email: string,
  origin: string,
): Promise<ExistingSignupDecision> {
  const listed = await findAuthUserByEmail(email);
  const fromList = decideExistingSignup(listed);
  if (fromList !== "unknown") return fromList;

  const admin = tryServiceRoleClient();
  if (!admin) return "unknown";

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: authCallbackUrl(origin, "confirm") },
  });
  if (error) {
    logError("generateLink magiclink para inspecionar cadastro falhou", error);
    return "unknown";
  }
  return decideExistingSignup(data?.user);
}

/** Conta já existente: reenviar se ainda não confirmou; recusar se já confirmou. */
export async function resolveExistingSignupEmail(
  email: string,
  origin: string,
): Promise<ExistingSignupDecision> {
  return inspectExistingSignup(email, origin);
}

export async function sendSignupConfirmationOtp(input: {
  email: string;
  password: string;
  displayName: string;
  origin: string;
}): Promise<{
  alreadyRegistered: boolean;
  unconfirmedExisting?: boolean;
  errorMessage?: string;
  emailSent?: boolean;
}> {
  if (!authMailConfigured()) {
    return { alreadyRegistered: false, errorMessage: "mail-disabled" };
  }
  const admin = tryServiceRoleClient();
  if (!admin) {
    return { alreadyRegistered: false, errorMessage: "no-service-role" };
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email: input.email,
    password: input.password,
    options: {
      data: { display_name: input.displayName },
      redirectTo: authCallbackUrl(input.origin, "confirm"),
    },
  });

  if (error) {
    const already = /already/i.test(error.message);
    if (!already) {
      logError("generateLink signup falhou", error);
      return { alreadyRegistered: false, errorMessage: error.message };
    }
    const decision = await inspectExistingSignup(input.email, input.origin);
    if (decision === "resend") {
      return { alreadyRegistered: false, unconfirmedExisting: true };
    }
    return { alreadyRegistered: true, errorMessage: error.message };
  }

  if (isAuthEmailConfirmed(data?.user)) {
    return { alreadyRegistered: true };
  }

  const emailSent = await sendGeneratedConfirmation(input.email, data);
  return { alreadyRegistered: false, emailSent };
}

export async function resendConfirmationOtp(input: {
  email: string;
  origin: string;
}): Promise<void> {
  if (!authMailConfigured()) return;
  const admin = tryServiceRoleClient();
  if (!admin) return;

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: input.email,
    options: { redirectTo: authCallbackUrl(input.origin, "confirm") },
  });
  if (error) {
    logError("generateLink de reenvio de confirmação falhou", error);
    return;
  }
  await sendGeneratedConfirmation(input.email, data);
}
