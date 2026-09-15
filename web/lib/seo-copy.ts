/** Palavras-chave alvo para buscas orgânicas (Google, Bing). */
export const SEO_KEYWORDS = [
  "jogos xbox 360",
  "baixar jogos xbox 360",
  "xbox 360",
  "xbox360",
  "jogos xbox360",
  "baixar jogos xbox360",
  "xbox 360 rgh",
  "xbox 360 jtag",
  "download jogos xbox 360",
  "acervo xbox 360",
  "jogos dublados xbox 360",
  "montahd",
] as const;

export function homeMetaTitle(): string {
  return "Baixar Jogos Xbox 360 (RGH/JTAG) — Acervo Atualizado | MontaHD";
}

export function homeMetaDescription(): string {
  return "Baixe jogos Xbox 360 para RGH e JTAG: acervo com lançamentos semanais, títulos dublados em PT-BR e download grátis pelo app MontaHD. Instala direto no HD.";
}

export function gamePageMetaTitle(title: string, platform: string): string {
  return `Baixar ${title} — Jogo Xbox 360 (${platform}) | MontaHD`;
}

export function gamePageMetaDescription(title: string, platform: string): string {
  return `Baixe ${title} para Xbox 360 (${platform}). Download automático, extração e instalação no HD com o app MontaHD — jogos Xbox 360 para RGH e JTAG.`;
}

export type HomeJsonLdGame = {
  slug: string;
  label: string;
};

export function buildHomeJsonLd(input: {
  siteUrl: string;
  logoUrl: string;
  games: HomeJsonLdGame[];
}): Record<string, unknown> {
  const description = homeMetaDescription();
  const orgId = `${input.siteUrl}#organization`;
  const websiteId = `${input.siteUrl}#website`;

  const itemList = input.games.slice(0, 30).map((game, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: game.label,
    url: new URL(`/jogo/${game.slug}`, input.siteUrl).href,
  }));

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": orgId,
        name: "MontaHD",
        url: input.siteUrl,
        logo: input.logoUrl,
        description,
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        name: "MontaHD — Baixar jogos Xbox 360",
        url: input.siteUrl,
        description,
        inLanguage: "pt-BR",
        publisher: { "@id": orgId },
      },
      {
        "@type": "ItemList",
        name: "Jogos Xbox 360 para baixar",
        numberOfItems: input.games.length,
        itemListElement: itemList,
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "Como baixar jogos Xbox 360 no RGH ou JTAG?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Crie uma conta grátis no MontaHD, baixe o app para Windows, escolha o jogo no acervo e clique em Instalar no HD. O app baixa, extrai e coloca o jogo na pasta certa do console.",
            },
          },
          {
            "@type": "Question",
            name: "O MontaHD tem jogos Xbox 360 grátis?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Sim. No plano Grátis você baixa um jogo por vez pelo app MontaHD. O acervo inclui lançamentos semanais e títulos dublados em português.",
            },
          },
          {
            "@type": "Question",
            name: "Funciona em Xbox 360 RGH e JTAG?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Sim. O acervo MontaHD é feito para Xbox 360 modificado (RGH e JTAG). O app instala cada jogo na estrutura de pastas que o console espera.",
            },
          },
        ],
      },
    ],
  };
}
