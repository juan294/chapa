import { resolveBadgeVerification } from "@/lib/profile/badge-verification";
import { Suspense } from "react";
import { after } from "next/server";
import { headers } from "next/headers";
import { BadgeToolbar } from "@/components/BadgeToolbar";
import { InlineBadgeSvg } from "@/components/badge/InlineBadgeSvg";
import { isValidHandle } from "@/lib/validation";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SharePageShortcuts } from "@/components/SharePageShortcuts";
import { SharePageOwnerContentLazy } from "@/components/SharePageOwnerContentLazy";
import { getBaseUrl } from "@/lib/env";
import { renderJsonLd } from "@/lib/jsonld";
import { toDateString } from "@/lib/utils/date";
import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { resolveBadgeConfigSnapshot } from "@/lib/render/badge-config";
import { resolveBadgeLocale } from "@/lib/render/badge-locale";
import {
  AVATAR_ABSENT_CACHE_TTL_SECONDS,
  buildOgImageCacheVersion,
  constantScoringSelection,
  readBadgeSvgCache,
  writeBadgeSvgCache,
} from "@/lib/render/badge-svg-cache";
import {
  getBadgeAvatarCachePolicy,
  getBadgeAvatarDataUri,
  resolveBadgeAvatar,
} from "@/lib/render/avatar-outcome";
import { CommandBarHint } from "@/components/CommandBarHint";
import Link from "next/link";
import { BadgeSkeleton } from "@/components/BadgeSkeleton";
import {
  materializePublicProfile,
  runPublicProfileSideEffects,
} from "@/lib/profile/public-profile";
import {
  readStoredBadgeProfile,
  storedBadgeRenderInputs,
  storedBadgeActivityUnavailable,
  type StoredBadgeProfile,
} from "@/lib/profile/stored-badge-profile";
import { getOptionalServerSessionFromHeaders } from "@/lib/auth/session";
import { isGitHubUserNotFound } from "@/lib/github/not-found";
import { captureServerError, captureServerEvent } from "@/lib/analytics/server-errors";
import { fireAndForget } from "@/lib/async/fire-and-forget";
import { getOAuthErrorMessage } from "@/lib/auth/error-messages";
import { isWebmcpEnabled } from "@/lib/feature-flags";
import { ErrorBanner } from "@/components/ErrorBanner";
import { getTrendData } from "@/lib/history/get-trend-data";
import { redactSnapshotDiffForVisitor } from "@/lib/history/diff";
import { getServerLocale, getServerT } from "@/lib/i18n/server";
import { DEFAULT_LOCALE, LocaleSync } from "@/lib/i18n";
import { DynamicRouteShell } from "@/components/DynamicRouteShell";
import type { Locale } from "@/lib/i18n";
import { interpolate } from "@/lib/i18n/interpolate";
import { tArray } from "@/lib/i18n/typed-accessors";
import { SiteFooter } from "@/components/SiteFooter";
import { SharePageHeader } from "./SharePageHeader";
import { describeScoreForMetadata } from "@/lib/profile/score-description";
import { readScoreReceiptV7 } from "@/lib/profile/score-receipt-v7";
import { readObservedScoreReceipt } from "@/lib/profile/score-receipt-observed";
import { explainReceipt, explainObservedReceipt } from "@/lib/dashboard/receipt-explanation";
import { SharePageLocaleContent } from "./SharePageLocaleContent";
import { SharePageWebMcpTools } from "./SharePageWebMcpTools";
import { dbGetLinkedPlatforms } from "@/lib/db/user-platforms";
import { readScoringStatus, hasDrawableCurrentReceipt } from "@/lib/collection/read-scoring-status";
import { badgeStatusState, needsUnavailablePlaceholder, type NonReadyScoringStatus } from "@/lib/render/badge-state";
import { SharePageScoringStatus } from "./SharePageScoringStatus";
import type { ScoringStatus } from "@/lib/collection/scoring-status";

const BASE_URL = getBaseUrl();
const READ_ONLY_SMOKE_PARAM = "__chapa_smoke";

