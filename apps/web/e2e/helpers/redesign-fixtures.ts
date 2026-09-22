/** Disposable local data only. No app import or production authentication bypass. */
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import type { BrowserContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_BADGE_CONFIG, CONTRIBUTION_QUERY, REPOSITORY_STATS_QUERY, type StatsData } from '@chapa/shared';
import { buildRedesignGitHubFixture } from './redesign-github';
import { makeFullStats } from '../../lib/test-helpers/fixtures';
import { DEMO_STATS } from '../../lib/render/demoData';
import { SCORING_POINT_HANDLES, fixtureStatsCacheEntry } from "./scoring-point-fixtures";
import { computeImpactV6 } from '../../lib/impact/v6';
import { buildPayload, computeHash } from '../../lib/verification/hmac-payload';
import { VERIFICATION_RECORD_TTL_MS } from '../../lib/verification/constants';
import { toDateString } from '../../lib/utils/date';

export const REDESIGN_OWNERS = ['en', 'es'].flatMap(locale => ['light', 'dark'].flatMap(theme => ['desktop', 'mobile'].map(device => `chapa-redesign-${locale}-${theme}-${device}`)));
export const REDESIGN_HANDLES = ['octocat', 'juan294', 'chapa-redesign-owner', 'chapa-redesign-visitor', ...REDESIGN_OWNERS];
export const REDESIGN_VALID_HASH = 'd3519000d3519000d3519000d3519000';
const flagKeys = ['studio_enabled', 'studio_demo_enabled', 'insights_integration', 'webmcp_enabled', 'bitbucket_integration', 'codeberg_integration', 'gitlab_integration'];

export function assertLocalFixtureTarget(url: string): void {
  const target = new URL(url);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || !['http:', 'https:'].includes(target.protocol)) {
    throw new Error('Redesign fixtures require a loopback service');
  }
}

export async function setRedesignSession(context: BrowserContext, baseURL: string, handle: string): Promise<void> {
  assertLocalFixtureTarget(baseURL);
  if (!([...REDESIGN_HANDLES, ...SCORING_POINT_HANDLES] as readonly string[]).includes(handle)) throw new Error('Unknown redesign session');
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error('Local session secret required');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(secret).digest(), iv);
  const payload = JSON.stringify({ login: handle, name: handle, avatar_url: '', token: 'redesign-local-fixture', iat: Math.floor(Date.now() / 1000) });
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  await context.addCookies([{ name: 'chapa_session', value: `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`, url: baseURL, httpOnly: true, sameSite: 'Lax' }]);
}

/**
 * The exact `verification_records` row a live render of `handle` will
 * independently derive for `stats`, via the same pure
 * `computeImpactV6`/`buildPayload`/`computeHash` the production path uses
 * (`lib/profile/public-profile.ts#getPublicProfileVerification`,
 * `lib/verification/hmac.ts#generateVerificationCode`,
 * `lib/db/verification.ts#dbStoreVerification`'s column mapping) — never a
 * hand-picked hash or score set. See the call site in
 * `bootstrapRedesignFixtures` for why this must be pre-seeded at all.
 */
export function buildDerivedVerificationRow(stats: StatsData, verificationSecret: string, now: Date = new Date()): Record<string, unknown> {
  const impact = computeImpactV6(stats);
  const verificationDate = toDateString(now);
  const hash = computeHash(buildPayload(stats, impact, verificationDate), verificationSecret);
  return {
    hash, handle: stats.handle.toLowerCase(), display_name: stats.displayName ?? null,
    adjusted_composite: impact.adjustedComposite, confidence: impact.confidence, tier: impact.tier, archetype: impact.archetype,
    profile_type: impact.profileType, building: impact.dimensions.delivery, guarding: impact.dimensions.quality,
    consistency: impact.dimensions.consistency, breadth: impact.dimensions.breadth,
    commits_total: stats.commitsTotal, prs_merged_count: stats.prsMergedCount, reviews_submitted: stats.reviewsSubmittedCount,
    generated_at: verificationDate, expires_at: new Date(now.getTime() + VERIFICATION_RECORD_TTL_MS).toISOString(),
  };
}

