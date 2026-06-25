# Research: Challenge My Score (Issue #933)

> Generated 2026-06-25. Documents what exists — no recommendations or design decisions.

---

## 1. Entry Point — ScoreExplanationPanel

**File:** `apps/web/components/dashboard/ScoreExplanationPanel.tsx`

The panel is a collapsible `<div className="rounded-xl bg-card shadow-card">` (line 103). It contains:

1. A toggle button (`aria-expanded`, `aria-controls`, chevron) — lines 104–137
2. Expanding body via `<div className="collapse-grid" data-expanded="...">` — lines 139–143
3. Inner `<div className="overflow-hidden">` → content with `border-t border-stroke px-4 py-5` — lines 144–145
4. Section: "Your score" (composite + breakdown) — lines 146–166
5. Section: dimension formulas + sub-metrics — lines 168–182
6. Section: data sources per platform — lines 184–224
7. `{isOwner && <section>...confidence...</section>}` — lines 226–264

**The panel currently ends at the closing `</div>` on line 268.** There is no CTA at the bottom. A new CTA section would slot between the confidence block close (`</section>`) and the outer content `</div>` close — specifically at line 265, after the `)}` that closes the `isOwner &&` block.

The `isOwner` boolean prop flows from `SharePageOwnerContent.tsx:100`:
```tsx
const isOwner = !loading && session?.login === handle;
```
and is passed to the panel at `SharePageOwnerContent.tsx:138`:
```tsx
<ScoreExplanationPanel impact={impact} stats={stats} isOwner={isOwner} />
```

The panel receives `impact: ImpactV6Result`, `stats: StatsData`, and `isOwner: boolean` — `stats.handle` carries the profile's GitHub handle.

---

## 2. Email / Contact Mechanisms

### Core module: `apps/web/lib/email/resend.ts`

- **`getResend()`** (lines 39–54): lazy singleton `new Resend(key)`. Returns `null` when `RESEND_API_KEY` is unset → callers fail-open.
- **`withTimeout`** wrapper from `@/lib/async/with-timeout` — used by all send calls with `EMAIL_SEND_TIMEOUT_MS`.
- All env reads go through `apps/web/lib/env.ts` accessors (no direct `process.env`):
  - `getResendApiKey()` — lines 236–238
  - `getResendWebhookSecret()` — lines 240–243
  - `getSupportForwardEmail()` — lines 245–248

### Sending pattern (from `apps/web/lib/email/notifications.ts`)

```ts
const resend = getResend();
if (!resend) return;

const to = getSupportForwardEmail();
if (!to) return;

const { error } = await withTimeout(
  resend.emails.send({
    from: "Chapa Notifications <notifications@chapa.thecreativetoken.com>",
    to: [to],
    subject,
    html,
    text,
  }),
  EMAIL_SEND_TIMEOUT_MS,
  "notifyFirstBadge",
);
if (error) {
  console.error("[email] notifyFirstBadge send failed:", error);
  return;
}
```

- `from` for transactional: `"Chapa Notifications <notifications@chapa.thecreativetoken.com>"` (`notifications.ts:90`)
- `from` for forwarded support email: `"Chapa Support <support@chapa.thecreativetoken.com>"` (`resend.ts:179`)
- `to` is always `[getSupportForwardEmail()]` for internal notifications
- Entire send is wrapped in try/catch; errors logged, never thrown

### Existing email routes

There is **no existing `/api/contact` or `/api/feedback` route.** The only inbound-user-contact flow is the Resend webhook forwarder (`/api/webhooks/resend/route.ts`), which handles inbound email from Resend's receive-email feature. That is entirely separate from a challenge submission.

All outbound email helpers (`notifications.ts`, `score-bump.ts`, `campaigns.ts`) are server-only (`import "server-only"` via `supabase.ts` in the db layer; email helpers are called only from API routes / cron).

---

## 3. Form Patterns

### Status state machine (canonical)

