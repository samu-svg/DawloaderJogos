import type { AcervoGame } from "@/lib/games";
import {
  ABADAVATAR_PACK,
  specialInstallSlug,
} from "@/lib/special-downloads";

/** Utilitários exibidos como jogos no catálogo (dados estáticos, fora do Supabase). */
export function specialCatalogGames(mainCollectionSlug: string): AcervoGame[] {
  const pack = ABADAVATAR_PACK;
  const title = `${pack.title} — ${pack.subtitle}`;

  return [
    {
      id: pack.entryId,
      slug: pack.slug,
      label: title,
      coverUrl: "/covers/abadavatar.jpg",
      sizeBytes: pack.sizeBytes,
      totalBytes: pack.sizeBytes,
      extraCount: 0,
      extras: [],
      entryIds: [pack.entryId],
      destination: pack.downloadFileName,
      collectionSlug: mainCollectionSlug,
      installCollectionSlug: specialInstallSlug(pack.slug),
      collectionTitle: "Utilitários",
      platform: "Utilitário",
      updatedAt: new Date().toISOString(),
      pinned: true,
      isUtility: true,
    },
  ];
}