interface SharePageProps {
  params: Promise<{ handle: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
  params,
  searchParams,
}: SharePageProps): Promise<Metadata> {
  const { handle } = await params;
  if (!isValidHandle(handle)) {
    return { title: "Not Found" };
  }

  // #1066 — the route is dynamic (see SharePage below), so locale resolves
  // via getServerLocale: an explicit ?lang= deep-link override first (#1020
  // contract — must win over the cookie), then the chapa-locale cookie,
  // then Accept-Language, falling back to DEFAULT_LOCALE ('es'). This must
  // resolve to the SAME locale as the body below, or streamed metadata
  // could disagree with the client title after hydration.
  const resolvedSearch = searchParams ? await searchParams : {};
  const requestedLocale =
    typeof resolvedSearch.lang === "string" ? resolvedSearch.lang : null;
  const locale = await getServerLocale(requestedLocale);
  const t = getServerT(locale);

  const pageUrl = `${BASE_URL}/u/${handle}`;
  // The date and durable Studio revision make each rendered configuration a
  // distinct CDN URL. This prevents an in-flight pre-save response from
  // refilling the URL advertised after that save.
  const today = toDateString(new Date());
  const configSnapshot = await resolveBadgeConfigSnapshot(handle);
  const ogVersion = configSnapshot.cacheable
    ? buildOgImageCacheVersion(today, configSnapshot.revision)
    : `${buildOgImageCacheVersion(today, null)}-uncached`;
  const ogImageUrl = `${BASE_URL}/u/${handle}/og-image?v=${ogVersion}&lang=${locale}`;
  return {
    title: `@${interpolate(t("sharePage.metadataTitle") as string, { handle })}`,
    description: interpolate(t("sharePage.metadataDescription") as string, { handle }),
    openGraph: {
      type: "profile",
      title: `@${interpolate(t("sharePage.metadataOgTitle") as string, { handle })}`,
      description: interpolate(t("sharePage.metadataDescription") as string, { handle }),
      url: pageUrl,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: interpolate(t("sharePage.metadataOgImageAlt") as string, { handle }) }],
    },
    twitter: {
      card: "summary_large_image",
      title: `@${interpolate(t("sharePage.metadataTitle") as string, { handle })}`,
      description: interpolate(t("sharePage.metadataDescription") as string, { handle }),
      images: [ogImageUrl],
    },
    alternates: {
      canonical: pageUrl,
    },
  };
}

export default async function SharePage({ params, searchParams }: SharePageProps) {
  const { handle } = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  const queryLang = typeof resolvedSearch.lang === "string" ? resolvedSearch.lang : null;
  // #1066 — same resolution as generateMetadata above (query > cookie >
  // header > default), so the body never disagrees with streamed metadata.
  const locale = await getServerLocale(queryLang);
  const readOnly = resolvedSearch[READ_ONLY_SMOKE_PARAM] === "1";

  // #1107 — every platform OAuth (Bitbucket/Codeberg/GitLab) connect/
  // callback failure branch in lib/auth/platform-oauth.ts redirects back to
  // this exact page as `?error=<platform>_<code>`, but nothing here read
  // that param — a failed "Connect GitLab" click left the user with zero
  // feedback. Read server-side (not via a client useSyncExternalStore leaf
  // like the landing page's #982 pattern): that pattern exists solely to
  // avoid opting a static/ISR page out of static rendering, and this route
  // is already dynamic (#1066 above already awaits searchParams and reads
  // the session), so there is no static-rendering cost left to avoid here.
  const errorCode = typeof resolvedSearch.error === "string" ? resolvedSearch.error : null;
  const t = getServerT(locale);
  const errorMessage = getOAuthErrorMessage(errorCode, (key) => t(key) as string);

  // Every notFound() on this route is a soft 404 (LE-8-2): the root
  // `app/loading.tsx` and this route's own `loading.tsx` each wrap the page
  // in a Suspense boundary, so Next has committed the response to 200 before
  // this function runs. Next renders
  // the not-found UI into the stream and injects
  // `<meta name="robots" content="noindex">`, which is the documented
  // behaviour for a streamed not-found. A real 404 status would need the
  // check to run before the shell — in `proxy.ts`, which the i18n carve-out
  // ADR deliberately keeps away from `/u/*`, or without that root boundary.
  if (!isValidHandle(handle)) {
    notFound();
  }

  const innerNavLinks = tArray<{ label: string; href: string }>(t, "nav.innerLinks");

  return (
    // #1194 (FE-S1) — this route is dynamic, so it needs all three corrections
    // the static root layout cannot make: the session-aware server Navbar
    // (FE-H2), `<html lang>` (FE-M1), and the real dictionary. They are one
    // component now rather than three per-page decisions.
    <DynamicRouteShell locale={locale} navLinks={innerNavLinks}>
        {/* Establish query ownership in the hydrated shell. The streamed client
            subtree then starts with the same dictionary as its server markup. */}
        <LocaleSync queryLang={queryLang} />
        {errorMessage && <ErrorBanner message={errorMessage} />}
        <main id="main-content" className="min-h-screen bg-bg">
          <Suspense fallback={<BadgeSkeleton />}>
            <SharePageContent handle={handle} readOnly={readOnly} locale={locale} />
          </Suspense>
          {/* Progressive disclosure (#783): the terminal command bar is demoted to a
              subtle, opt-in hint so the badge value stays legible to non-developer
              visitors. The "/" shortcut and full command bar remain available. */}
          <CommandBarHint />
        </main>
    </DynamicRouteShell>
  );
}

