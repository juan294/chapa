import type { MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/env";
import { dbGetUsers } from "@/lib/db/users";

const BASE_URL = getBaseUrl();

const ARCHETYPES = [
  "builder",
  "guardian",
  "marathoner",
  "polymath",
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

  const userPages: MetadataRoute.Sitemap = users.map((user) => ({
    url: `${BASE_URL}/u/${user.handle}`,
    lastModified: new Date(user.registeredAt),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...archetypePages, ...userPages];
}
