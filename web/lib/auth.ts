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

export async function upsertUserFromAuth(input: {
  id: string;
  email: string;
  displayName: string;
}): Promise<AppUser> {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim() || email.split("@")[0];
  const supabase = await createClient();
  await supabase.from("profiles").update({ display_name: displayName }).eq("id", input.id);

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

  const displayName =
    (typeof user.user_metadata?.display_name === "string" &&
      user.user_metadata.display_name) ||
    user.email.split("@")[0];

  const appUser = await upsertUserFromAuth({
    id: user.id,
    email: user.email,
    displayName,
  });

  return {
    ...appUser,
    passwordChangedAt: parsePasswordChangedAt(user),
  };
}

export async function requireAppUser(options?: {
  skipPasswordCheck?: boolean;
}): Promise<AppUser> {
  const user = await currentAppUser();
  if (!user) redirect("/login");
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
