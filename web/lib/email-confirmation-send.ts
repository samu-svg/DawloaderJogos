import { authCallbackUrl } from "./email-confirmation.ts";
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

export async function sendSignupConfirmationOtp(input: {
  email: string;
  password: string;
  displayName: string;
  origin: string;
}): Promise<{
  alreadyRegistered: boolean;
  errorMessage?: string;
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
    if (!already) logError("generateLink signup falhou", error);
    return { alreadyRegistered: already, errorMessage: error.message };
  }

  await sendGeneratedConfirmation(input.email, data);
  return { alreadyRegistered: false };
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
