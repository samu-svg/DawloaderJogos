import { NextResponse } from "next/server";
import {
  createManifestAccessToken,
  userHasCatalogAccess,
} from "@/lib/subscription";
import { subscriptionsEnabled } from "@/lib/stripe";
import { currentUser } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login." }, { status: 401 });
  }

  if (!(await userHasCatalogAccess(user))) {
    return NextResponse.json(
      { error: "Assinatura ativa necessária." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as {
    slug?: string;
    entryIds?: string[];
  };

  const slug = body.slug?.trim();
  if (!slug) {
    return NextResponse.json({ error: "Informe o slug do catálogo." }, { status: 400 });
  }

  const entryIds = Array.isArray(body.entryIds)
    ? body.entryIds.filter((id) => typeof id === "string" && id.trim())
    : undefined;

  if (!subscriptionsEnabled()) {
    return NextResponse.json({ token: null });
  }

  const token = createManifestAccessToken({
    userId: user.id,
    slug,
    entryIds,
  });

  if (!token) {
    return NextResponse.json(
      { error: "Token de manifesto não configurado no servidor." },
      { status: 503 },
    );
  }

  return NextResponse.json({ token });
}
