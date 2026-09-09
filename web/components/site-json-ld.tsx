type SiteJsonLdProps = {
  data: Record<string, unknown>;
};

/** JSON-LD para rich results (Schema.org). */
export function SiteJsonLd({ data }: SiteJsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
