import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import {
  desktopBuildPublicPath,
  getDesktopBuild,
  resolveDesktopBuildId,
} from "@/lib/desktop-download";
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

  const build = getDesktopBuild(buildId);
  const relativePath = desktopBuildPublicPath(build).replace(/^\//, "");
  const filePath = path.join(process.cwd(), "public", relativePath);

  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    return NextResponse.json(
      { error: "Instalador não encontrado no servidor." },
      { status: 404 },
    );
  }

  if (!fileStat.isFile()) {
    return NextResponse.json({ error: "Instalador inválido." }, { status: 400 });
  }

  const stream = createReadStream(filePath);
  return new NextResponse(stream as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${build.fileName}"`,
      "Content-Length": String(fileStat.size),
      "Cache-Control": "private, no-store",
    },
  });
}
