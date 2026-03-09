# Phase 4: Upload Flow Integration

> Rewrite the insights upload flow in `UserMenu.tsx` to use Toast for visible progress and `POST /api/recalculate` for immediate score feedback.

## Objective

Replace the invisible upload flow (status text inside closed dropdown, no score feedback) with a Toast-based progress flow that shows processing state, calls the recalculate endpoint after upload, and displays the score delta before reloading.

## Changes

### 4.1 — Rewrite `handleInsightsFile` in `UserMenu.tsx` (`apps/web/components/UserMenu.tsx`)

Replace the current handler (lines 62-96) with a Toast-based flow:

```typescript
// NEW STATE — replace insightsStatus with toast state
const [toast, setToast] = useState<{
  message: string;
  detail?: string;
  type: "loading" | "success" | "error" | "info";
} | null>(null);

async function handleInsightsFile(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  e.target.value = ""; // Reset so same file can be re-selected

  if (file.size > 10 * 1024 * 1024) {
    setToast({ message: "File too large", detail: "Maximum size is 10 MB", type: "error" });
    return;
  }

  // Close dropdown immediately — Toast is visible outside it
  setOpen(false);

  // Step 1: Show processing toast
  setToast({ message: "Processing report…", type: "loading" });

  try {
    // Step 2: Parse HTML
    const html = await file.text();
    const { parseInsightsHtml } = await import("@/lib/insights/parser");
    const data = parseInsightsHtml(html);

    // Step 3: Upload to /api/insights
    const uploadRes = await fetch("/api/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!uploadRes.ok) throw new Error("Upload failed");
    const uploadData = await uploadRes.json();

    // Step 4: Update toast — uploading complete, now recalculating
    setToast({ message: "Recalculating score…", type: "loading" });

    // Step 5: Call recalculate to get the new score
    const recalcRes = await fetch("/api/recalculate", { method: "POST" });

    if (recalcRes.ok) {
      const recalcData = await recalcRes.json();
      const craftScore = uploadData.craftScore?.craftScore ?? recalcData.craftScore;
      const craftTier = uploadData.craftScore?.tier ?? recalcData.craftTier;
      const newScore = recalcData.adjustedComposite;

      // Step 6: Show success toast with score info
      setToast({
        message: `Craft: ${craftScore} ${craftTier}`,
        detail: `Score updated to ${newScore}`,
        type: "success",
      });
    } else {
      // Recalculate failed — still show craft upload success
      const craftScore = uploadData.craftScore?.craftScore;
      const craftTier = uploadData.craftScore?.tier;
      setToast({
        message: craftScore
          ? `Craft: ${craftScore} ${craftTier}`
          : "Insights uploaded",
        detail: "Score will update on next badge view",
        type: "success",
      });
    }

    // Step 7: Reload after user sees the toast
    setTimeout(() => window.location.reload(), 2500);
  } catch {
    setToast({ message: "Import failed", detail: "Please try again", type: "error" });
  }
}
```

### 4.2 — Render Toast in JSX (`UserMenu.tsx`)

Add Toast rendering at the end of the component's return, outside the dropdown:

```typescript
// Add import at top of file
import { Toast } from "./Toast";

// Add AFTER the ConfirmDialog components, still inside the outer <div>:
{toast && (
  <Toast
    message={toast.message}
    detail={toast.detail}
    type={toast.type}
    duration={toast.type === "loading" ? 0 : toast.type === "error" ? 5000 : 4000}
    onDismiss={() => setToast(null)}
  />
)}
```

### 4.3 — Remove old `insightsStatus` state

Remove:
```typescript
// DELETE — old state (line 58-60)
const [insightsStatus, setInsightsStatus] = useState<
  "idle" | "processing" | "success" | "error"
>("idle");
```

And remove the status text from the label (lines 309-312):
```typescript
// BEFORE — status text inside label
{insightsStatus === "idle" && "Import Claude Code Insights"}
{insightsStatus === "processing" && "Processing…"}
{insightsStatus === "success" && "Uploaded!"}
{insightsStatus === "error" && "Import failed — try again"}

// AFTER — always show the label text (status is in the Toast now)
Import Claude Code Insights
```

### 4.4 — Update `docs/impact-v6.md`

Add a new section after "## Scoring Pipeline":

```markdown
## Score Recalculation

Deliberate user actions (insights upload, platform connect) trigger immediate score recalculation via `POST /api/recalculate`. This endpoint:

1. Fetches stats (cache-first)
2. Reads craft score from DB (latest uploaded insights)
3. Computes fresh impact with `computeImpactV4(stats, craftScore)`
4. Uses the raw `adjustedComposite` — NO EMA smoothing (deliberate action bypass)
5. Replaces today's snapshot via `dbReplaceSnapshot` (upsert, not ignore-duplicate)
6. Updates the Redis snapshot cache

This ensures that after an insights upload, the badge and share page immediately reflect the new score. EMA smoothing continues to apply for passive badge views where GitHub stats change organically.

### Upload Flow

```
File selected → Toast: "Processing report…"
             → POST /api/insights (craft score computed + stored)
             → Toast: "Recalculating score…"
             → POST /api/recalculate (fresh impact, snapshot replaced)
             → Toast: "Craft: 69 Expert · Score updated to 61 ✓"
             → Page reloads (2.5s delay for user to read toast)
