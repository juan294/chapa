# Audit product-fix research
Date: 2026-09-05. Source: develop ab6e01a6.

This document records existing behavior for the authorized local implementation. Full audit evidence remains in the local pre-launch report.

Studio loads profile and config together. The DB loader has found/not_found/unavailable/invalid outcomes; page construction collapses non-found results into defaults (apps/web/app/studio/page.tsx:119, apps/web/app/studio/page.tsx:137). Client config is local state. Departure protection depends on dirty presentation status, and a successful save compares revisions before consuming its response body (apps/web/app/studio/StudioClient.tsx:322, apps/web/app/studio/StudioClient.tsx:391). App navigation includes anchors and keyboard router pushes (apps/web/components/NavbarShell.tsx:60, apps/web/components/KeyboardShortcutsListener.tsx:151).

The scoring simulator averages dimensions and applies confidence (apps/web/app/studio/useStudioWebMcpTools.ts:293). Production scoring inserts heatmap-derived recency weighting between these operations (apps/web/lib/impact/v6.ts:375). Existing text tokens distinguish accent fills from text-safe colors (apps/web/styles/globals.css:55, apps/web/styles/globals.css:58).

Supplemental upload publishes Redis and Supabase concurrently, then invalidates derived models after DB success (apps/web/app/api/supplemental/route.ts:102). Redis helpers return booleans, and readers prefer the hot supplemental record (apps/web/lib/cache/redis.ts:79, apps/web/lib/github/client.ts:430). The contract suite uses actual local Supabase with an injectable Redis fake. Its wrapper obtains only local Supabase credentials (scripts/test-contract-local.ts:1).

OAuth stores tokens before session issuance, but detaches user registration (apps/web/app/api/auth/callback/route.ts:150, apps/web/app/api/auth/callback/route.ts:163). User upsert ignores the returned PostgREST error property (apps/web/lib/db/users.ts:119). Public profile maintenance intentionally does not insert identities. CLI token issuance has a ten-day interval; verification checks expiration without enforcing that interval on older grants (apps/web/lib/auth/cli-token.ts:20, apps/web/lib/auth/cli-token.ts:83).

Config snapshots preserve a cacheable outcome, while the simple resolver drops it (apps/web/lib/render/badge-config.ts:44, apps/web/lib/render/badge-config.ts:50). Badge, share and warming producers use the simple resolver and publish shared SVGs (apps/web/app/u/[handle]/badge.svg/route.ts:272, apps/web/app/u/[handle]/page.tsx:299, apps/web/app/api/cron/warm-cache/route.ts:498). Warm reads occur before config resolution.

Sharing icons are decorative and their text omits platform destinations (apps/web/components/BadgeToolbar.tsx:241). Settings retains one Toast through import processing/recalculation/result; Toast's timer depends on duration, while success reloads after 2.5 seconds (apps/web/components/Toast.tsx:103, apps/web/lib/insights/use-insights-import.ts:158, apps/web/app/settings/SettingsClient.tsx:328).

Three GPT-6 Astra research passes independently traced these groups and their existing test patterns. No production or remote mutation was used for research.