From `apps/web/components/SharePageOwnerContent.tsx:30` (`EmptyImpactState`):
```tsx
const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
```

Submission handler pattern (lines 32–47):
```tsx
async function handleRegenerate() {
  setStatus("loading");
  try {
    const res = await fetch("/api/...", { method: "POST" });
    if (res.ok) {
      setStatus("success");
    } else {
      setStatus("error");
    }
  } catch {
    setStatus("error");
  }
}
```

Button rendering (lines 56–69):
```tsx
<button
  type="button"
  disabled={status === "loading" || status === "success"}
  aria-busy={status === "loading"}
  className="... disabled:opacity-50 disabled:cursor-not-allowed"
>
  {status === "loading" ? "loading label"
   : status === "success" ? "success label"
   : "default label"}
</button>
```

Error display (lines 70–80):
```tsx
{status === "error" && (
  <p className="text-terminal-red text-xs">
    {errorMessage}{" "}
    <a href="mailto:...">contact link</a>
  </p>
)}
```

### Controlled input with validation (`apps/web/app/verify/VerifyForm.tsx`)

```tsx
const [value, setValue] = useState("");
const [error, setError] = useState("");

function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  const trimmed = value.trim();
  if (!isValid(trimmed)) {
    setError("validation message");
    return;
  }
  // proceed
}

<input
  aria-invalid={!!error}
  aria-describedby="field-error"
  onChange={(e) => { setValue(e.target.value); setError(""); }}
/>
{error && (
  <p id="field-error" role="alert" className="mt-2 text-sm text-terminal-red">
    {error}
  </p>
)}
```

### Textarea

No existing controlled `<textarea>` component exists in the codebase. The pattern would follow the same controlled-input approach as `VerifyForm.tsx` above.

### Auto-reset timer (from `apps/web/components/BadgeToolbar.tsx:58`)

```tsx
setTimeout(() => setStatus("idle"), 3000);
```

Used to reset error state back to idle after a delay, allowing the user to retry.

### Success / error feedback surfaces

Three options exist in the codebase:

**`apps/web/components/Toast.tsx`** — portal-rendered, floating, fixed-position.
- `createPortal(content, document.body)` with SSR guard (lines 116, 163)
- Props: `message`, `detail?`, `type: "loading"|"success"|"error"|"info"`, `duration` (default 4000ms, `0` = persistent), `onDismiss`
- Enter: `animate-scale-in`; exit: `animate-toast-out`
- `role={type === "error" ? "alert" : "status"}` with matching `aria-live`
- Used by `UserMenu.tsx` (complex multi-state, lines 762–770) and `BadgeToolbar.tsx` (simple error, lines 342–349)

**`apps/web/components/StatusCallout.tsx`** — inline `<section>`, non-portal, server-renderable.
- Variants: `success | error | warning | verification`
- Renders icon + title + description + children
- Appropriate for embedded feedback within an expanded panel

**`apps/web/components/ErrorBanner.tsx`** — fixed top-of-viewport `role="alert"` banner in `text-terminal-red`. Used for OAuth errors; not appropriate for form feedback.

---

## 4. Rate Limiting

### Helper: `apps/web/lib/cache/redis.ts` (lines 153–197)

```ts
export interface RateLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const redis = getRedis();
  if (!redis) return { allowed: true, current: 0, limit };  // fail-open

  try {
    const current = await redis.incr(key);
    if (current === 1) await redis.expire(key, windowSeconds);
    return { allowed: current <= limit, current, limit };
  } catch {
    return { allowed: true, current: 0, limit };  // fail-open
  }
}
```

Fail-open: always allows when Redis is unavailable.

### Existing rate limit key patterns

