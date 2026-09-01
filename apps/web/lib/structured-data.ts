export function softwareApplicationJsonLd(baseUrl: string): object {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Chapa",
    url: baseUrl,
    description:
      "Developer impact badge tool that analyzes 12 months of development activity across multiple dimensions — Delivery, Quality, Consistency, Breadth, and optional Craft — to generate a live, embeddable SVG badge with archetype classification and impact scoring.",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    keywords:
      "developer metrics, developer impact score, GitHub profile badge, Bitbucket badge, Codeberg badge, GitLab badge, developer stats SVG, code review metrics, developer archetype, contribution analytics, open source metrics, multi-platform developer badge",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "Multi-dimension impact scoring (Delivery, Quality, Consistency, Breadth, optional Craft)",
      "Developer archetype classification (Builder, Quality Champion, Marathoner, Polymath, Artificer, Balanced, Emerging)",
      "Live embeddable SVG badge for READMEs and portfolios",
      "Activity timeline visualization",
      "Dynamic radar chart (pentagon or diamond)",
      "Badge visual customization via Creator Studio",
      "Cryptographic badge verification (HMAC-SHA256)",
      "Score history and trend tracking",
    ],
    potentialAction: [
      {
        "@type": "ViewAction",
        name: "View a developer's impact profile",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${baseUrl}/u/{handle}`,
        },
      },
      {
        "@type": "ViewAction",
        name: "View a developer's embeddable impact badge (SVG)",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${baseUrl}/u/{handle}/badge.svg`,
        },
      },
    ],
  };
}
