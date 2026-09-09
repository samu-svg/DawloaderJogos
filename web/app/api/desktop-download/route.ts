import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { resolveInstallerSignedUrl } from "@/lib/desktop-installers";
import { getDesktopBuild, resolveDesktopBuildId } from "@/lib/desktop-download";
import { isR2Configured } from "@/lib/r2-configured";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const limited = await enforceRateLimit(request, "desktop-download", RATE_LIMITS.tight);
  if (limited) return limited;

  const user = await getApiUser();
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", "/app");
    return NextResponse.redirect(loginUrl, { status: 302 });
  }

  const userLimited = await enforceRateLimit(
    request,
    "desktop-download",
    RATE_LIMITS.tight,
    user.id,
  );
  if (userLimited) return userLimited;

  const buildId = resolveDesktopBuildId(
    new URL(request.url).searchParams.get("build"),
  );
  if (!buildId) {
    return NextResponse.json({ error: "Instalador inválido." }, { status: 400 });
  }

  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "Armazenamento de instaladores não configurado no servidor." },
      { status: 503 },
    );
  }

  const build = getDesktopBuild(buildId);
  const signedUrl = await resolveInstallerSignedUrl(build.fileName);
  if (!signedUrl) {
    return NextResponse.json(
      { error: "Instalador não encontrado no servidor." },
      { status: 404 },
    );
  }

  return NextResponse.redirect(signedUrl, { status: 302 });
}