| Route | Key pattern | Limit | Window |
|-------|------------|-------|--------|
| `/api/generate` | `ratelimit:generate:<handle>` | 10 | 1h |
| `/api/refresh` | `ratelimit:refresh:<handle>` | 5 | 1h |
| `/api/supplemental` (IP) | `ratelimit:supplemental-ip:<ip>` | 10 | 1h |
| `/api/supplemental` (handle) | `ratelimit:supplemental:<handle>` | 10 | 24h |
| `/api/insights` (IP) | `ratelimit:insights-ip:<ip>` | 10 | 1h |
| `/api/insights` (handle) | `ratelimit:insights:<handle>` | 10 | 24h |
| `/api/studio/config` (PUT) | `ratelimit:config:<login>` | 30 | 1h |
| `/api/webhooks/resend` | (IP, limit 20, window 60s) | 20 | 60s |

### IP extraction pattern (from `/api/supplemental/route.ts:23–34`)

```ts
const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
const ipRl = await rateLimit(`ratelimit:supplemental-ip:${ip}`, 10, 3600);
if (!ipRl.allowed) {
  return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
}
```

### 429 response shape (canonical, from `/api/generate/route.ts:33–38`)

```ts
if (!rl.allowed) {
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    { status: 429, headers: { "Retry-After": "3600" } },
  );
}
```

---

## 5. API Route Conventions

From reading `supplemental/route.ts`, `generate/route.ts`, `refresh/route.ts`, `insights/route.ts`. All follow this sequence:

1. **`withErrorCapture("/api/<name>", async (request) => { ... })`** — analytics wrapper from `@/lib/analytics/server-errors`.
2. **Auth check** — `requireSession(request)` (returns `{ session, error }`; return `error` if present) OR `resolveRequestAuth(request)` for Bearer tokens.
3. **Feature-flag gate** (optional) — return 403 when disabled (`insights/route.ts:27–29`).
4. **IP rate limit** — before parsing body; key `ratelimit:<name>-ip:<ip>`.
5. **Body parsing** — size cap then `JSON.parse` with 413/400 fallbacks:
   ```ts
   const rawBody = await request.text();
   if (new TextEncoder().encode(rawBody).length > MAX_BYTES) {
     return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
   }
   const body = JSON.parse(rawBody);
   ```
6. **Field validation** — return 400 on missing/invalid fields.
7. **Per-handle rate limit** — after auth; key `ratelimit:<name>:<handle>`.
8. **Business logic / write**.
9. **Post-response side effects** — via `after(async () => { ... })` for non-blocking cache/DB ops.
10. **`return NextResponse.json({ success: true })`**.

All routes import from `@/lib/env` (not direct `process.env`) per the `no-process-env` ESLint rule.

---

## 6. i18n Patterns

### Dictionary structure

**Files:** `apps/web/lib/i18n/dictionaries/en.ts` (1139 lines) and `es.ts` (identical key tree).

The relevant existing section is `scoreExplanation` (lines 930–1031 in `en.ts`), under which a new `challenge` subsection would nest:

```ts
scoreExplanation: {
  toggle: "...",
  intro: "...",
  composite: { ... },
  dimensions: { ... },
  subMetrics: { ... },
  rawLabels: { ... },
  dataSources: { ... },
  confidence: { ... },
  // new: challenge: { ... }
}
```

### Adding keys

1. Add identical key path to both `en.ts` and `es.ts`.
2. Parity test (`apps/web/lib/i18n/dictionaries/parity.test.ts`) recursively compares all dotted leaf paths — it will fail if the two files diverge.
3. Empty-string leaf tests (lines 50–78) will fail if any value is `""`.
4. Use `interpolate(t("key") as string, { param: value })` for strings with `{param}` placeholders.
5. `as string` cast required when TypeScript infers `string | string[] | Record<string, unknown>[]`.

### Existing `scoreExplanation` keys adjacent to a challenge section

`confidence.reasons.*` has 9 keys (`burst_activity`, `micro_commit_pattern`, etc.) — pattern shows nested objects with multiple leaf strings are fine.

### Server vs client translation

