export type CampaignType = "announcement" | "engagement";

export type CampaignCreatePayload = {
  type: CampaignType;
  name: string;
  subject: string;
  previewText: string | null;
  headline: string;
  bodyText: string;
  features: { text: string }[];
  ctaText: string;
  ctaUrl: string;
};

export type CampaignPatchPayload = Partial<Omit<CampaignCreatePayload, "type">>;

function payloadError(message: string): Error {
  return new Error(message);
}

function isValidCtaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function readRequiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw payloadError(`Invalid ${field}: must be a non-empty string`);
  }

  return value;
}

function readNullableString(value: unknown, field: string): string | null {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw payloadError(`Invalid ${field}: must be a string or null`);
  }

  return value;
}

function readCampaignFeatures(value: unknown): { text: string }[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw payloadError("Invalid features: must be an array");
  }

  return value.map((item, index) => {
    if (item == null || typeof item !== "object" || Array.isArray(item)) {
      throw payloadError(`Invalid features[${index}]: must be an object`);
    }

    const text = (item as Record<string, unknown>).text;
    if (typeof text !== "string" || text.trim().length === 0) {
      throw payloadError(
        `Invalid features[${index}].text: must be a non-empty string`,
      );
    }

    return { text };
  });
}

function readCampaignType(value: unknown): CampaignType {
  const type = value ?? "announcement";
  if (type !== "announcement" && type !== "engagement") {
    throw payloadError(`Invalid type: ${String(type)}`);
  }

  return type;
}

function readCtaUrl(value: unknown): string {
  const url = readRequiredString(value, "ctaUrl");
  if (!isValidCtaUrl(url)) {
    throw payloadError("Invalid ctaUrl: must be an http or https URL");
  }

  return url;
}

export function parseCampaignCreatePayload(
  body: Record<string, unknown>,
): CampaignCreatePayload {
  return {
    type: readCampaignType(body.type),
    name: readRequiredString(body.name, "name"),
    subject: readRequiredString(body.subject, "subject"),
    previewText: readNullableString(body.previewText, "previewText"),
    headline: readRequiredString(body.headline, "headline"),
    bodyText: readRequiredString(body.bodyText, "bodyText"),
    features: readCampaignFeatures(body.features),
    ctaText: readRequiredString(body.ctaText, "ctaText"),
    ctaUrl: readCtaUrl(body.ctaUrl),
  };
}

export function parseCampaignPatchPayload(
  body: Record<string, unknown>,
): CampaignPatchPayload {
  const updates: CampaignPatchPayload = {};

  if ("name" in body) updates.name = readRequiredString(body.name, "name");
  if ("subject" in body) {
    updates.subject = readRequiredString(body.subject, "subject");
  }
  if ("previewText" in body) {
    updates.previewText = readNullableString(body.previewText, "previewText");
  }
  if ("headline" in body) {
    updates.headline = readRequiredString(body.headline, "headline");
  }
  if ("bodyText" in body) {
    updates.bodyText = readRequiredString(body.bodyText, "bodyText");
  }
  if ("features" in body) {
    updates.features = readCampaignFeatures(body.features);
  }
  if ("ctaText" in body) {
    updates.ctaText = readRequiredString(body.ctaText, "ctaText");
  }
  if ("ctaUrl" in body) {
    updates.ctaUrl = readCtaUrl(body.ctaUrl);
  }

  return updates;
}
