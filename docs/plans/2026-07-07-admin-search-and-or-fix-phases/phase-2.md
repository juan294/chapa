# Phase 2: Apply the fix, retarget mock unit tests (GREEN)

**Batch-eligible:** No (depends on Phase 1's contract test existing so this phase can turn it green).

## Goal

Restore OR semantics in the search filter, and update the existing mock-based unit tests so they assert against the new `.or()` call shape instead of the old two-`.ilike()` shape.

## Change 1 — the fix itself

File: `apps/web/lib/db/admin-users.ts:212-215`

```diff
     if (query.search?.trim()) {
       const term = escapeIlike(query.search.trim());
-      q = q.ilike("handle", `%${term}%`).ilike("display_name", `%${term}%`);
+      q = q.or(`handle.ilike.%${term}%,display_name.ilike.%${term}%`);
     }
```

Also update the comment directly above (currently reads "Search filter: ILIKE on handle and display_name." — written for the buggy AND version) back to describing OR, and simplify/remove the now-stale rationale about why chained `.ilike()` was chosen (it's no longer used):

```diff
-    // Search filter: ILIKE on handle and display_name.
-    // Uses chained .ilike() builder calls (parameterized) instead of raw
-    // .or() string interpolation to prevent SQL wildcard abuse (_ and %)
-    // and PostgREST delimiter injection (, . ( )).
+    // Search filter: ILIKE on handle OR display_name. The term is run through
+    // escapeIlike() first, which strips PostgREST filter-string delimiters
+    // and escapes SQL wildcards, so it's safe to interpolate into .or().
```

No changes needed to `escapeIlike()` itself (`admin-users.ts:170-174`) — it already produces a string safe for this interpolation; it just wasn't being used with `.or()`.

## Change 2 — retarget existing mock unit tests

File: `apps/web/lib/db/admin-users.test.ts`

The four tests at lines 179, 188, 198, 207 currently assert against `mockIlike` being called twice (once per column). After the fix, the code makes a single `mockOr` call with both conditions pre-interpolated into one string. Update each:

```diff
   it("applies search filter with ILIKE on handle and display_name", async () => {
     terminalResolve = { data: [], error: null, count: 0 };

     await dbGetAdminUsers(defaultQuery({ search: "alice" }));

-    expect(mockIlike).toHaveBeenCalledWith("handle", "%alice%");
-    expect(mockIlike).toHaveBeenCalledWith("display_name", "%alice%");
+    expect(mockOr).toHaveBeenCalledWith("handle.ilike.%alice%,display_name.ilike.%alice%");
   });

   it("escapes underscore SQL wildcard in search terms (BE-H5)", async () => {
     terminalResolve = { data: [], error: null, count: 0 };

     await dbGetAdminUsers(defaultQuery({ search: "alice_b" }));

     // _ must be escaped so it matches a literal underscore, not any character
-    expect(mockIlike).toHaveBeenCalledWith("handle", "%alice\\_b%");
-    expect(mockIlike).toHaveBeenCalledWith("display_name", "%alice\\_b%");
+    expect(mockOr).toHaveBeenCalledWith(
+      "handle.ilike.%alice\\_b%,display_name.ilike.%alice\\_b%",
+    );
   });

   it("escapes backslash in search terms to prevent wildcard bypass (BE-H5)", async () => {
     terminalResolve = { data: [], error: null, count: 0 };

     await dbGetAdminUsers(defaultQuery({ search: "alice\\b" }));

-    expect(mockIlike).toHaveBeenCalledWith("handle", "%alice\\\\b%");
-    expect(mockIlike).toHaveBeenCalledWith("display_name", "%alice\\\\b%");
+    expect(mockOr).toHaveBeenCalledWith(
+      "handle.ilike.%alice\\\\b%,display_name.ilike.%alice\\\\b%",
+    );
   });

   it("strips PostgREST delimiter characters from search terms to prevent predicate injection (BE-H5)", async () => {
     terminalResolve = { data: [], error: null, count: 0 };

     // A crafted injection attempt: ,handle.eq.juan)
     await dbGetAdminUsers(defaultQuery({ search: ",handle.eq.juan)" }));

     // The delimiters , . ( ) must be stripped so no injection occurs
-    const calls = mockIlike.mock.calls;
+    const calls = mockOr.mock.calls;
     expect(calls.length).toBeGreaterThan(0);
-    for (const [, pattern] of calls) {
-      expect(pattern).not.toContain(",");
-      expect(pattern).not.toContain("(");
-      expect(pattern).not.toContain(")");
-    }
+    const [filterString] = calls[0];
+    // The literal comma between the two OR clauses is expected and safe —
+    // only characters coming from the user-supplied term must be absent.
+    // "handle.eq.juan" (the injected clause) must not appear as a distinct
+    // predicate; the whole term collapses into the ilike value instead.
+    expect(filterString).not.toContain("handle.eq.juan)");
+    expect(filterString).not.toContain("(");
+    expect(filterString).not.toContain(")");
   }); 
```

Note on the last test: since the injection-attempt case now produces a single `.or()` string that legitimately *contains* commas (as the OR separator between the two real clauses), the assertion must check that the *injected* delimiter characters from the user's term are gone (no stray `(`/`)`, and the crafted `handle.eq.juan)` predicate does not appear as its own clause) rather than blanket-asserting no comma anywhere in the string.

`mockOr` (`admin-users.test.ts:8`) is already declared and wired into `chainBuilder()`'s `chain.or` (`:20-23`), and already used elsewhere in the file (e.g. `expect(mockOr).not.toHaveBeenCalled()` at `:367`, in the whitespace-only-search test) — no new mock scaffolding is needed, only retargeting the four assertions above from `mockIlike` to `mockOr`.

## Automated success criteria

- `pnpm run test:contract` — the three tests added in Phase 1 all pass (first two flip from RED to GREEN; the sanity no-match case stays GREEN).
- `pnpm run test` — all `admin-users.test.ts` tests pass, including the four retargeted ones.
- `pnpm run typecheck` and `pnpm run lint` pass with no new errors.

## Manual success criteria

None yet (covered in Phase 3, which includes the live UI check).
