# Phase 7: production rollout (authorization-gated)

Parent plan: `../2026-09-23-universal-v72-reliable-collection.md`. Depends on phases 1-6 being merged into `develop` with every local gate green. Not batch-eligible.

**Every numbered step below is a production action.** Each needs its own explicit owner authorization when it is run. A green previous step does not authorize the next one. Ordering follows `docs/release/release-playbook.md` and `docs/runbooks/migrations.md`:
- Migrations are applied before the code that depends on them goes live (`migrations.md:122`).
- Destructive changes are contracted only after the release (`migrations.md:203-215`).
- PR creation, merge and tag are separate authorizations. A release PR is a merge commit, never a squash.

## Pre-state (recorded 2026-09-23)

| Item | State |
|---|---|
| `scoring_v7_rendering` | `true` since 09:57:16Z |
| `scoring_v7_subjects` | 1 row (juan294, consent recorded 10:03:23Z) |
| `scoring_v7_receipts` | 0 rows |
| juan294 source observations | 4 |
| Running release | v3.0.3 (`ede8f57e`) |

## Steps

### 7.1 Expand migrations (authorization: "apply migrations 054-057 to production")

1. Read-only check: `supabase migration list --linked` shows 001-053 applied and 054-057 pending.
2. Apply the migrations in order, following the migrations runbook. All four are additive or compatible with the running v3.0.3:
   - 054: consent predicates removed; subjects backfilled with consent `true`.
   - 055: queue tables.
   - 056: status/fan-in.
   - 057: flag held `true`.
3. Read back:
   - No function references consent.
   - Every `user_platforms` github handle has a subject.
   - The queue tables exist.
4. Smoke the running v3.0.3 read-only: `/api/health` ok, and the badge, share page and `/api/profile` for juan294 return 200.

### 7.2 Release (authorizations: PR, then merge, then tag)

- Release PR `develop` → `main` as a merge commit, following the playbook admission gates.
- Production identity: `/api/version` `commitSha` equals the merge commit.
- `/api/health` includes the `scoringQueue` block and the `collect-evidence` heartbeat within 15 minutes of the deploy.

### 7.3 Enqueue everyone (authorization: "enqueue collection for all signed-up users")

- Run the admin enqueue: bulk-recalculate, now calling `enqueueCollection(reason:"admin")`, for every handle with a `user_platforms` github row.
- Watch the `scoringQueue` block and the job rows. Expected: juan294 converges over several ticks. A rate-limit pause shows as `waiting_rate_limit` with a resume time, never as failed.

### 7.4 Verify juan294 end to end (read-only)

- Job rows for all 4 providers reach `complete`, and `scoring_v7_receipts` has at least one row.
- These surfaces all show the same v7.2 policy, identity and display value:
  - badge
  - share page
  - OG image
  - `/api/profile`
  - MCP `get_impact_profile`
  - MCP `compare_profiles`
  - `/api/history`
  - landing standings
- **Bitbucket.** If its job is `failed`, read `last_stop` (`{operation, stopKind, httpStatus}`) and the `evidence_source_stop` events.
  - Map them to the branch matrix from phase 1 step 1.3.
  - Write a regression test for that exact branch, fix it on `develop` (TDD, worktree), and ship it as a patch release with separate authorizations.
  - Retry from `/settings`.
  - This closes owner decision (5).

### 7.5 Contract migration (authorization: "apply migration 058 to production")

1. Only after 7.2 identity is confirmed, so that no running code reads the dropped objects.
2. Take a Supabase backup and record its id. Migration 058 drops the v6 data permanently, by owner decision.
3. Apply 058.
4. Read back:
   - no consent columns
   - no `metrics_snapshots`, `verification_records` or `admin_users` view
   - no flag row
5. Smoke the badge, share page, `/verify/<v7 token>` and `/verify/<retired hex>` (expect 410 with an explanation).

### 7.6 Close out

- Close #1335, citing the evidence from 7.4.
- The OpenAI plugin application then resumes as a separate task:
  - new icons (current vermilion `apps/web/public/logo-512.png`)
  - test cases 1-4 rewritten from real v7.2 outputs
  - a scored signed-up second handle for the compare test
  - demo recording
  - the corrected tool descriptions (phase 5)
