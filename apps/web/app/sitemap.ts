import type { MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/env";
import { dbGetUsers } from "@/lib/db/users";
import { isValidHandle } from "@/lib/validation";

const BASE_URL = getBaseUrl();

const ARCHETYPES = [
  "builder",
  "guardian",
  "marathoner",
  "polymath",
  "artificer",
  "balanced",
  "emerging",
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const users = await dbGetUsers();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/about/scoring`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/about/verification`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/about/leaderboard`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  const archetypePages: MetadataRoute.Sitemap = ARCHETYPES.map(
    (archetype) => ({
      url: `${BASE_URL}/archetypes/${archetype}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }),
  );

  // LE-8-4 — advertise only pages a crawler can actually open for a person
  // who actually signed up. The share page rejects a handle that fails
  // isValidHandle (an EMU login with an underscore), and a users row without
  // an email was registered by a render path, not by the OAuth callback that
  // is the only writer of email (#1239): a stranger whose badge someone
  // viewed, not a signup.
  const userPages: MetadataRoute.Sitemap = users
    .filter((user) => user.hasEmail && isValidHandle(user.handle))
    .map((user) => ({
    url: `${BASE_URL}/u/${user.handle}`,
    lastModified: new Date(user.registeredAt),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...archetypePages, ...userPages];
}
