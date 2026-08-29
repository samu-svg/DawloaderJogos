import { redirect } from "next/navigation";
import { passwordIsExpired } from "@/lib/password-policy";
import { isBootstrapAdminEmail, type Role } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";

export type AppUser = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  passwordChangedAt: Date;
};

function parsePasswordChangedAt(user: {
  user_metadata?: Record<string, unknown>;
}): Date {
  const raw = user.user_metadata?.password_changed_at;
  if (typeof raw === "string" && raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function appUserFromAuthUser(user: {
  id: string;
  email: string;
  user_metadata?: Record<string, unknown>;
}): AppUser {
  const email = user.email.trim().toLowerCase();
  const displayName =
    (typeof user.user_metadata?.display_name === "string" &&
      user.user_metadata.display_name) ||
    email.split("@")[0];

  return {
    id: user.id,
    email,
    displayName,
    role: isBootstrapAdminEmail(email) ? "admin" : "user",
    passwordChangedAt: parsePasswordChangedAt(user),
  };
}

function syncDisplayName(userId: string, displayName: string) {
  void (async () => {
    const supabase = await createClient();
    await supabase
      .from("profiles")
      .update({ display_name: displayName })
      .eq("id", userId);
  })();
}

export async function upsertUserFromAuth(input: {
  id: string;
  email: string;
  displayName: string;
}): Promise<AppUser> {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim() || email.split("@")[0];
  syncDisplayName(input.id, displayName);

  return {
    id: input.id,
    email,
    displayName,
    role: isBootstrapAdminEmail(email) ? "admin" : "user",
    passwordChangedAt: new Date(),
  };
}

export async function currentAppUser(): Promise<AppUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const appUser = appUserFromAuthUser({
    id: user.id,
    email: user.email,
    user_metadata: user.user_metadata,
  });
  syncDisplayName(appUser.id, appUser.displayName);
  return appUser;
}

export async function requireAppUser(options?: {
  skipPasswordCheck?: boolean;
  loginNext?: string;
}): Promise<AppUser> {
  const user = await currentAppUser();
  if (!user) {
    const next = encodeURIComponent(options?.loginNext ?? "/baixar");
    redirect(`/login?next=${next}`);
  }
  if (!options?.skipPasswordCheck && passwordIsExpired(user.passwordChangedAt)) {
    redirect("/conta?rotacao=1");
  }
  return user;
}

export async function requireRole(...roles: Role[]): Promise<AppUser> {
  const user = await requireAppUser();
  if (!roles.includes(user.role)) redirect("/baixar");
  return user;
}

export async function getApiUser(): Promise<AppUser | null> {
  return currentAppUser();
}
