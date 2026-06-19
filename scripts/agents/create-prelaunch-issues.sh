#!/usr/bin/env bash
# Creates one GitHub issue per pre-launch finding. Idempotent-ish: skips if a
# matching "[remediate] <ID>" title already exists. Writes ID->number map to
# /tmp/prelaunch-issue-map.txt
set -uo pipefail

MAP=/tmp/prelaunch-issue-map.txt
: > "$MAP"

existing=$(gh issue list --state open --limit 300 --json number,title \
  --jq '.[] | "\(.number)\t\(.title)"')

dom_label() { case "$1" in
  AR) echo architect;; FE) echo frontend;; BE) echo backend;; PE) echo performance;;
  DO) echo devops-sre;; SE) echo security;; QA) echo qa-reliability;; UX) echo ux;; esac; }

# id|sev|wave|title|body
create() {
  local id="$1" sev="$2" wave="$3" title="$4" body="$5"
  local dom; dom=$(dom_label "${id%%-*}")
  local full="[remediate] ${id} ${title}"
  local found; found=$(echo "$existing" | grep -F "[remediate] ${id} " | head -1 | cut -f1)
  if [ -n "$found" ]; then echo "${id}=${found} (exists)"; echo "${id} ${found}" >> "$MAP"; return; fi
  local url; url=$(gh issue create --title "$full" \
    --label "${dom},${sev},${wave}" \
    --body "${body}

---
Finding ID: ${id} | Severity: ${sev} | Source: docs/agents/pre-launch-report.md (pre-launch audit 2026-06-19)")
  local num; num=$(echo "$url" | grep -oE '[0-9]+$')
  echo "${id}=${num}"; echo "${id} ${num}" >> "$MAP"
}

# ---- Wave 1 (before launch) ----
create DO-B1 launch-blocker wave-1-before-launch "Branch-protection contexts mismatch CI check names (prod gate broken)" "main branch protection requires contexts test/lint-typecheck/build/e2e but actual CI check-run names are 'Test','Lint & Typecheck','Build','E2E Tests'. Gate never matches; enforce_admins is false. Fix: set required contexts to exact names + enforce_admins:true."
create BE-H1 high wave-1-before-launch "Platform pagination treats 429/5xx as successful empty result (silent score corruption)" "lib/{gitlab,bitbucket,codeberg}/queries.ts fetchPaginated returns partial/empty items on non-401/403 errors as success. Truncated data is scored, cached, snapshotted. Fix: treat 429 (and 5xx) like 401/403 -> return null to fall back to stale cache."
create BE-H2 high wave-1-before-launch "PAT-fallback auth enables outbound GitHub-call amplification" "resolve-request-auth verifies any non-CLI bearer via fetchGitHubUser; /recalculate /insights resolve auth before rate-limit; /supplemental rate-limits by attacker-chosen targetHandle. Fix: IP rate-limit before auth on recalculate/insights; verify ownership before per-handle quota; cheap token pre-check."
create FE-H1 high wave-1-before-launch "All content/SEO pages force-dynamic (no CDN caching)" "getServerLocale() + server Navbar use cookies()/headers(), forcing force-dynamic on zero-per-user pages. Fix: decouple locale from request-time for static pages; use NavbarClient; drop force-dynamic for ISR/static."
create FE-H2 high wave-1-before-launch "Both i18n dictionaries ship to every client bundle" "LanguageProvider statically imports en + es (1005 lines each), wrapping whole app. Fix: ship only active locale (props from server or dynamic import on switch)."
create SE-H1 high wave-1-before-launch "Transitive undici advisories via dev-only jsdom" "pnpm audit: 7 advisories (3 high) in undici <7.28.0 via jsdom (dev-only). Fix: pnpm override forcing undici >=7.28.0 (like js-yaml b7b33ace); re-audit to zero."
create UX-H1 high wave-1-before-launch "'Dominant dimension:' English on all 7 Spanish archetype pages" "archetypes/_components/ArchetypePage.tsx:87 hardcoded label. Fix: add archetypes.dominantDimensionLabel to en/es; render t()."
create UX-H2 high wave-1-before-launch "Share-page social metadata (OG/Twitter) hardcoded English" "u/[handle]/page.tsx:62,68,69. Fix: move strings to dictionary; render social card in primary-audience locale (es) or make route locale-aware."
create UX-H3 high wave-1-before-launch "Public dashboard/share aria-labels English-only" "ActivityHeatmap.tsx:148,253,562; StatsGrid.tsx:102; DimensionCard.tsx:213; ShortcutCheatSheet.tsx:93,104. Fix: route aria-labels through t() aria.* keys; interpolated heatmap day key."
create DO-H1 high wave-1-before-launch "develop integration branch has no protection" "All dev + Dependabot land on develop, source of every release PR. Fix: protect develop with same correctly-named contexts."
create AR-M1 medium wave-1-before-launch ".worktrees not excluded from tsc/build scope" "apps/web/tsconfig.json globs **/*.ts(x), excludes only node_modules; populated .worktrees double-compiles -> phantom typecheck errors/flaky CI. Fix: add .worktrees to exclude (apps/web + root tsconfig) + eslint ignores."
create BE-M1 medium wave-1-before-launch "getClientIp collapses to single 'unknown' bucket" "lib/http/client-ip.ts:12-27 returns literal 'unknown' when no forwarded-for; all such requests share one rate-limit key. Fix: fail safe (strict cap/deny) when no trusted IP header; document trusted-proxy assumption."
create BE-M2 medium wave-1-before-launch "CLI device-auth poll unauthenticated, bound only to UUID sessionId" "poll/approve flow lacks separate high-entropy device_code; sessionId leak -> 90-day token. Fix: RFC 8628 split (secret device_code for poll, user_code for approve)."
create BE-M4 medium wave-1-before-launch "Upstream GitHub error body logged verbatim (token-leak-into-logs)" "lib/github/queries.ts:64 logs full upstream body. Fix: log status + truncated/sanitized snippet only; same across platforms."
create DO-M1 medium wave-1-before-launch "CHAPA_ALERT_WEBHOOK_URL missing from .env.example" "Alerting silently no-ops when unset (server-errors.ts:124-125). Fix: add to .env.example + release-checklist; optional startup warn in prod."
create DO-M2 medium wave-1-before-launch "No migration drift detection between repo and prod schema" "Manual supabase db push; CI only validates filename sequence. Fix: release-checklist gate (or CI) asserting committed migrations applied before promoting to main."
create DO-M4 medium wave-1-before-launch "enforce_admins disabled on main" "Production protection bypassable by admins. Fix: set enforce_admins:true once DO-B1 contexts fixed."
create FE-M2 medium wave-1-before-launch "Landing page force-dynamic despite static demo SVG" "app/page.tsx:1 force-dynamic; only per-request input is error/lang query. Fix: render statically/ISR; read error/lang client-side."
create UX-M1 medium wave-1-before-launch "Archetype-list connector 'or'/'o' hardcoded, inverted per page" "about/page.tsx:73 (', or'); app/page.tsx:262,307 (' o '). Fix: dictionary key common.orConnector or array + localized separator."
create UX-M2 medium wave-1-before-launch "verify/[hash] mixes Spanish and English labels" "verify/[hash]/page.tsx:185 ('Commits'),227 ('Hash'); verifyDetail.reviews untranslated. Fix: add verifyDetail.commits + hashLabel; translate reviews->Revisiones."
create UX-M3 medium wave-1-before-launch "Root 404 page English-only despite Spanish default" "app/not-found.tsx:10-18 hardcoded English. Fix: client component using useTranslation (mirror error.tsx) or read locale cookie; add notFound.* keys."
create UX-M4 medium wave-1-before-launch "about.scoring CTA uses English verb in Spanish" "es.ts:814 about.scoring.ctaEmail='Email ...'. Fix: translate verb (keep address) -> 'Escribenos a ...'."
create UX-M5 medium wave-1-before-launch "Hardcoded rgba border breaks theming on empty heatmap cells" "ActivityHeatmap.tsx:574 border rgba(139,92,246,0.15). Fix: use token (var(--color-stroke) or purple-tint border token for both themes)."

# ---- Wave 2 (after launch) ----
create AR-M2 medium wave-2-after-launch "knip ignoreDependencies over-broad, masks dead-dep detection" "knip.json ignores 11 runtime deps; knip emits remove-from-ignore hints. Fix: remove each, re-run, confirm used/unused; scoped plugin config + comment."
create BE-M3 medium wave-2-after-launch "No retry/backoff on external API calls" "All outbound calls single-attempt. Fix: bounded jittered retry (1-2) for idempotent reads only; never token exchange/writes."
create BE-M5 medium wave-2-after-launch "Unvalidated external JSON shape can throw 500s" "Responses cast without runtime guards (github/gitlab/bitbucket/codeberg queries). Fix: minimal runtime guards at deserialization boundary; null/empty on mismatch."
create PE-M1 medium wave-2-after-launch "Rate-limit Redis round-trip precedes SVG cache hit" "badge.svg/route.ts:137-164 checks rate limit before cache read. Fix: read cache first, rate-limit on miss branch (or fold INCR into pipeline)."
create PE-M2 medium wave-2-after-launch "In-memory dedup/render-lock poll per-instance, long poll" "badge route inflight map + ~1.85s poll per lock-loser. Fix: document maps best-effort; return stale SVG immediately or shorten poll."
create DO-M3 medium wave-2-after-launch "Security checks (gitleaks/license) not required on main" "Fix: add Gitleaks + License compliance to required contexts; pnpm audit required or accepted-risk."
create QA-M1 medium wave-2-after-launch "No CI gate on coverage thresholds" "vitest run without coverage; no thresholds. Fix: add vitest thresholds + test:coverage in CI; exclude type-only/helpers."
create UX-M6 medium wave-2-after-launch "Studio page entirely unlocalized" "studio/page.tsx + StudioClient.tsx hardcoded English. Fix: localize via getServerT/useTranslation; add studio.* keys."
create FE-M1 medium wave-2-after-launch "Over-broad use client (86% of components)" "117/136 client components incl presentational/skeletons. Fix: push use client to smallest interactive leaf; loading.tsx need not be client."
create FE-M3 medium wave-2-after-launch "UserMenu eagerly fires 3 platform-status fetches on mount" "UserMenu.tsx:189-217 unconditional fetch even when flag-gated off. Fix: gate behind useClientFeatureFlags and/or defer until dropdown open."
create BE-L1 low wave-2-after-launch "GitLab fetchReviewsCount issues O(n) per-MR calls" "gitlab/queries.ts:252-279 up to MAX_PRS approver lookups. Fix: cap lookups / short-circuit after K consecutive nulls."
create BE-L2 low wave-2-after-launch "Webhook dedup fail-open under Redis outage" "webhooks/resend/route.ts:97-104 cannot distinguish exists vs unavailable. Fix: distinguish unavailable; decide explicitly."
create BE-L3 low wave-2-after-launch "gitlab/client.ts proceeds with empty-string OAuth creds" "client.ts:44-45 substitutes '' for missing id/secret. Fix: short-circuit refresh when unconfigured."
create DO-L1 low wave-2-after-launch "No cron 'all-failures' visibility / external uptime check" "warm-cache returns 200 with failures[]; no synthetic probe. Fix: external uptime monitor; emit P2 when failures exceed threshold."
create DO-L2 low wave-2-after-launch "not-found/global-error English-only" "not-found.tsx:10-13; global-error.tsx:44,53. Fix: localize not-found via translation; bilingual static for global-error. (Overlaps UX-M3.)"
create SE-L1 low wave-2-after-launch "Session cookies have no server-side revocation" "github.ts:338-345 24h Max-Age only. Fix: embed iat, reject older than Max-Age; revocation list on logout if surfaces grow."
create SE-L2 low wave-2-after-launch "Supplemental rate-limit keyed on targetHandle before ownership check" "supplemental/route.ts:47 vs 56-63. Fix: move ownership check ahead of per-handle increment, or key on authenticated handle. (Overlaps BE-H2.)"
create QA-L1 low wave-2-after-launch "Four behavior-bearing pages untested" "admin, verify/[hash], generating/[handle], cli/authorize pages. Fix: render/smoke tests asserting auth gating + primary state."
create UX-L1 low wave-2-after-launch "On-page radar colors non-tokenized; error toast polite not assertive" "BadgeContent.tsx:177-187 rgba; Toast.tsx:120-121 role=status. Fix: confirm BadgeContent theme then tokenize; error toasts role=alert/assertive."
create UX-L2 low wave-2-after-launch "Silent clipboard/download failures; verify input lacks aria-invalid" "BadgeToolbar.tsx:81-142; VerifyForm.tsx:34-50. Fix: toast on failure; aria-invalid + aria-describedby on verify input."
create UX-L3 low wave-2-after-launch "role=presentation element carries event handlers" "AuthorTypewriter.tsx:160. Fix: move stopPropagation to non-role wrapper or drop role."
create FE-L1 low wave-2-after-launch "Archetype 'ISR' test asserts force-dynamic" "archetypes-isr.test.ts:17-22 locks in anti-pattern. Fix: assert ISR/static when fixing FE-H1; rename."
create FE-L2 low wave-2-after-launch "Date.now/localStorage in useState initializers (hydration drift)" "UserMenu.tsx:90,91-101. Fix: deterministic defaults; populate in useEffect."

# ---- Wave 3 (later/strategic) ----
create AR-L1 low wave-3-later "lib/db/campaigns.ts oversized (835 lines, 22 exports)" "Fix: split along crud/send/recipients per per-entity db convention."
create PE-L1 low wave-3-later "OG-image rate-limit uses Redis-before-cache ordering" "og-image/route.ts:35-65. Fix: cache-first reordering (with PE-M1)."
create PE-L2 low wave-3-later "_enrichWithLogins adds N DB reads on every stats cache hit" "github/client.ts:58-59,94-114. Fix: write enriched stats back to cache key."
create PE-L3 low wave-3-later "resvg re-reads 4 TTF fonts from disk per OG miss" "svg-to-png.ts:71-81,30-35. Fix: read font buffers once at module scope; pass buffers."
create PE-L4 low wave-3-later "Share page may double-fetch on cold cache via img fallback" "u/[handle]/page.tsx:119-146,219-240. Accepted as failure-branch fallback; document, no code change required."
create DO-L3 low wave-3-later "No CHANGELOG/version-bump verification tied to release" "Fix: release-checklist item (or CI on develop->main PRs) requiring CHANGELOG entry + version bump."
create QA-L2 low wave-3-later "feature-flags-sync.ts untested" "lib/feature-flags-sync.ts:1-63. Fix: test each helper returns true only for 'true' incl whitespace/casing."
create FE-L3 low wave-3-later "Sparse memoization on dashboard rows (verify first)" "ImpactDashboard.tsx:26-65. Fix: profile; if material, useMemo profileText + React.memo pure rows."
create AR-S1 strategic wave-3-later "Architecture invariants rest on convention not gates" "Fix: wire madge check:circular into CI; eslint no-process-env (allowlist lib/env.ts); no-restricted-imports shared->apps/web; knip CI gate after AR-M2."
create BE-S1 strategic wave-3-later "Service-role-only DB access makes handler authz the sole gate" "Fix: centralize ownership checks into one audited helper used by every write route; add cross-handle-rejection tests."
create PE-S1 strategic wave-3-later "Per-day badge cache key forces midnight recompute herd" "badge.svg/route.ts:159-160. Fix: rolling per-handle 24h TTL or per-handle jittered expiry (hash(handle)->offset)."
create DO-S1 strategic wave-3-later "Cron concentration + 50/day warm-cache caps scaling" "warm-cache MAX_HANDLES=50. Fix: plan scaling path; alert when active users approach the ceiling."
create FE-S1 strategic wave-3-later "No client bundle budget / analyzer gate in CI" "Fix: CI step asserting per-route First Load JS under a budget; fail on regression."

echo "---- DONE ----"
wc -l < "$MAP"
