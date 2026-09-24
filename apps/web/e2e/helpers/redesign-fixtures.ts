/** Disposable local data only. No app import or production authentication bypass. */
import { createCipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import type { BrowserContext } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_BADGE_CONFIG, CONTRIBUTION_QUERY, REPOSITORY_STATS_QUERY, canonicalJson, canonicalSha256, createScoringWindow } from '@chapa/shared';
import { buildRedesignGitHubFixture } from './redesign-github';
import { makeFullStats } from '../../lib/test-helpers/fixtures';
import { DEMO_STATS } from '../../lib/render/demoData';
import { SCORING_POINT_HANDLES, COLLECTION_QUEUE_HANDLES, fixtureStatsCacheEntry } from "./scoring-point-fixtures";
import { observedReceiptFixture } from '../../lib/history/__fixtures__/receipts-observed';
import { observedSemanticIdentity } from '../../lib/profile/receipt-semantic-identity';

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
  if (!([...REDESIGN_HANDLES, ...SCORING_POINT_HANDLES, ...COLLECTION_QUEUE_HANDLES] as readonly string[]).includes(handle)) throw new Error('Unknown redesign session');
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error('Local session secret required');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(secret).digest(), iv);
  const payload = JSON.stringify({ login: handle, name: handle, avatar_url: '', token: 'redesign-local-fixture', iat: Math.floor(Date.now() / 1000) });
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  await context.addCookies([{ name: 'chapa_session', value: `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`, url: baseURL, httpOnly: true, sameSite: 'Lax' }]);
}

/**
 * #1335 — seeds and publishes a real v7.2 observed receipt for `handle`,
 * then issues its verification exactly the way `scoring_v7_issue_verification`
 * does for the `scoring-point` fixture handles: `scoring_observed_publish_receipt`
 * followed by `scoring_v7_issue_verification`, returning the same
 * `v7.<revisionId>.<hexSignature>` token the share page's verification strip
 * links to. Replaces the old hand-derived `computeImpactV6`/`buildPayload`/
 * `computeHash` v6 `verification_records` row: current receipt authenticity
 * (not a legacy hash) is what a live render of `handle` now independently
 * derives.
 */