```

Rate limits: insights upload 10/day, recalculate 20/hour.
```

### 4.5 — Tests (`apps/web/components/UserMenu.test.tsx`)

Add new `describe` blocks to the existing source-analysis test file:

```typescript
describe("UserMenu — insights upload with Toast", () => {
  it("imports Toast component", () => {
    expect(SOURCE).toContain('import { Toast } from "./Toast"');
  });

  it("renders Toast component conditionally on toast state", () => {
    expect(SOURCE).toContain("{toast && (");
    expect(SOURCE).toContain("<Toast");
  });

  it("Toast receives message, detail, type, duration, and onDismiss props", () => {
    expect(SOURCE).toContain("message={toast.message}");
    expect(SOURCE).toContain("detail={toast.detail}");
    expect(SOURCE).toContain("type={toast.type}");
    expect(SOURCE).toContain("onDismiss={");
  });

  it("loading toast has duration=0 (persistent until state changes)", () => {
    expect(SOURCE).toContain('toast.type === "loading" ? 0');
  });

  it("calls /api/recalculate after successful upload", () => {
    expect(SOURCE).toContain('"/api/recalculate"');
    expect(SOURCE).toContain("method: \"POST\"");
  });

  it("shows craft score and tier in success toast", () => {
    const fnStart = SOURCE.indexOf("async function handleInsightsFile");
    const fnEnd = SOURCE.indexOf("// Close dropdown") > -1
      ? SOURCE.indexOf("setTimeout(() => window.location.reload()")
      : SOURCE.length;
    const fnBody = SOURCE.slice(fnStart, fnEnd);
    expect(fnBody).toContain("craftScore");
    expect(fnBody).toContain("craftTier");
  });

  it("reloads page after showing success toast", () => {
    expect(SOURCE).toContain("window.location.reload()");
  });

  it("does NOT use insightsStatus state (replaced by toast state)", () => {
    expect(SOURCE).not.toContain("insightsStatus");
    expect(SOURCE).not.toContain("setInsightsStatus");
  });

  it("menu label always shows 'Import Claude Code Insights' (no inline status)", () => {
    // The old pattern had conditional text inside the label
    expect(SOURCE).not.toContain('"Processing…"');
    expect(SOURCE).not.toContain('"Uploaded!"');
  });

  it("shows error toast for oversized files", () => {
    const fnStart = SOURCE.indexOf("async function handleInsightsFile");
    const fnEnd = SOURCE.indexOf("setOpen(false)", SOURCE.indexOf("async function handleInsightsFile"));
    const fnBody = SOURCE.slice(fnStart, fnEnd);
    expect(fnBody).toContain("File too large");
  });

  it("shows error toast when upload fails", () => {
    expect(SOURCE).toContain("Import failed");
  });

  it("handles recalculate failure gracefully (still shows upload success)", () => {
    expect(SOURCE).toContain("Score will update on next badge view");
  });
});
```

### 4.6 — Update insights route test (`apps/web/app/api/insights/route.test.ts`)

Add a test verifying snapshot cache invalidation (from Phase 3's insights fix):

```typescript
it("invalidates snapshot cache after successful upload", async () => {
  // ... setup with valid upload ...
  await POST(makeRequest(validBody));
  await flushAfterCallbacks();

  expect(invalidateSnapshotCache).toHaveBeenCalledWith("testuser");
});
```

## Tests

### New tests (UserMenu upload flow):
1. Toast component imported
2. Toast rendered conditionally on toast state
3. Toast receives correct props (message, detail, type, duration, onDismiss)
4. Loading toast is persistent (duration=0)
5. Calls `/api/recalculate` after upload
6. Shows craft score and tier in success toast
7. Page reloads after success
8. Old `insightsStatus` state removed
9. Menu label is static (no inline status text)
10. Error toast for oversized files
11. Error toast for upload failure
12. Graceful recalculate failure (still shows upload success)

### Modified tests (insights route):
1. Verify `invalidateSnapshotCache` called after upload

### Unchanged tests:
- All existing UserMenu tests (admin, Bitbucket, Codeberg, platform cache)
- All existing insights route tests
- All existing badge route tests

## Verification

```bash
pnpm run typecheck 2>&1; pnpm run lint 2>&1; pnpm run test -- UserMenu 2>&1; pnpm run test -- insights/route 2>&1
```

## Success Criteria

### Automated
- [x] Toast component imported and rendered outside dropdown
- [x] `handleInsightsFile` calls `/api/recalculate` after successful `/api/insights`
- [x] 3-stage toast flow: processing → recalculating → success with score
- [x] Success toast shows craft score, tier, and new adjusted composite
- [x] Recalculate failure is non-fatal (fallback message, still reloads)
- [x] Error toast for oversized files and upload failures
- [x] Old `insightsStatus` state and inline status text removed
- [x] Loading toast is persistent (duration=0), success/error auto-dismiss
- [x] Page reloads after 2.5s delay (time for user to read toast)

### Manual
- [ ] Upload insights report → see toast with progress outside dropdown
- [ ] Toast shows "Processing report…" → "Recalculating score…" → "Craft: X Tier · Score updated to Y"
- [ ] Badge shows updated score after reload
