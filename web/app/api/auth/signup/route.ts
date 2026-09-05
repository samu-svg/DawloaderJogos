import { NextResponse } from "next/server";
import { authErrorMessage } from "@/lib/auth-messages";
import { authCallbackUrl } from "@/lib/email-confirmation";
import {
  resendConfirmationOtp,
  resolveExistingSignupEmail,
  sendSignupConfirmationOtp,
} from "@/lib/email-confirmation-send";
import { logError } from "@/lib/logger";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-policy";
import { isWellFormedEmail } from "@/lib/password-recovery";
import { authMailConfigured } from "@/lib/password-recovery-mail";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { publicSiteOrigin } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { isTrustedAuthOrigin } from "@/lib/trusted-origin";

function alreadyRegisteredResponse() {
  return NextResponse.json(
    {
      error: authErrorMessage("User already registered"),
      code: "already_registered",
    },
    { status: 400 },
  );
}

async function resendPendingConfirmation(
  request: Request,
  email: string,
  origin: string,
) {
  const limited = await enforceRateLimit(
    request,
    "auth-resend-confirmation",
    RATE_LIMITS.authMail,
  );
  if (limited) return limited;

  const emailLimited = await enforceRateLimit(
    request,
    "auth-resend-confirmation",
    RATE_LIMITS.authMailSlow,
    email,
  );
  if (emailLimited) return emailLimited;

  if (authMailConfigured()) {
    await resendConfirmationOtp({ email, origin });
  } else {
    const supabase = await createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: authCallbackUrl(origin, "confirm") },
    });
    if (error) logError("Falha ao reenviar confirmação no cadastro", error);
  }

  return NextResponse.json({
    ok: true,
    needsConfirmation: true,
    emailSent: true,
  });
}

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "auth-signup", RATE_LIMITS.auth);
  if (limited) return limited;

  if (!isTrustedAuthOrigin(request)) {
    return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  }

  let body: { email?: string; password?: string; displayName?: string };
  try {
    body = (await request.json()) as {
      email?: string;
      password?: string;
      displayName?: string;
    };
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  const displayName = body.displayName?.trim().slice(0, 80) ?? "";

  if (!email || !password || !displayName) {
    return NextResponse.json({ error: "Informe nome, e-mail e senha." }, { status: 400 });
  }
  if (!isWellFormedEmail(email)) {
    return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return NextResponse.json(
      { error: `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.` },
      { status: 400 },
    );
  }

  const emailLimited = await enforceRateLimit(
    request,
    "auth-signup",
    RATE_LIMITS.authSlow,
    email,
  );
  if (emailLimited) return emailLimited;

  const origin = publicSiteOrigin(request);

  if (authMailConfigured()) {
    const result = await sendSignupConfirmationOtp({
      email,
      password,
      displayName,
      origin,
    });
    if (result.unconfirmedExisting) {
      return resendPendingConfirmation(request, email, origin);
    }
    if (result.alreadyRegistered) {
      return alreadyRegisteredResponse();
    }
    if (result.errorMessage && result.errorMessage !== "mail-disabled" && result.errorMessage !== "no-service-role") {
      return NextResponse.json(
        { error: authErrorMessage(result.errorMessage) },
        { status: 400 },
      );
    }
    if (!result.errorMessage) {
      return NextResponse.json({
        ok: true,
        needsConfirmation: true,
        emailSent: result.emailSent !== false,
      });
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: authCallbackUrl(origin, "confirm"),
    },
  });

  if (error) {
    return NextResponse.json(
      { error: authErrorMessage(error.message) },
      { status: 400 },
    );
  }

  const identities = data.user?.identities;
  if (Array.isArray(identities) && identities.length === 0) {
    const decision = await resolveExistingSignupEmail(email, origin);
    if (decision === "resend") {
      return resendPendingConfirmation(request, email, origin);
    }
    return alreadyRegisteredResponse();
  }

  const session = Boolean(data.session);
  return NextResponse.json({
    ok: true,
    session,
    needsConfirmation: !session,
  });
}