export function redesignFixtureClient() {
  const url = process.env.SUPABASE_URL ?? '';
  assertLocalFixtureTarget(url);
  if (process.env.REDESIGN_DISPOSABLE_PROJECT !== 'chapa-redesign') throw new Error('Disposable project acknowledgement required');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Local service key required');
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

/** Seeds only a separately started, acknowledged disposable stack; refuses existing users. */
export async function bootstrapRedesignFixtures(upstreamFile: string) {
  const db = redesignFixtureClient();
  const check = async <T extends { error: unknown }>(operation: PromiseLike<T>): Promise<T> => {
    const result = await operation;
    if (result.error) throw result.error;
    return result;
  };
  const existing = await check(db.from('users').select('handle').in('handle', [...REDESIGN_HANDLES]));
  if (existing.data?.length) throw new Error('Refusing to overwrite existing redesign users');
  const flags = await check(db.from('feature_flags').select('*').in('key', flagKeys));
  const cleanup = async () => {
    const errors: unknown[] = [];
    const tables = ['verification_records', 'user_platforms', 'studio_configs', 'metrics_snapshots', 'users'];
    for (const table of tables) {
      await check(db.from(table).delete().in('handle', [...REDESIGN_HANDLES])).catch(error => errors.push(error));
    }
    await check(db.from('feature_flags').delete().in('key', flagKeys)).catch(error => errors.push(error));
    if (flags.data?.length) await check(db.from('feature_flags').upsert(flags.data, { onConflict: 'key' })).catch(error => errors.push(error));
    for (const table of tables) {
      await check(db.from(table).select('handle').in('handle', [...REDESIGN_HANDLES]))
        .then(result => { if (result.data?.length) errors.push(new Error(`Redesign residue in ${table}`)); })
        .catch(error => errors.push(error));
    }
    if (errors.length) throw new AggregateError(errors, 'Redesign fixture cleanup failed');
  };
  try {
    await check(db.from('feature_flags').upsert(flagKeys.map(key => ({ key, enabled: true, config: {}, description: 'Disposable redesign browser fixture' })), { onConflict: 'key' }));
    await check(db.from('users').insert(REDESIGN_HANDLES.map(handle => ({ handle }))));
    const { colorPalette: _colorPalette, ...legacy } = DEFAULT_BADGE_CONFIG;
    void _colorPalette;
    await check(db.from('studio_configs').insert([
      { handle: 'octocat', config: { ...DEFAULT_BADGE_CONFIG, colorPalette: 'jade' } },
      { handle: 'juan294', config: legacy },
      ...['chapa-redesign-owner', ...REDESIGN_OWNERS].map(handle => ({ handle, config: DEFAULT_BADGE_CONFIG })),
    ]));
    const cache: Record<string, string> = {};
    const github: Record<string, unknown> = {};
    let octocatVerificationRow: Record<string, unknown> | null = null;
    for (const handle of REDESIGN_HANDLES) {
      const stats = makeFullStats({ ...DEMO_STATS, handle, displayName: handle, avatarUrl: '', linkedPlatforms: [], linkedPlatformLogins: {}, fetchedAt: new Date().toISOString() });
      const secret = process.env.NEXTAUTH_SECRET, token = process.env.GITHUB_TOKEN;
      if (!secret || token !== 'redesign-local-fixture') throw new Error('Explicit local fixture secrets/token required for bound stats');
      const referenceDate = stats.fetchedAt.slice(0, 10);
      cache[`stats:v3:${handle}`] = fixtureStatsCacheEntry(handle, referenceDate, secret, token, stats, new Date(stats.fetchedAt));
      cache[`stats:stale:v2:${handle}`] = JSON.stringify(stats);
      github[handle] = { data: { user: { login: handle, name: handle, avatarUrl: '', contributionsCollection: { contributionCalendar: { totalContributions: 0, weeks: [] }, pullRequestContributions: { totalCount: 0, nodes: [] }, pullRequestReviewContributions: { totalCount: 0 }, issueContributions: { totalCount: 0 } }, repositories: { totalCount: 0, nodes: [] } }, search: { issueCount: 0 } } };
      // #1279/deployment-probes.ts `assertShareVerification` reads octocat's
      // share page as a read-only smoke probe (`__chapa_smoke=1`), extracts
      // the /verify/{hash} link the live render produced, then looks that
      // exact hash up via /api/verify. `getPublicProfileVerification` derives
      // that hash deterministically from (stats, impact, today's date), but
      // `runPublicProfileSideEffects` only *persists* it when `readOnly` is
      // false — a read-only probe never writes it. On a genuinely cold seed
      // (no earlier non-read-only render of /u/octocat to mint it first),
      // that made the lookup 404 regardless of the stats-cache fix above.
      // Pre-seed the exact row a live render will independently derive, via
      // the same pure `computeImpactV6`/`buildPayload`/`computeHash` the
      // production path uses, rather than a hand-picked hash/scores.
      if (handle === 'octocat') {
        const verificationSecret = process.env.CHAPA_VERIFICATION_SECRET;
        if (!verificationSecret) throw new Error('Explicit local verification secret required to pre-seed the read-only smoke probe record');
        octocatVerificationRow = buildDerivedVerificationRow(stats, verificationSecret);
      }
    }
    for (const handle of SCORING_POINT_HANDLES) github[handle] = buildRedesignGitHubFixture(handle, new Date().toISOString()).response;
    const today = new Date().toISOString();
    await check(db.from('verification_records').insert({ hash: REDESIGN_VALID_HASH, handle: 'chapa-redesign-owner', display_name: 'Local redesign fixture', adjusted_composite: 70, confidence: 86, tier: 'High', archetype: 'Builder', profile_type: 'collaborative', building: 74, guarding: 69, consistency: 71, breadth: 67, commits_total: 124, prs_merged_count: 18, reviews_submitted: 33, generated_at: today.slice(0, 10), expires_at: new Date(Date.now() + 86400_000).toISOString() }));
    if (!octocatVerificationRow) throw new Error('octocat verification row was not derived');
    await check(db.from('verification_records').insert(octocatVerificationRow));
    await writeFile(upstreamFile, JSON.stringify({ cache, github, journeyRunId: 'redesign', contributionQuery: CONTRIBUTION_QUERY, repositoryQuery: REPOSITORY_STATS_QUERY, avatarPng: (await readFile(resolve(__dirname, '../../public/logo-512.png'))).toString('base64') }));
    return { db, cleanup };
  } catch (error) {
    try { await cleanup(); } catch (cleanupError) { throw new AggregateError([error, cleanupError], 'Redesign bootstrap and cleanup failed'); }
    throw error;
  }
}