export async function issueObservedVerification(
  db: SupabaseClient,
  handle: string,
  now: Date = new Date(),
): Promise<string> {
  const signing = process.env.CHAPA_VERIFICATION_SECRET;
  if (!signing) throw new Error('Explicit local verification secret required to pre-seed the read-only smoke probe record');
  const check = async <T extends { error: unknown }>(operation: PromiseLike<T>): Promise<T> => {
    const result = await operation;
    if (result.error) throw result.error;
    return result;
  };
  await check(db.rpc('scoring_v7_ensure_subject', { p_owner: handle }));
  const window = createScoringWindow(now.toISOString());
  const envelope = await observedReceiptFixture({ referenceTime: window.referenceTime, craft: { status: 'no_report', unlocked: false, report: null } });
  const receipt = envelope.receipt;
  const coreDigest = await canonicalSha256({ fixture: 'redesign-verification-v1', counts: receipt.inputs.counts });
  await check(db.rpc('scoring_observed_publish_receipt', {
    p_owner: handle, p_actor: handle, p_receipt: receipt, p_canonical: canonicalJson(receipt),
    p_semantic_digest: await observedSemanticIdentity(coreDigest, receipt.craft), p_core_semantic_digest: coreDigest,
  }));
  const signature = createHmac('sha256', signing).update(canonicalJson(receipt)).digest('hex');
  await check(db.rpc('scoring_v7_issue_verification', {
    p_owner: handle, p_actor: handle, p_revision: receipt.revisionId, p_key_version: 'v7-1',
    p_signature: signature, p_canonical: canonicalJson(receipt),
  }));
  return `v7.${receipt.revisionId}.${signature}`;
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
  // #1335 phase 5 — "Receipt binding mismatch" from
  // scoring_v7_issue_verification was traced to leftover scoring_v7_receipts/
  // scoring_v7_subjects rows from a PRIOR run of this same launcher: the
  // cleanup() below now withdraws every receiptOwner, which removes the root
  // cause. This retry is kept as cheap defense-in-depth against any other
  // transient PostgREST error shaped like the same message, not as the fix.
  const issueObservedVerificationRetrying = async (handle: string, now: Date): Promise<string> => {
    const isBindingMismatch = (error: unknown): boolean => {
      const message = error && typeof error === 'object' && 'message' in error ? String((error as { message: unknown }).message) : '';
      return message.includes('Receipt binding mismatch');
    };
    for (let attempt = 0; ; attempt++) {
      try {
        return await issueObservedVerification(db, handle, now);
      } catch (error) {
        if (attempt >= 2 || !isBindingMismatch(error)) throw error;
        await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
      }
    }
  };
  const existing = await check(db.from('users').select('handle').in('handle', [...REDESIGN_HANDLES]));
  if (existing.data?.length) throw new Error('Refusing to overwrite existing redesign users');
  const flags = await check(db.from('feature_flags').select('*').in('key', flagKeys));
  // #1335 phase 5 — octocat and REDESIGN_OWNERS now publish a real v7.2
  // receipt (issueObservedVerification*), same as the SCORING_POINT_HANDLES/
  // COLLECTION_QUEUE_HANDLES fixtures already do. Without an explicit
  // withdraw, scoring_v7_receipts/scoring_v7_subjects rows for these handles
  // never get cleaned (unlike users/studio_configs/etc. above), so a LATER
  // run's fresh publish for the SAME handle collides with the leftover row
  // and fails deterministically with "Receipt binding mismatch" -- this was
  // observed as a residue bug, not a transient flake, once octocat was no
  // longer the only owner receiving a receipt.
  const receiptOwners = ['octocat', ...REDESIGN_OWNERS];
  const cleanup = async () => {
    const errors: unknown[] = [];
    for (const owner of receiptOwners) await check(db.rpc('scoring_v7_withdraw', { p_owner: owner })).catch(error => errors.push(error));
    const tables = ['verification_records', 'user_platforms', 'studio_configs', 'metrics_snapshots', 'users'];
    for (const table of tables) {
      await check(db.from(table).delete().in('handle', [...REDESIGN_HANDLES])).catch(error => errors.push(error));
    }
    await check(db.from('feature_flags').delete().in('key', flagKeys)).catch(error => errors.push(error));
    if (flags.data?.length) await check(db.from('feature_flags').upsert(flags.data, { onConflict: 'key' })).catch(error => errors.push(error));
    for (const table of ['scoring_v7_subjects', 'scoring_v7_sources', 'scoring_v7_evidence', 'scoring_v7_raw_artifacts', 'scoring_v7_receipts', 'scoring_observed_current']) {
      await check(db.from(table).select('owner_handle').in('owner_handle', receiptOwners))
        .then(result => { if (result.data?.length) errors.push(new Error(`Redesign receipt residue in ${table}`)); })
        .catch(error => errors.push(error));
    }
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
    let octocatVerificationToken: string | null = null;
    for (const handle of REDESIGN_HANDLES) {
      const stats = makeFullStats({ ...DEMO_STATS, handle, displayName: handle, avatarUrl: '', linkedPlatforms: [], linkedPlatformLogins: {}, fetchedAt: new Date().toISOString() });
      const secret = process.env.NEXTAUTH_SECRET, token = process.env.GITHUB_TOKEN;
      if (!secret || token !== 'redesign-local-fixture') throw new Error('Explicit local fixture secrets/token required for bound stats');
      const referenceDate = stats.fetchedAt.slice(0, 10);
      cache[`stats:v3:${handle}`] = fixtureStatsCacheEntry(handle, referenceDate, secret, token, stats, new Date(stats.fetchedAt));
      cache[`stats:stale:v2:${handle}`] = JSON.stringify(stats);
      github[handle] = { data: { user: { login: handle, name: handle, avatarUrl: '', contributionsCollection: { contributionCalendar: { totalContributions: 0, weeks: [] }, pullRequestContributions: { totalCount: 0, nodes: [] }, pullRequestReviewContributions: { totalCount: 0 }, issueContributions: { totalCount: 0 } }, repositories: { totalCount: 0, nodes: [] } }, search: { issueCount: 0 } } };
      // #1279/#1335 — deployment-probes.ts `assertShareVerification` reads
      // octocat's share page as a read-only smoke probe (`__chapa_smoke=1`),
      // extracts the /verify/{token} link the live render produced, then
      // looks that exact token up via /api/verify. A v7.2 verification link
      // needs a published receipt to exist first — `runPublicProfileSideEffects`
      // only *persists* one when `readOnly` is false, and a read-only probe
      // never writes it. On a genuinely cold seed (no earlier non-read-only
      // render of /u/octocat to mint one first), that made the lookup 404
      // regardless of the stats-cache fix above. Pre-seed and publish a real
      // receipt via the same RPCs the scoring-point fixtures use, rather than
      // a hand-picked hash/scores.
      if (handle === 'octocat') {
        octocatVerificationToken = await issueObservedVerificationRetrying(handle, new Date(stats.fetchedAt));
      }
      // #1335 phase 5 — with v6 deleted there is no legacy stats-derived
      // fallback score any more: a handle with no registered scoring
      // subject/receipt renders the "unregistered" status placeholder (a
      // real <svg>, but with no archetype/score to draw) instead of a
      // computed badge. redesign-surfaces.spec.ts's Studio test asserts a
      // real archetype-bearing badge preview for each of REDESIGN_OWNERS
      // (owners viewing their OWN Studio), which a real production owner
      // always has via the OAuth callback's subject registration — these
      // synthetic fixture handles need the same v7.2 receipt octocat
      // already gets, or Studio has nothing to draw.
      if (REDESIGN_OWNERS.includes(handle)) {
        await issueObservedVerificationRetrying(handle, new Date(stats.fetchedAt));
      }
    }
    for (const handle of SCORING_POINT_HANDLES) github[handle] = buildRedesignGitHubFixture(handle, new Date().toISOString()).response;
    if (!octocatVerificationToken) throw new Error('octocat verification token was not derived');
    await writeFile(upstreamFile, JSON.stringify({ cache, github, journeyRunId: 'redesign', contributionQuery: CONTRIBUTION_QUERY, repositoryQuery: REPOSITORY_STATS_QUERY, avatarPng: (await readFile(resolve(__dirname, '../../public/logo-512.png'))).toString('base64') }));
    return { db, cleanup };
  } catch (error) {
    try { await cleanup(); } catch (cleanupError) { throw new AggregateError([error, cleanupError], 'Redesign bootstrap and cleanup failed'); }
    throw error;
  }
}