- **Server components:** `import { getServerT } from '@/lib/i18n/server'`
- **Client components:** `const { t } = useTranslation()` (needs `LanguageProvider` ancestor)
- `ScoreExplanationPanel.tsx` is `"use client"` and uses `useTranslation()` — new keys in the panel follow the same pattern.

---

## 7. Supabase Storage

### Existing tables (summary)

No `score_challenges` or feedback table exists. The closest patterns for a simple submission table are:

**`supplemental_stats` (`supabase/migrations/024_create_supplemental_stats.sql`)**:
```sql
CREATE TABLE supplemental_stats (
  target_handle TEXT PRIMARY KEY,
  source_handle TEXT,
  stats JSONB,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);
```
Pattern: simple handle-keyed table, no UUID PK.

**`tool_insights` (`015_create_tool_insights.sql`)**:
```sql
CREATE TABLE tool_insights (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  handle TEXT,
  tool TEXT,
  raw_data JSONB,
  ...
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(handle, tool)
);
```
Pattern: auto-increment PK, handle + domain key, JSONB payload.

### RLS pattern for new tables

All tables follow:
1. Enable RLS: `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;`
2. Force RLS (bypasses ownership): `ALTER TABLE <name> FORCE ROW LEVEL SECURITY;`
3. Deny anon: `CREATE POLICY "deny_anon_<name>" ON <name> FOR ALL TO anon USING(false) WITH CHECK(false);`
4. App uses service role key exclusively — bypasses RLS by design.

### DB helper pattern (from `apps/web/lib/db/supplemental.ts`)

```ts
import "server-only";
import { getSupabase } from "./supabase";

export async function dbInsertChallenge(...): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;  // fail-open

  try {
    const { error } = await db.from("score_challenges").insert({ ... });
    if (error) {
      console.error("[db] dbInsertChallenge failed:", error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[db] dbInsertChallenge error:", (error as Error).message);
    return false;
  }
}
```

Migration numbering: current highest is `026_...sql`. A new table would use `027_...sql`.

---

## 8. Design System — Relevant Tokens and Patterns

### Button styles

**Primary (amber/purple):**
```
rounded-lg bg-amber px-4 py-2 text-sm font-semibold text-white
hover:bg-amber-light disabled:opacity-50 disabled:cursor-not-allowed
transition-all motion-reduce:transition-none
```

**Ghost/outline:**
```
rounded-lg border border-stroke px-4 py-2 text-sm text-text-secondary
transition-colors hover:border-amber/20 hover:text-text-primary disabled:opacity-50
```
(From `ConfirmDialog.tsx:71–79`)

### Textarea/input visual style (from `VerifyForm.tsx`)

```
rounded-lg border border-stroke bg-track/40 px-4 py-3 text-sm text-text-primary
placeholder:text-text-secondary/60 focus:outline-none focus:border-amber/40
font-body w-full
```

### Panel section spacing

Within the panel, sections use `space-y-6` (outer), items use `space-y-3`. A CTA section at the bottom matches the `border-t border-stroke pt-6` pattern established by the panel's inner content separator.

### Animations

| Class | Effect | When to use |
|-------|--------|------------|
| `animate-scale-in` | Scale from 0.92 + fade | Toast enter, modal appear |
| `animate-fade-in-up` | Fade up 30px | Section reveal |
| `animate-toast-out` | Scale to 0.95 + fade | Toast exit |
| `motion-reduce:animate-none` | Disable for accessibility | All animated elements |

### Collapse/expand utility (`.collapse-grid`, `globals.css:522–534`)

```css
.collapse-grid {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.2s ease-out;
}
.collapse-grid[data-expanded="true"] {
  grid-template-rows: 1fr;
}
```
Driven by `data-expanded="true"|"false"`. The ScoreExplanationPanel itself uses this for its outer expand. A nested form could use the same utility to slide open after the CTA is clicked — nesting `.collapse-grid` inside another `.collapse-grid` is not blocked by CSS but would need a separate `useState` to control `data-expanded`.

### Error/success color tokens

