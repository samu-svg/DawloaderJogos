import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthCallbackClient } from "@/components/auth-callback-client";
import {
  authCallbackFailurePath,
  resolveAuthCallbackKind,
} from "@/lib/email-confirmation";
import { logError } from "@/lib/logger";
import {
  PASSWORD_RECOVERY_NONCE_COOKIE,
  PASSWORD_RECOVERY_PATH,
} from "@/lib/password-recovery";
import { lockRecoverySession } from "@/lib/password-recovery-session";
import { safeInternalPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

const EMAIL_OTP_TYPES: readonly EmailOtpType[] = [
  "recovery",
  "signup",
  "invite",
  "magiclink",
  "email",
  "email_change",
];

function parseOtpType(raw: string | undefined): EmailOtpType | null {
  if (!raw) return null;
  return EMAIL_OTP_TYPES.includes(raw as EmailOtpType)
    ? (raw as EmailOtpType)
    : null;
}

export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{
    code?: string;
    token_hash?: string;
    type?: string;
    next?: string;
    error?: string;
    intent?: string;
  }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const nonce = cookieStore.get(PASSWORD_RECOVERY_NONCE_COOKIE)?.value ?? null;
  const otpType = parseOtpType(params.type);
  const kind = resolveAuthCallbackKind({
    type: params.type ?? null,
    intent: params.intent ?? null,
    nonce,
  });

  if (params.error) {
    redirect(authCallbackFailurePath(kind, "erro"));
  }

  const supabase = await createClient();
  let userId: string | null = null;

  if (params.token_hash && otpType) {
    const { data, error } = await supabase.auth.verifyOtp({
      type: otpType,
      token_hash: params.token_hash,
    });
    if (error) {
      logError("Falha ao validar token de e-mail", error);
    } else {
      userId = data.user?.id ?? null;
    }
  } else if (params.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) {
      logError("Falha ao trocar código de autenticação", error);
    } else {
      userId = data.user?.id ?? null;
    }
  }

  if (userId) {
    if (kind === "recovery" || otpType === "recovery") {
      const locked = await lockRecoverySession(userId);
      if (locked.error) {
        logError("Falha ao marcar recuperação de senha", locked.error);
        await supabase.auth.signOut();
        redirect(authCallbackFailurePath("recovery", "erro"));
      }
      redirect(PASSWORD_RECOVERY_PATH);
    }
    redirect(safeInternalPath(params.next, "/baixar"));
  }

  if (params.code || params.token_hash) {
    redirect(authCallbackFailurePath(kind, "expirado"));
  }

  return <AuthCallbackClient />;
}
