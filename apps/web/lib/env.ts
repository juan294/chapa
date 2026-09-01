/**
 * Centralized environment-variable accessors.
 *
 * All reads go through this module so that:
 *   - whitespace trimming happens exactly once per variable
 *   - types are explicit (string | undefined, boolean, string[])
 *   - callers never scatter `?.trim()` logic throughout the codebase
 *
 * ESLint `no-restricted-syntax` enforces that direct `process.env.UPPERCASE`
 * reads are disallowed everywhere except this file.
 */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function readTrimmed(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

/**
 * Trim a raw env value, collapsing empty strings to `undefined`.
 *
 * Used for `NEXT_PUBLIC_*` readers, which MUST reference `process.env.X` as a
 * static literal at the call site. Next.js only inlines public env vars into the
 * client bundle for literal member expressions — dynamic access (the `name`
 * argument to {@link readTrimmed}) is never substituted and returns `undefined`
 * in the browser, silently disabling client-side feature flags (#918).
 */
function clean(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
}

function readBool(name: string): boolean {
  return readTrimmed(name) === "true";
}

function readList(name: string): string[] {
  const v = readTrimmed(name);
  return v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

/** Comma-separated list of admin GitHub handles (server-side only). */
export function getAdminHandles(): string[] {
  return readList("ADMIN_HANDLES");
}

/** Shared secret for admin API authentication. */
export function getAdminSecret(): string | undefined {
  return readTrimmed("ADMIN_SECRET");
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

/** Allow agent runs outside development mode (`"true"` to enable). */
export function getAllowAgentRun(): boolean {
  return readBool("ALLOW_AGENT_RUN");
}

// ---------------------------------------------------------------------------
// Analytics / Monitoring
// ---------------------------------------------------------------------------

/** Webhook URL for operational alerts (Discord/Slack/custom). */
export function getChapaAlertWebhookUrl(): string | undefined {
  return readTrimmed("CHAPA_ALERT_WEBHOOK_URL");
}

/** PostHog host URL (e.g. `https://app.posthog.com`). */
export function getPosthogHost(): string | undefined {
  return clean(process.env.NEXT_PUBLIC_POSTHOG_HOST);
}

/** PostHog project API key. */
export function getPosthogKey(): string | undefined {
  return clean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/** HMAC secret for badge verification codes. */
export function getChapaVerificationSecret(): string | undefined {
  return readTrimmed("CHAPA_VERIFICATION_SECRET");
}

/** Shared secret for Vercel cron invocation authentication. */
export function getCronSecret(): string | undefined {
  return readTrimmed("CRON_SECRET");
}

/** GitHub OAuth app client ID. */
export function getGithubClientId(): string | undefined {
  return readTrimmed("GITHUB_CLIENT_ID");
}

/** GitHub OAuth app client secret. */
export function getGithubClientSecret(): string | undefined {
  return readTrimmed("GITHUB_CLIENT_SECRET");
}

/** Server-side GitHub personal access token for API calls without a user session. */
export function getGithubToken(): string | undefined {
  return readTrimmed("GITHUB_TOKEN");
}

/** Secret key used to encrypt session cookies and tokens (min 32 chars in production). */
export function getNextauthSecret(): string | undefined {
  return readTrimmed("NEXTAUTH_SECRET");
}

// ---------------------------------------------------------------------------
// Base URL
// ---------------------------------------------------------------------------

/**
 * Application base URL.
 *
 * Reads NEXT_PUBLIC_BASE_URL from the environment, trims whitespace, and
 * falls back to the production domain when the variable is unset or empty.
 */
export function getBaseUrl(): string {
  return (
    clean(process.env.NEXT_PUBLIC_BASE_URL) ??
    "https://chapa.thecreativetoken.com"
  );
}

// ---------------------------------------------------------------------------
// Bitbucket
// ---------------------------------------------------------------------------

/** Bitbucket OAuth consumer client ID. */
export function getBitbucketClientId(): string | undefined {
  return readTrimmed("BITBUCKET_CLIENT_ID");
}

/** Bitbucket OAuth consumer client secret. */
export function getBitbucketClientSecret(): string | undefined {
  return readTrimmed("BITBUCKET_CLIENT_SECRET");
}

/** Raw `NEXT_PUBLIC_BITBUCKET_ENABLED` value — `"true"` when Bitbucket integration is on. */
export function getBitbucketEnabledEnv(): string | undefined {
  return clean(process.env.NEXT_PUBLIC_BITBUCKET_ENABLED);
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

/** Upstash Redis REST API token. */
export function getUpstashRedisRestToken(): string | undefined {
  return readTrimmed("UPSTASH_REDIS_REST_TOKEN");
}

/** Upstash Redis REST API URL. */
export function getUpstashRedisRestUrl(): string | undefined {
  return readTrimmed("UPSTASH_REDIS_REST_URL");
}

// ---------------------------------------------------------------------------
// Codeberg
// ---------------------------------------------------------------------------

/** Codeberg (Forgejo) OAuth app client ID. */
export function getCodebergClientId(): string | undefined {
  return readTrimmed("CODEBERG_CLIENT_ID");
}

/** Codeberg (Forgejo) OAuth app client secret. */
export function getCodebergClientSecret(): string | undefined {
  return readTrimmed("CODEBERG_CLIENT_SECRET");
}

/** Raw `NEXT_PUBLIC_CODEBERG_ENABLED` value — `"true"` when Codeberg integration is on. */
export function getCodebergEnabledEnv(): string | undefined {
  return clean(process.env.NEXT_PUBLIC_CODEBERG_ENABLED);
}

// ---------------------------------------------------------------------------
// GitLab
// ---------------------------------------------------------------------------

/** GitLab OAuth app client ID. */
export function getGitlabClientId(): string | undefined {
  return readTrimmed("GITLAB_CLIENT_ID");
}

/** GitLab OAuth app client secret. */
export function getGitlabClientSecret(): string | undefined {
  return readTrimmed("GITLAB_CLIENT_SECRET");
}

/** Raw `NEXT_PUBLIC_GITLAB_ENABLED` value — `"true"` when GitLab integration is on. */
export function getGitlabEnabledEnv(): string | undefined {
  return clean(process.env.NEXT_PUBLIC_GITLAB_ENABLED);
}

// ---------------------------------------------------------------------------
// Cron
// ---------------------------------------------------------------------------

/** Comma-separated list of handles to prioritise in every warm-cache run. */
export function getWarmCachePriorityHandles(): string[] {
  return Array.from(new Set(readList("WARM_CACHE_PRIORITY_HANDLES")));
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

/** Supabase project service role key (bypasses RLS — server-side only). */
export function getSupabaseServiceRoleKey(): string | undefined {
  return readTrimmed("SUPABASE_SERVICE_ROLE_KEY");
}

/** Supabase project URL. */
export function getSupabaseUrl(): string | undefined {
  return readTrimmed("SUPABASE_URL");
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

/** Resend API key for sending transactional email. */
export function getResendApiKey(): string | undefined {
  return readTrimmed("RESEND_API_KEY");
}

/** Svix webhook signing secret for verifying Resend webhook deliveries. */
export function getResendWebhookSecret(): string | undefined {
  return readTrimmed("RESEND_WEBHOOK_SECRET");
}

/** Gmail/email address to forward inbound support emails to. */
export function getSupportForwardEmail(): string | undefined {
  return readTrimmed("SUPPORT_FORWARD_EMAIL");
}

// ---------------------------------------------------------------------------
// Feature flags (raw env-var values passed to DB-backed checkFlag)
// ---------------------------------------------------------------------------

/** Raw `NEXT_PUBLIC_EXPERIMENTS_ENABLED` value — `"true"` when experiments page is on. */
export function getExperimentsEnabledEnv(): string | undefined {
  return clean(process.env.NEXT_PUBLIC_EXPERIMENTS_ENABLED);
}

/** Raw `NEXT_PUBLIC_INSIGHTS_ENABLED` value — `"true"` when AI Insights integration is on. */
export function getInsightsEnabledEnv(): string | undefined {
  return clean(process.env.NEXT_PUBLIC_INSIGHTS_ENABLED);
}

/** Raw `MCP_SERVER_ENABLED` value — server-only fallback for the remote MCP endpoint. */
export function getMcpServerEnabledEnv(): string | undefined {
  return readTrimmed("MCP_SERVER_ENABLED");
}

/** OpenAI plugin domain-verification token (server-side only). */
export function getOpenaiAppsChallengeToken(): string | undefined {
  return readTrimmed("OPENAI_APPS_CHALLENGE_TOKEN");
}

/** Raw `NEXT_PUBLIC_STUDIO_ENABLED` value — `"true"` when Creator Studio is on. */
export function getStudioEnabledEnv(): string | undefined {
  return clean(process.env.NEXT_PUBLIC_STUDIO_ENABLED);
}

/** Raw `NEXT_PUBLIC_STUDIO_DEMO_ENABLED` value — `"true"` when Studio demo mode is on. */
export function getStudioDemoEnabledEnv(): string | undefined {
  return clean(process.env.NEXT_PUBLIC_STUDIO_DEMO_ENABLED);
}

/** Raw `NEXT_PUBLIC_WEBMCP_ENABLED` value — `"true"` when WebMCP registration is on. */
export function getWebmcpEnabledEnv(): string | undefined {
  return clean(process.env.NEXT_PUBLIC_WEBMCP_ENABLED);
}

// ---------------------------------------------------------------------------
// Runtime
// ---------------------------------------------------------------------------

/** Node.js environment — `"development"`, `"production"`, or `"test"`. */
export function getNodeEnv(): string {
  return readTrimmed("NODE_ENV") ?? "development";
}

/** Vercel deployment environment — `"production"`, `"preview"`, or `"development"`. */
export function getVercelEnv(): string | undefined {
  return readTrimmed("VERCEL_ENV");
}

/** Immutable source commit exposed by Vercel for the current deployment. */
export function getVercelGitCommitSha(): string | undefined {
  return readTrimmed("VERCEL_GIT_COMMIT_SHA");
}