- Errors: `text-terminal-red`, `border-terminal-red/30`, `bg-terminal-red/10`
- Success: `text-terminal-green`
- Info/neutral: `text-text-secondary`

---

## 9. Modal/Dialog Pattern (ConfirmDialog)

**File:** `apps/web/components/ConfirmDialog.tsx`

The only modal in the app uses the native `<dialog>` element:
- `dialog.showModal()` called in `useEffect` when `open` prop flips true (lines 31–42)
- `role="alertdialog"`, `aria-labelledby`, `aria-describedby`, `onClose={onCancel}` (Escape key works natively)
- Styling: `m-auto max-w-sm w-full rounded-2xl border border-stroke bg-card p-6 shadow-xl backdrop:bg-black/50`
- Used by `UserMenu.tsx` for destructive confirmation dialogs (e.g. platform unlink)
- No Radix UI, Headless UI, or third-party dialog libraries

Usage pattern (from `UserMenu.tsx:729–761`):
```tsx
const [showConfirm, setShowConfirm] = useState(false);

<button onClick={() => setShowConfirm(true)}>Trigger</button>
<ConfirmDialog
  open={showConfirm}
  loading={submitting}
  onConfirm={handleConfirm}
  onCancel={() => setShowConfirm(false)}
  title="..."
  description="..."
/>
```

The dialog is NOT appropriate for the challenge form — it is designed for binary confirm/cancel decisions. A `ConfirmDialog` would need to be extended or a separate form dialog created.

---

## 10. Authentication & Ownership Context

`ScoreExplanationPanel` receives `isOwner: boolean` from `SharePageOwnerContent`. This value is derived client-side from `useSession()` and `session?.login === handle`. The challenge CTA is gated behind `isOwner` in the existing panel structure (confidence section pattern).

The `handle` of the profile is available via:
- `stats.handle` (from `StatsData`)
- The parent page URL parameter passed through to `SharePageOwnerContent`

For the API route, ownership would be verified server-side via `requireSession(request)` and comparing `session.login.toLowerCase()` to the submitted handle — same pattern as `supplemental/route.ts:77–78`:
```ts
if (session.login.toLowerCase() !== body.handle.toLowerCase()) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
}
```

---

## File Reference Map

| Area | File |
|------|------|
| Panel component | `apps/web/components/dashboard/ScoreExplanationPanel.tsx` |
| Panel wire-up | `apps/web/components/SharePageOwnerContent.tsx:138` |
| Score explanation logic | `apps/web/lib/dashboard/score-explanation.ts` |
| Email helper (pattern) | `apps/web/lib/email/notifications.ts` |
| Resend core | `apps/web/lib/email/resend.ts` |
| Env accessors | `apps/web/lib/env.ts:236–248` |
| Rate limiter | `apps/web/lib/cache/redis.ts:153–197` |
| API route pattern | `apps/web/app/api/supplemental/route.ts` |
| Form status pattern | `apps/web/components/SharePageOwnerContent.tsx:28–85` |
| Controlled input pattern | `apps/web/app/verify/VerifyForm.tsx` |
| Toast component | `apps/web/components/Toast.tsx` |
| Inline callout | `apps/web/components/StatusCallout.tsx` |
| Modal pattern | `apps/web/components/ConfirmDialog.tsx` |
| i18n en dict | `apps/web/lib/i18n/dictionaries/en.ts:930–1031` |
| i18n es dict | `apps/web/lib/i18n/dictionaries/es.ts` (same key tree) |
| Parity test | `apps/web/lib/i18n/dictionaries/parity.test.ts` |
| Animation tokens | `apps/web/styles/globals.css:218–432` |
| Collapse utility | `apps/web/styles/globals.css:522–534` |
| Supabase client | `apps/web/lib/db/supabase.ts` |
| DB helper pattern | `apps/web/lib/db/supplemental.ts` |
| Migrations dir | `supabase/migrations/` (026 is highest) |
