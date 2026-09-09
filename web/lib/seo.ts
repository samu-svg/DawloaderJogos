import type { Metadata } from "next";
import { publicSiteOrigin } from "@/lib/site-url";

const SITE_NAME = "MontaHD";
const DEFAULT_OG_IMAGE = "/montahd-icon.png";

export function metadataBaseUrl(): URL {
  return new URL(`${publicSiteOrigin()}/`);
}

export function absoluteUrl(path: string): string {
  return new URL(path.startsWith("/") ? path : `/${path}`, metadataBaseUrl()).href;
}

export function homeMetaTitle(): string {
  return "MontaHD — Download de jogos Xbox 360 (RGH) | Acervo atualizado";
}

export function homeMetaDescription(): string {
  return "Acervo de jogos Xbox 360 para RGH e JTAG. Lista atualizada, títulos dublados em PT-BR e download pelo app MontaHD — baixa, extrai e instala direto no HD.";
}

type PageMetaInput = {
  title: string;
  description: string;
  path: string;
  ogImage?: string | null;
  ogType?: "website" | "article";
};

export function pageMetadata(input: PageMetaInput): Metadata {
  const url = absoluteUrl(input.path);
  const image = input.ogImage
    ? input.ogImage.startsWith("http")
      ? input.ogImage
      : absoluteUrl(input.ogImage)
    : absoluteUrl(DEFAULT_OG_IMAGE);

  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: url },
    openGraph: {
      title: input.title,
      description: input.description,
      url,
      siteName: SITE_NAME,
      locale: "pt_BR",
      type: input.ogType ?? "website",
      images: [{ url: image, alt: input.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [image],
    },
  };
}

export function rootLayoutMetadata(): Metadata {
  const verification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();

  return {
    metadataBase: metadataBaseUrl(),
    title: {
      default: homeMetaTitle(),
    },
    description: homeMetaDescription(),
    openGraph: {
      siteName: SITE_NAME,
      locale: "pt_BR",
      type: "website",
      images: [{ url: DEFAULT_OG_IMAGE, alt: SITE_NAME }],
    },
    twitter: {
      card: "summary_large_image",
    },
    robots: {
      index: true,
      follow: true,
    },
    ...(verification ? { verification: { google: verification } } : {}),
  };
}
