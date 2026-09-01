import { redirect } from "next/navigation";
import { passwordIsExpired } from "@/lib/password-policy";
import { parseRole, type Role } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";

export type AppUser = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  passwordChangedAt: Date;
};

function parseTimestamp(raw: string | null | undefined): Date | null {
  if (typeof raw !== "string" || !raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export async function upsertUserFromAuth(input: {
  id: string;
  email: string;
  displayName: string;
}): Promise<AppUser> {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim() || email.split("@")[0];
  return {
    id: input.id,
    email,
    displayName,
    role: "user",
    passwordChangedAt: new Date(),
  };
}

export async function currentAppUser(): Promise<AppUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const email = user.email.trim().toLowerCase();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role, password_changed_at")
    .eq("id", user.id)
    .maybeSingle();

  const displayName =
    (typeof profile?.display_name === "string" && profile.display_name) ||
    (typeof user.user_metadata?.display_name === "string" &&
      user.user_metadata.display_name) ||
    email.split("@")[0];

  const role = parseRole(profile?.role);

  const passwordChangedAt =
    parseTimestamp(profile?.password_changed_at) ?? new Date(0);

  return {
    id: user.id,
    email,
    displayName,
    role,
    passwordChangedAt,
  };
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