/** Data-dependent content — streams after shell via Suspense. */
/** @internal Exported for tests — use SharePage as the page component. */
export async function SharePageContent({
  handle,
  readOnly = false,
  locale = DEFAULT_LOCALE,
}: {
  handle: string;
  readOnly?: boolean;
  locale?: Locale;
}) {
  // Stats fetch uses env GITHUB_TOKEN fallback (no per-user OAuth token).
  // Hoisted above every other statement (a pure, sync dictionary lookup with
  // no data dependency) so the stored-fallback render branch below — which
  // needs a translator for its degraded disclosure — and the pre-existing
  // uses further down share one instance instead of resolving it twice.
  const t = getServerT(locale);

  // #1067 — resolve the requester's session server-side (the route is
  // dynamic per #1066) so owner-only confidence data can be redacted below
  // BEFORE it crosses into the "use client" component tree. A client-side
  // isOwner check (still used for display gating in SharePageOwnerContent)
  // only hides the UI — the data would already be in a visitor's
  // view-source via the RSC payload.
  //
  // #1034 — trend/diff history is fetched alongside profile materialization
  // (rather than in a client `useEffect` post-hydration) so the dashboard
  // renders with this data on first paint instead of a client fetch waterfall.
  // getTrendData() already degrades gracefully (returns nulls) on any
  // history-store failure; the `.catch()` here is a belt-and-suspenders
  // guard so a future regression in that contract still can't fail the
  // whole share page render — a 500 here would be a bug (CLAUDE.md).
  //
  // Session and flag resolution have no data dependency on the profile or
  // trend fetches, so all four run concurrently.
  //
  // #1180 (PE-L1) — the shared SVG cache read (#720 below) depends on
  // nothing in this wave: only `handle` and today's date, both known here
  // already. It used to run as a strictly later `await` step after this
  // Promise.all resolved, serializing a Redis round-trip behind the whole
  // wave for no reason. `today`/`svgCacheKey` are computed HERE (not after
  // the wave) and reused verbatim by the later `writeBadgeSvgCache` call
  // below — computing the date once and reusing it (rather than recomputing
  // `toDateString(new Date())` again after the wave) avoids a UTC-midnight
  // race where a request could read one day's key and write another.
  // #1335 phase 5 — replaces the retired `readScoringRenderSelection()` flag
  // read: there is one policy now (`SCORING_POLICY`), captured once per
  // render so every cache-header/key computation below agrees.
  const capturedAt = Date.now();
  const scoringSelection = constantScoringSelection(capturedAt);

  // #1335 phase 4/5 — a handle with no ready receipt renders its scoring
  // state instead of the normal materialize/breakdown pipeline: there is
  // nothing to fetch or explain yet. Resolving the session here (rather than
  // inside the Promise.all wave below) costs one extra sequential await only
  // on this early-return path — session resolution is a local cookie/JWT
  // check, not network I/O — and is what lets this branch decide `isOwner`
  // before doing any of the heavier work below. A null status (a failed
  // authority read) takes neither branch below and this function continues
  // exactly as it did before phase 4.
  //
  // #1335 phase 4 perf fix — skip `readScoringStatus` (3 DB reads) whenever
  // `hasDrawableCurrentReceipt` (the same single receipt read
  // `materializePublicProfile` below already does) finds a drawable current
  // receipt. See badge.svg's own comment for the full rationale.
  let scoringStatus: ScoringStatus | null = null;
  if (!(await hasDrawableCurrentReceipt(handle, scoringSelection))) {
    try {
      scoringStatus = await readScoringStatus(handle);
    } catch (err) {
      scoringStatus = null;
      fireAndForget(() => captureServerError({ route: `/u/${handle}`, statusCode: 500, error: err }));
    }
  }
  const badgeState = scoringStatus ? badgeStatusState(scoringStatus) : null;
  if (badgeState && scoringStatus) {
    const session = await headers().then((h) => getOptionalServerSessionFromHeaders(h));
    const isOwner = session?.login === handle;
    return (
      <SharePageScoringStatus
        handle={handle}
        locale={locale}
        status={scoringStatus as NonReadyScoringStatus}
        badgeState={badgeState}
        isOwner={isOwner}
      />
    );
  }

  const today = toDateString(new Date(capturedAt));
  // #1181 (UX-H3 follow-up) — the cache key and the rendered content below
  // MUST come from the same resolved locale, never independent defaults.
  // `resolveBadgeLocale` (not `buildBadgeSvgCacheKey` directly) is the only
  // sanctioned way to derive either here: it bundles both under one call
  // bound to this page's own resolved `locale` prop, so the key can no
  // longer silently disagree with the content written into it (the bug
  // this fixed — content defaulted to English while the key defaulted to
  // DEFAULT_LOCALE/Spanish, so the majority Spanish-locale traffic was
  // served an English badge).
  const badgeLocale = resolveBadgeLocale(locale);
  const svgCacheKey = badgeLocale.cacheKey(handle, today);
  const [session, materialization, trendData, webmcpEnabled, cachedSvg] = await Promise.all([
    headers().then((h) => getOptionalServerSessionFromHeaders(h)),
    materializePublicProfile(handle, { readOnly, scoringSelection }),
    getTrendData(handle).catch(() => ({ trend: null, diff: null })),
    isWebmcpEnabled(),
    scoringSelection.cacheable ? readBadgeSvgCache(svgCacheKey) : Promise.resolve(null),
  ]);
  // LE-8-2 — GitHub answered that nobody owns this handle. Not the empty
  // "try later" state, which is reserved for `null` (an outage or a rate
  // limit must never 404 a real user): Next's mid-stream not-found, with the
  // not-found UI and an injected noindex — see the shell note on SharePage
  // for why the status itself is already 200 here.
  if (isGitHubUserNotFound(materialization)) notFound();
  const materialized = materialization;
  const isOwner = session?.login === handle;

  // #1335 phase 4 fix — `scoringStatus === null` means the `readScoringStatus`
  // authority read itself failed under v7.2 (not "no receipt found"; that is
  // its own real `ScoringStatus`, handled above). "Failed authority reads are
  // unavailable": this must never silently fall through to whatever the
  // normal materialize pipeline above already produced when THAT also has no
  // v7.2 receipt to draw. A handle WITH a drawable receipt (found
  // independently by that same materialize call) still renders it normally
  // below — reuses the exact same status-placeholder component as
  // `collecting`/`action_needed`/`unregistered` rather than inventing a
  // second one.
  if (materialized && needsUnavailablePlaceholder(scoringSelection, scoringStatus, materialized.scoring?.policyVersion)) {
    return (
      <SharePageScoringStatus
        handle={handle}
        locale={locale}
        status={null}
        badgeState="unavailable"
        isOwner={isOwner}
      />
    );
  }

  // #1332 — owner-only, cheap (single indexed SELECT on `user_platforms` by
  // handle, no token decryption): a linked source whose refresh grant needs
  // reconnecting has no other owner-visible surface on this dynamic (never
  // statically cached) page. Deliberately NOT threaded through `StatsData`/
  // the scoring composition pipeline (`getStats`/`_compose`) — that pipeline
  // carries its own cache-binding and integrity invariants (see CLAUDE.md's
  // "stats cache" section) that a cosmetic UI flag has no reason to touch.
  // Never runs for a visitor, so it adds no read to the common case.
  const reconnectNeeded = isOwner
    ? (await dbGetLinkedPlatforms(handle))
        .filter((platform) => platform.needsReconnect)
        .map((platform) => platform.platform)
    : [];

  // badge-source-outage-resilience (2026-09-22) / #1331 — live materialization
  // failed (a linked-source refresh outage, a GitHub rejection, etc.), but a
  // durable last committed receipt/snapshot may still exist. Mirrors the
  // badge route's own `!materialized` branch exactly (`stored-badge-profile.ts`):
  // a stored fallback is a distinct, non-`MaterializedProfile` projection, so
  // it can never reach `resolveBadgeVerification`, `runPublicProfileSideEffects`,
  // snapshot persistence, or the normal SVG cache write below — all three stay
  // gated on `materialized` alone, unchanged, and `materialized` stays null here.
  const stored: StoredBadgeProfile | null = materialized
    ? null
    : await readStoredBadgeProfile(handle, scoringSelection);
  const storedInputs = stored ? storedBadgeRenderInputs(stored) : null;

  const stats = materialized?.stats ?? storedInputs?.stats ?? null;
  const craftResult = materialized?.craftResult ?? null;
  // The one scoring authority both a live and a stored render draw from —
  // v7.2 receipt authority when present, never mixed with a v6 aggregate
  // (`stored.scoring`/`materialized.scoring` are each already one or the
  // other, never both).
  const scoringModel = materialized?.scoring ?? stored?.scoring ?? null;
  const verification = materialized
    ? await resolveBadgeVerification(materialized)
    : null;

  // #720 — try the shared SVG cache first (read kicked off above, alongside
  // the rest of the wave). The /u/[handle]/badge.svg route writes here after
  // every successful render, so on warm caches the share page can skip
  // avatar fetch + render entirely.
  let inlineSvg: string | null = cachedSvg;
  let renderedFresh = false;
  let configCacheable = false;
  let configRevision: number | null = null;
  let avatarCachePolicy: ReturnType<typeof getBadgeAvatarCachePolicy> = "skip";

  if (!cachedSvg && stats && materialized?.scoring) {
    // Cache miss — render inline. Avatar fetch is best-effort with a tight
    // 250ms deadline (#800) so a slow external image server can't block
    // TTFB. The /u/[handle]/badge.svg route uses a longer bounded deadline on
    // its own first render and writes the avatar-bearing SVG to the same
    // cache, so warm visits to the share page get the real avatar.
    const AVATAR_DEADLINE_MS = 250;
    let avatarDataUri: string | undefined;
    if (!readOnly) {
      const avatarOutcome = await resolveBadgeAvatar(handle, stats.avatarUrl, {
        deadlineMs: AVATAR_DEADLINE_MS,
      });
      avatarDataUri = getBadgeAvatarDataUri(avatarOutcome);
      avatarCachePolicy = getBadgeAvatarCachePolicy(avatarOutcome);
    }
    const configSnapshot = await resolveBadgeConfigSnapshot(handle);
    // badge-source-outage-resilience (2026-09-22) — requiring exactly
    // `"current"` (not merely `!== "unavailable"`) keeps a `"stale"`
    // exact-bound aggregate render out of the normal SVG cache, mirroring
    // the badge route's own `freshnessCacheable` gate (#1331).
    configCacheable = configSnapshot.cacheable && materialized.scoring?.freshness === "current";
    configRevision = configSnapshot.revision;
    // #1335 phase 5 — `materialized.scoring` is guaranteed non-null by the
    // gate above (a drawable receipt already passed
    // `needsUnavailablePlaceholder`), even though its type stays optional.
    inlineSvg = renderBadgeSvg(stats, {
      scoring: materialized.scoring!,
      avatarDataUri,
      // #1191 — this render writes to the same cache slot the badge route
      // reads, so it must use the same config.
      config: configSnapshot.config,
      verificationHash: verification?.hash,
      verificationDate: verification?.date,
      // #1181 — same `badgeLocale` bundle that produced `svgCacheKey` above,
      // so content and key are always for the same locale.
      strings: badgeLocale.stringsFor(materialized.scoring?.tier ?? null),
    });
    renderedFresh = true;
  } else if (!cachedSvg && stats && storedInputs && stored) {
    // badge-source-outage-resilience (2026-09-22) / #1331 — the stored
    // fallback's own render: the same degraded disclosure the badge route's
    // `!materialized` branch draws (`stored-badge-profile.ts`'s
    // `storedBadgeRenderInputs`/`storedBadgeActivityUnavailable`), never
    // eligible for the normal SVG cache — `renderedFresh` stays false, and
    // the deferred cache-write/side-effect block below stays gated on
    // `materialized`, which is null here, so it never runs for this branch.
    const configSnapshot = await resolveBadgeConfigSnapshot(handle);
    inlineSvg = renderBadgeSvg(stats, {
      scoring: stored.scoring,
      config: configSnapshot.config,
      degraded: {
        reason: "live_sources_unavailable",
        observedAt: stored.observedAt,
        activityAvailable: false,
        countsAvailable: storedInputs.countsAvailable,
      },
      strings: {
        ...badgeLocale.stringsFor(stored.scoring.tier ?? null),
        activityUnavailable: storedBadgeActivityUnavailable((key) => t(key) as string, stored.observedAt),
      },
    });

    // Bounded telemetry: fallback kind + date only, same event the badge
    // route emits for the same fallback.
    fireAndForget(() =>
      captureServerEvent("badge_stored_fallback", {
        policyVersion: stored.scoring.policyVersion,
        observedDate: stored.observedAt.slice(0, 10),
      }),
    );
  }

  // Deferred work: verification storage, tracking, snapshots, and an eligible
  // fresh-render cache write so future requests and the badge.svg route can
  // hit the cache. Transient avatar failures and timeouts stay uncached; a
  // definitive remote absence is stable enough for the normal cache, while a
  // missing URL gets the short placeholder TTL. (#800)
  //
  // #1088 — a handle with NO avatarUrl at all is different: that absence
  // won't resolve itself on a retry within this request, so gating the write
  // shut the same way as a genuine race-timeout meant it NEVER got cached.
  // It still gets a write, just a short-TTL one, so it doesn't shadow a
  // later good render for the full 24h+jitter a normal write would use.
  //
  // #1091 — the cache write and side effects have nothing in the rendered
  // HTML depending on their result, so (mirroring the badge route's #1013
  // fix) they run inside after() instead of blocking TTFB. A genuine
  // failure is escalated via captureServerError rather than swallowed.
  //
  // #1335 phase 5 — snapshot persistence and the v6 HMAC verification
  // record are gone; `runPublicProfileSideEffects` now only tracks the
  // badge-generated event and refreshes the owner's display name/avatar.
  if (materialized && inlineSvg && !readOnly) {
    const cacheEligible =
      renderedFresh && configCacheable && !!verification && avatarCachePolicy !== "skip";
    const svgToCache = cacheEligible ? inlineSvg : null;
    // Short-TTL only when stats have no avatar URL; a resolved avatar keeps
    // the standard 24h+jitter TTL (writeBadgeSvgCache's own default).
    const svgCacheTtlSeconds =
      cacheEligible && avatarCachePolicy === "short"
        ? AVATAR_ABSENT_CACHE_TTL_SECONDS
        : undefined;
    after(async () => {
      if (svgToCache) {
        await writeBadgeSvgCache(
          svgCacheKey,
          svgToCache,
          handle,
          { ttlSeconds: svgCacheTtlSeconds, configRevision, receiptIdentity: materialized.scoring?.policyVersion === "v7.2" ? materialized.scoring.identity : null },
        );
      }
      return runPublicProfileSideEffects(handle, materialized)
        .catch((err) => {
          fireAndForget(() =>
            captureServerError({
              route: `/u/${handle}`,
              statusCode: 500,
              error: err,
            }),
          );
        });
    });
  }

  const badgeCacheBuster = stats?.fetchedAt ?? new Date().toISOString();
  const badgeSrcParams = new URLSearchParams({
    v: badgeCacheBuster,
    lang: locale,
    ...(readOnly ? { [READ_ONLY_SMOKE_PARAM]: "1" } : {}),
  });
  const badgeImageSrc = `/u/${encodeURIComponent(handle)}/badge.svg?${badgeSrcParams.toString()}`;

  // #1165 (UX-M5) — built ONCE here, server-side, so the "e" keyboard
  // shortcut (SharePageShortcuts) and the visible Markdown Copy button
  // (SharePageOwnerContent) always produce byte-identical, localized,
  // handle-bearing clipboard content — this used to be an independent,
  // hardcoded-English, non-handle-bearing literal. The alt text form
  // matches the HTML embed's own (`${badgeAltOf} ${handle}`).
  // #1167 (UX-B1) — real routes (/about, /about/scoring, /verify) for the
  // server Navbar's center nav, NOT the landing page's `landing.navLinks`
  // hash anchors (`#features`, etc.), which are meaningless off that page.
  const embedBadgeUrl = `https://chapa.thecreativetoken.com/u/${handle}/badge.svg`;
  const embedAltText = `${t('shareOwner.badgeAltOf') as string} ${handle}`;
  const embedMarkdown = `![${embedAltText}](${embedBadgeUrl})`;
  const embedHtml =
    `<img src="${embedBadgeUrl}" alt="${embedAltText}" width="600" height="315" />`;

  const displayLabel = stats?.displayName ?? handle;

  const scoreDescription = describeScoreForMetadata(scoringModel);

  // #1311 — a v7 subject's breakdown is the receipt's own arithmetic. Resolved
  // here rather than in the client tree: `explainReceipt` reads the sealed
  // receipt, and the projection it returns is what crosses the boundary.
  const identity = materialized?.scoring?.identity;
  const receiptExplanation = identity && materialized?.scoring?.policyVersion === "v7.2"
    ? await readObservedScoreReceipt(handle, identity.revisionId).then(stored =>
        stored.status === "found" && stored.envelope.receipt.revisionId === identity.revisionId && stored.envelope.contentHash.value === identity.contentHash
          ? explainObservedReceipt({ receipt: stored.envelope, trend: stored.trend }, scoringSelection.capturedAt) : null)
    : identity && materialized?.scoring?.policyVersion === "v7"
      ? await readScoreReceiptV7(handle, identity.revisionId).then(snapshot =>
          snapshot && snapshot.receipt.receipt.revisionId === identity.revisionId && snapshot.receipt.contentHash.value === identity.contentHash ? explainReceipt(snapshot) : null)
      : null;

  const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: displayLabel,
    url: `https://github.com/${handle}`,
    sameAs: [`https://github.com/${handle}`],
    // #1311 — described from the model the badge draws, not the v6 aggregate.
    // A v7 evidence range has no single number and may have no tier, and this
    // description is what a search result and an LLM quote back: publishing a
    // point here while the badge shows an interval would put a number Chapa
    // does not claim into someone else's index.
    ...(scoreDescription ? { description: scoreDescription } : {}),
    ...(verification?.hash
      ? {
          potentialAction: {
            "@type": "ViewAction",
            name: "Verify this badge's data integrity",
            target: `${BASE_URL}/verify/${verification.hash}`,
          },
        }
      : {}),
  };

  const badgeLabelId = `share-badge-label-${handle}`;

  const diffForClient =
    trendData.diff && !isOwner
      ? redactSnapshotDiffForVisitor(trendData.diff)
      : trendData.diff;

  return (
    <>
      <SharePageShortcuts
        embedMarkdown={embedMarkdown}
        handle={handle}
        isOwner={isOwner}
      />
      {webmcpEnabled && stats && materialized?.scoring && (
        <SharePageWebMcpTools
          handle={handle}
          scoring={materialized.scoring}
          stats={stats}
          verification={verification}
          trend={trendData.trend}
          diff={diffForClient}
          embedMarkdown={embedMarkdown}
          embedHtml={embedHtml}
        />
      )}
      {/* SAFETY: renderJsonLd escapes <, >, & to prevent </script> injection. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: renderJsonLd(personJsonLd),
        }}
      />

      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 pt-20 pb-16 sm:pt-24 sm:pb-24">
        <SharePageLocaleContent handle={handle} badgeLabelId={badgeLabelId} />

        {/* ── Header: identity paired with the headline score (#1217) ── */}
        <SharePageHeader handle={handle} displayLabel={displayLabel} />

        {/* ── Badge Preview ──────────────────────────────────── */}
        <div className="mb-4 animate-scale-in motion-reduce:animate-none [animation-delay:200ms]">
          <div className="relative rounded-[3px] border border-stroke bg-card p-4">
            {/* The badge draws its own verification strip down the right edge.
                That strip is the profile's only route to the verification
                record now that the header pill is gone, so it is covered by a
                transparent link rather than repeating the claim in text. */}
            {verification?.hash && (
              <Link
                href={`/verify/${verification.hash}`}
                aria-label={t("badge.metricsVerified") as string}
                className="absolute top-4 right-4 bottom-4 z-10 w-[5%] rounded-[3px] focus-visible:outline-2 focus-visible:outline-amber-text"
              />
            )}
            <div
              role="img"
              aria-labelledby={badgeLabelId}
              className="w-full overflow-hidden [&_svg]:w-full [&_svg]:h-auto [&_svg]:block"
            >
              {inlineSvg ? (
                <InlineBadgeSvg svg={inlineSvg} />
              ) : (
                /* Fallback: if SVG render failed, load via <img> with the
                   loading plate layered BEHIND it (LE-5-1). The plate is out
                   of flow so the frame is one badge-shaped box, not two
                   stacked; the positioned image paints over it once loaded. */
                <div className="relative">
                  <div aria-hidden="true" className="absolute inset-0">
                    <BadgeSkeleton />
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={badgeImageSrc}
                    alt=""
                    aria-hidden="true"
                    width={1200}
                    height={630}
                    fetchPriority="high"
                    className="relative w-full"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Toolbar ──────────────────────────────────────────── */}
        <div className="relative z-30 flex justify-end mb-10 animate-fade-in-up motion-reduce:animate-none [animation-delay:250ms]">
          <BadgeToolbar
            handle={handle}
            isOwner={isOwner}
          />
        </div>

        {/* ── Owner/Visitor Content (isOwner resolved server-side above) ──
             #1335 phase 5 — "delete v6": there is no `ClientImpactV6Result`
             projection left to pass. `SharePageOwnerContent`'s Impact
             Dashboard section still gates on this prop and reads a
             v6-shaped object internally even for a v7.2 subject
             (`ImpactDashboard.tsx`'s `impact: ClientImpactV6Result` — not
             just the nullable pass-through this component declares); it has
             not been updated to draw solely from `scoring`. That is plan
             step 5.8 ("Dashboard components ... SharePageOwnerContent:282:
             v7.2 branch only"), owned outside this workstream's file list.
             Passing `null` here is the honest state of the data (there is
             none), but it means every owner's Impact Dashboard section
             renders `EmptyImpactState` until 5.8 lands — a known, reported
             regression, not a silent one. */}
        <SharePageOwnerContentLazy
          handle={handle}
          stats={stats}
          impact={null}
          craftResult={craftResult}
          trend={trendData.trend}
          diff={diffForClient}
          isOwner={isOwner}
          embedMarkdown={embedMarkdown}
          embedHtml={embedHtml}
          receiptExplanation={receiptExplanation}
          scoring={scoringModel}
          staleFallback={stored ? { observedAt: stored.observedAt } : null}
          reconnectNeeded={reconnectNeeded}
        />
      </div>

      {/* pb-16 spacer (#1167 / UX-B1) — CommandBarHint (rendered by the
          SharePage default export, a sibling of this Suspense boundary)
          mounts GlobalCommandBarLazy (fixed bottom-0) once summoned via the
          "/" shortcut. This reserves room below the footer so scrolling to
          the true bottom of the page clears it instead of it occluding the
          footer's last line — same pattern as the [locale] content pages. */}
      <div className="pb-16">
        <SiteFooter t={t} />
      </div>
    </>
  );
}
