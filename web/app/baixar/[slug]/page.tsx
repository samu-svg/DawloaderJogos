import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ slug: string }>;
};

/** Links antigos /baixar/[slug] redirecionam para o catálogo unificado. */
export default async function BaixarPortfolioRedirectPage({ params }: PageProps) {
  const { slug } = await params;
  redirect(`/baixar?catalog=${slug}`);
}
