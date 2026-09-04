import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  PASSWORD_RECOVERY_COOKIE,
  PASSWORD_RECOVERY_PATH,
  isPasswordRecoveryPath,
} from "@/lib/password-recovery";

const protectedRoutes = ["/baixar", "/assinar", "/conta", "/painel", "/suporte"];

function redirectWithCookies(url: URL, source: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(url);
  for (const cookie of source.cookies.getAll()) {
    redirect.cookies.set(cookie.name, cookie.value, cookie);
  }
  return redirect;
}

/**
 * Supabase access tokens are short lived. Refreshing them here means Server
 * Components always see a valid session without having to write cookies
 * themselves, which they cannot do.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const recovering = request.cookies.get(PASSWORD_RECOVERY_COOKIE)?.value === "1";
  if (recovering && user && !isPasswordRecoveryPath(path)) {
    const resetUrl = new URL(PASSWORD_RECOVERY_PATH, request.url);
    return redirectWithCookies(resetUrl, response);
  }

  const needsAuth = protectedRoutes.some((route) => path.startsWith(route));

  if (needsAuth && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set(
      "next",
      `${path}${request.nextUrl.search}`,
    );
    return redirectWithCookies(loginUrl, response);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|exe|woff|woff2)$).*)",
  ],
};
