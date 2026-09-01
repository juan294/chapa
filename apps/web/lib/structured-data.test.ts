import { describe, expect, it } from "vitest";

import { softwareApplicationJsonLd } from "./structured-data";

describe("softwareApplicationJsonLd", () => {
  it("publishes both handle-based view actions as EntryPoint URL templates", () => {
    const jsonLd = softwareApplicationJsonLd("https://example.com");

    expect(jsonLd["@type"]).toBe("SoftwareApplication");
    expect(jsonLd.potentialAction).toHaveLength(2);
    for (const action of jsonLd.potentialAction) {
      expect(action.target["@type"]).toBe("EntryPoint");
      expect(action.target.urlTemplate).toContain("{handle}");
      expect(action).not.toHaveProperty("target-input");
    }
  });

  it("keeps the complete SoftwareApplication contract stable", () => {
    expect(softwareApplicationJsonLd("https://example.com")).toMatchInlineSnapshot(`
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "applicationCategory": "DeveloperApplication",
        "description": "Developer impact badge tool that analyzes 12 months of development activity across multiple dimensions — Delivery, Quality, Consistency, Breadth, and optional Craft — to generate a live, embeddable SVG badge with archetype classification and impact scoring.",
        "featureList": [
          "Multi-dimension impact scoring (Delivery, Quality, Consistency, Breadth, optional Craft)",
          "Developer archetype classification (Builder, Quality Champion, Marathoner, Polymath, Artificer, Balanced, Emerging)",
          "Live embeddable SVG badge for READMEs and portfolios",
          "Activity timeline visualization",
          "Dynamic radar chart (pentagon or diamond)",
          "Badge visual customization via Creator Studio",
          "Cryptographic badge verification (HMAC-SHA256)",
          "Score history and trend tracking",
        ],
        "keywords": "developer metrics, developer impact score, GitHub profile badge, Bitbucket badge, Codeberg badge, GitLab badge, developer stats SVG, code review metrics, developer archetype, contribution analytics, open source metrics, multi-platform developer badge",
        "name": "Chapa",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
        },
        "operatingSystem": "Web",
        "potentialAction": [
          {
            "@type": "ViewAction",
            "name": "View a developer's impact profile",
            "target": {
              "@type": "EntryPoint",
              "urlTemplate": "https://example.com/u/{handle}",
            },
          },
          {
            "@type": "ViewAction",
            "name": "View a developer's embeddable impact badge (SVG)",
            "target": {
              "@type": "EntryPoint",
              "urlTemplate": "https://example.com/u/{handle}/badge.svg",
            },
          },
        ],
        "url": "https://example.com",
      }
    `);
  });
});
