import type { Metadata } from "next";
import { homeMetaDescription, homeMetaTitle } from "@/lib/seo-copy";
import { publicSiteOrigin } from "@/lib/site-url";

export { homeMetaDescription, homeMetaTitle };

const SITE_NAME = "MontaHD";
const DEFAULT_OG_IMAGE = "/montahd-icon.png";

export function metadataBaseUrl(): URL {
  return new URL(`${publicSiteOrigin()}/`);
}

export function absoluteUrl(path: string): string {
  return new URL(path.startsWith("/") ? path : `/${path}`, metadataBaseUrl()).href;
}

type PageMetaInput = {
  title: string;
  description: string;
  path: string;
  ogImage?: string | null;
  ogType?: "website" | "article";
  keywords?: readonly string[];
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
    ...(input.keywords?.length ? { keywords: [...input.keywords] } : {}),
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
  const title = homeMetaTitle();
  const description = homeMetaDescription();

  return {
    metadataBase: metadataBaseUrl(),
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: SITE_NAME,
      locale: "pt_BR",
      type: "website",
      images: [{ url: DEFAULT_OG_IMAGE, alt: SITE_NAME }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
    },
    ...(verification ? { verification: { google: verification } } : {}),
  };
}
