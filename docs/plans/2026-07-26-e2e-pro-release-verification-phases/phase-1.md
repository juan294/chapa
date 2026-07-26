# Phase 1 — Adapt and Lock the Chapa Blueprint

**Status:** Complete
**Depends on:** nothing
**Batch:** no; this phase fixes names and contracts consumed by every later phase.
**Goal:** create the comprehensive local Chapa adaptation of the CC-RPI E2E Pro blueprint with verified values and explicit Wave A–H decisions.

## Files

### Create

- `docs/playbooks/e2e-pro-release-verification.md`

### Read as authoritative inputs

- `/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md`
- `docs/research/2026-07-26-e2e-pro-release-verification.md`
- `.claude/commands/release.md`
- `.claude/commands/explore-release.md`
- `docs/runbooks/release-checklist.md`
- `docs/runbooks/deployment-smoke.md`
- `docs/runbooks/migrations.md`
- `docs/runbooks/rollback.md`
- `CLAUDE.local.md`

The upstream file is explicitly a comprehensive copy-and-adapt template, while the finished daily release procedure has a separate 200-line target. (`/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:1-10`)

## Implementation

### 1. Create the comprehensive local adaptation

Create `docs/playbooks/e2e-pro-release-verification.md` from the complete upstream blueprint, then rewrite it as Chapa's decision source rather than leaving a generic template.

Populate:

- Chapa product, repository visibility, pnpm/Next.js stack, branch topology, Vercel deployment model, URLs, test commands, datastore, cache, auth, vendors, observability, release approver, and rollback authority from the completed research. (`docs/research/2026-07-26-e2e-pro-release-verification.md:38-61`)
- The local, CI, preview, and production truth table, including preview as the only named pre-production deployment tier. (`docs/research/2026-07-26-e2e-pro-release-verification.md:63-71`)
- Chapa actors, states, durable data, oracle layers, jobs, vendors, accepted runtime behavior, and authorization boundaries. (`docs/research/2026-07-26-e2e-pro-release-verification.md:136-188`)
- The dual candidate identity `{developCommit, candidateTreeDigest}` plus the later `{mainCommit, mainTreeDigest}` and deployment identities.
- Exact artifact paths selected in the main plan.

### 2. Record adoption decisions instead of empty structures

The local adaptation records:

```text
Wave A: adopted by this plan
Wave B: adopted by connecting the existing /explore-release command
Wave C: later structural work; no empty capability registry in this phase
Wave D: later, after a measured Wave C registry exists
Wave E: later, after registry and constraint inputs exist
Wave F: current local contract + deployed smoke + nightly probes documented;
        additional vendor-fidelity work remains risk-selected
Wave G: current offline/retry journey documented;
        broader state models remain risk-selected
Wave H: per-release manual obligations enter the Wave A manifest;
        cross-release TTL automation remains later structural work
```

This preserves the blueprint's mandatory Wave A floor and risk-based C–H scaling. (`/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:33-42`, `/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:177-189`)

### 3. Lock the evidence and safety vocabulary

Use these project values consistently:

```text
environments:
  local-contract
  ci-build
  preview
  production

safety classes:
  read-only
  synthetic-local-write
  authorized-preview-interaction
  production-operation
  outward-effect

oracle classes:
  ui
  http
  datastore
  vendor
  telemetry
  cleanup
  deployment-identity
  configuration
```

The blueprint's evidence model distinguishes UI, HTTP, datastore, object, event, vendor, telemetry, and cleanup oracles. Chapa's initial scope uses the applicable subset and records why object and queue/event oracles are not Wave A release requirements. (`/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:911-970`)

**Phase 6 clarification:** `configuration` is required for the
`operations.vercel-cron-registration` scenario. A validated `vercel.json` can
prove cron registration while deployment identity cannot; using the latter
would make the evidence label untruthful.

### 4. Record the single-procedure architecture

The adaptation names:

- `docs/release/release-playbook.md` as the future single short procedure;
- `.claude/commands/release.md` as the sole tag/version authority that delegates to it;
- `.claude/commands/explore-release.md` as the fresh-context charter executor;
- existing runbooks as linked operational detail rather than competing top-level sequences.

The blueprint requires subordinate commands to delegate to the single procedural source. (`/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:14-31`, `/Users/juan/code/cc-rpi/templates/e2e-pro-playbook-template.md:156-157`)

## Automated success criteria

```text
test "$(rg -o '<[A-Z][A-Z0-9_]*>' docs/playbooks/e2e-pro-release-verification.md | wc -l | tr -d ' ')" = "0"
test "$(rg -n 'docs/playbooks/e2e-pro-release-verification.md' docs/playbooks/e2e-pro-release-verification.md | wc -l | tr -d ' ')" -ge "0"
git diff --check
```

Also verify every referenced repository path exists and every `file:line` citation stays within the source file's line count.

## Manual success criteria

- Compare the local adaptation section-by-section with the upstream version and confirm that no hard invariant was removed.
- Confirm every environment, vendor, actor, data store, command, branch, URL, and owner is Chapa-specific.
- Confirm every inapplicable or later wave has a concrete applicability decision and reason.
- Confirm the comprehensive adaptation does not claim to be the daily release procedure.

## Authorization and containment

This phase creates one documentation file. It does not change tests, CI, branches, deployments, environments, production data, tags, or external systems.

## Stop condition

Stop after the adapted blueprint is reviewed and the placeholder/citation checks pass. Do not begin schemas or analyzer implementation without approval.
