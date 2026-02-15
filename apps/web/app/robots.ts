import type { MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/env";

const BASE_URL = getBaseUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/u/*/badge.svg"],
        disallow: ["/api/", "/admin/", "/experiments/", "/generating/", "/cli/"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
