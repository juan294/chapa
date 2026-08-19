import { describe, expect, it } from "vitest";
import { en } from "./dictionaries/en";
import { es } from "./dictionaries/es";

interface PrivacyDictionary {
  legal: {
    privacy: {
      sections: Array<{ heading: string; body: string }>;
    };
  };
}

function privacyCopy(dictionary: unknown): string {
  const privacy = (dictionary as PrivacyDictionary).legal.privacy;
  return privacy.sections
    .map(({ heading, body }) => `${heading} ${body}`)
    .join(" ");
}

describe("privacy policy copy", () => {
  it("discloses every linkable platform and durable storage in English", () => {
    const copy = privacyCopy(en);

    expect(copy).toContain("Bitbucket, Codeberg, or GitLab");
    expect(copy).toContain("Supabase stores durable account records");
    expect(copy).toContain("historical Developer Impact snapshots");
    expect(copy).toContain("not deleted when a Redis cache entry expires");
    expect(copy).toContain("PostHog and Vercel Analytics");
    expect(copy).toContain("request deletion of your Chapa account data");
    expect(copy).not.toContain("24-hour TTL");
    expect(copy).not.toContain("No personal information is sent");
  });

  it("discloses every linkable platform and durable storage in Spanish", () => {
    const copy = privacyCopy(es);

    expect(copy).toContain("Bitbucket, Codeberg o GitLab");
    expect(copy).toContain("Supabase almacena registros duraderos de cuenta");
    expect(copy).toContain("instantáneas históricas del Impacto de Desarrollador");
    expect(copy).toContain("no se eliminan cuando expira una entrada de caché de Redis");
    expect(copy).toContain("PostHog y Vercel Analytics");
    expect(copy).toContain("solicitar la eliminación de los datos de tu cuenta de Chapa");
    expect(copy).not.toContain("TTL de 24 horas");
    expect(copy).not.toContain("No se envía información personal");
  });
});
