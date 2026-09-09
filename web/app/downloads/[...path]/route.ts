import { NextResponse } from "next/server";
import {
  readUpdateManifest,
  resolveInstallerSignedUrl,
} from "@/lib/desktop-installers";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

/** Auto-update (latest.yml) e .exe redirecionam para o R2 — sem servir binários na Vercel. */
export async function GET(_request: Request, context: RouteContext) {
  const segments = (await context.params).path;
  if (segments.length === 0) {
    return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  }

  const relativePath = segments.join("/");

  if (relativePath.endsWith(".yml")) {
    const body = await readUpdateManifest(relativePath);
    if (!body) {
      return NextResponse.json({ error: "Manifesto não encontrado." }, { status: 404 });
    }
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/yaml; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  if (relativePath.endsWith(".exe")) {
    const fileName = segments[segments.length - 1] ?? "";
    const signedUrl = await resolveInstallerSignedUrl(fileName);
    if (!signedUrl) {
      return NextResponse.json(
        { error: "Instalador não disponível no momento." },
        { status: 404 },
      );
    }
    return NextResponse.redirect(signedUrl, { status: 302 });
  }

  return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
}
