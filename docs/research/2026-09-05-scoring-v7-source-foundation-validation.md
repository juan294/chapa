# S08 source integrity foundation — local validation

Status: Part A structural guards and Part B private storage foundation independently reviewed. This is not whole-S08 completion: live coordinator integration and full phase gates remain outstanding.

## Implemented boundaries

Legacy structural validation accepts legitimate empty, direct-push, small-PR and annual-expiration profiles. It validates real calendar dates and finite numeric domains without using productivity or credential-rank heuristics as corruption proof. Invalid raw count values cannot leak through rejection telemetry. Structural validity does not establish complete v7 source coverage.

The private source context binds the selected credential, requested provider/host/login, owner, scope and exact current linked-row identity/version. A separate selection identifier includes the full reference window. Canonical provider subject identity is observed or discovered from authorized storage; a login is not substituted for a canonical ID. Credential equivalence does not prove universal private visibility or unchanged remote permissions.

Migration045 supplies authorized source discovery, immutable append and context-preserving read operations using existing source tables. Strict normalized payload validation excludes raw provider responses and validates repository membership and acceptance times. Linked-token updates/deletions compare the exact link UUID and full microsecond version. All link updates advance that version monotonically; consent and link locks prevent delayed work reviving withdrawn source access. Browser roles have no access to these RPCs.

## Actual local verification

The first real database run exposed SQL operator-precedence errors in JSON extraction/containment and nested allowlist subtraction. Four valid-append contracts failed; 139 tests passed. The primary agent parenthesized the affected operands. An independent GPT-6 Astra reviewer inspected those exact final changes as part of the foundation review.

Final migration045 SHA-256: `2416f6fa8d320a5f7d0e2823abe4ba635ef4852cde431de252d107693a762f71`.

- Migration sequence validation: all 45 files passed.
- Owned disposable project `chapa-scoring-v7`: full local reset/replay of migrations001–045 passed.
- Full local database contract suite: **143 tests in 44 files passed**, including the actual nonempty event storage/read adapter, malformed payload rejection, service/browser privileges, competing token updates, changed-link rejection and append/withdrawal races.
- Independent static correctness review: Part A and Part B foundation approved at the final migration digest.
- Separate simplify/reuse/quality review: approved after removing one extra EOF blank line; the whitespace cleanup passed `git diff --check`.

Configuration was restored byte-for-byte after each local database command. Other local database projects were not changed. No production data, `.env.local`, hosted build, push or deployment was used.

Ignored local logs under `logs/scoring-v7/`: `s08-b2b-migrations.log`, `s08-b2b-db-apply.log`, `s08-b2b-contract.log` (initial failure), `s08-b2b-db-reset.log`, and `s08-b2b-contract-fixed.log` (passing replay). Earlier focused unit/typecheck/lint records remain separate and are not substitutes for the combined phase gates.

## Remaining acceptance

The existing handle-only composed caches and ranked in-flight sharing are outside the foundation approval. The live coordinator must use current flags, consent and linkage, capture credentials once, isolate exact selections, keep read-only paths free of collection/mutation, preserve original stale metadata and compose overlays only after source checks. S08 stays open until those callers and their regression tests pass independent review and the complete local integration gates.
