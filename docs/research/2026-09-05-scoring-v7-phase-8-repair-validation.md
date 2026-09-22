# S08 historical repair retirement — local validation

Status: Part C independently reviewed and locally checked. This is not completion of S08; actual credential/source selection (Part B) and combined integration gates remain outstanding. No repair command, production request, remote build or deployment was executed.

## Result

`scripts/heal-poisoned-stats.ts` no longer contains automatic deletion. CLI `--apply` is rejected before configuration loading and programmatic legacy `apply=true` is rejected before I/O. Invalid handles and unknown options also fail before configuration. The inspector reads only two exact legacy cache keys and a bounded selection of full, identified `metrics_snapshots` rows for each explicitly selected owner. A PostgREST result limit is disclosed; only an exact matching Content-Range count establishes complete row enumeration.

The only positive finding supported by these legacy records is a recorded contradiction between the selected owner and the stored subject. Findings retain private owner, storage kind, exact record identity and a digest of observed content. That identifies the observation for review; neither a digest nor a contradiction determines which side is correct or authorizes deletion. Missing source/window/pagination proof remains unproven. Unparseable records remain uninterpretable. Low activity, zero PRs, low line counts/weights, legacy scope labels, free-text reason strings and upload recency are not corruption evidence.

The CLI prints counts and limitations, excluding contents, private record identities, digests and upstream error text. No new proof schema, repair service or mutation RPC was added. Existing legacy records cannot retroactively provide the v7 source observations they never stored. The separate v7 coordinator validates its own recorded source/window/coverage context; this legacy inspector does not invent it.

Adjacent comments in `scripts/recalculate-handles.ts` now describe the retired purge and the actual limits of server-token access. The recalculate command was not run or otherwise changed.

## Review and checks

An independent GPT-6 Astra review approved Part C with no blocking findings. Its separately identified simplify/reuse/quality pass also passed. The optional coverage suggestions were then added: complete/missing/malformed Content-Range; bounded and safely identified rows; Redis error envelopes; and an actual row-subject contradiction. Production source behavior did not change after approval.

- Initial regression run: 15 expected failures against the previous command.
- Final targeted script suite: 28 passing tests.
- Script TypeScript check and targeted script lint: passed.
- Removal of the now-unused always-false compatibility predicates: the seven policy fixtures now call the live structural validator; 27 integrity tests passed after cleanup. Actual client/persistence fixtures remain separate Part A evidence.

Logs are local ignored artifacts under `logs/scoring-v7/`: `s08-part-c-red.log`, `s08-part-c-unit.log`, `s08-part-c-typecheck.log`, `s08-part-c-lint.log`, and `s08-integrity-cleanup-unit.log` in the integrity worktree. Full repository checks and combined independent review remain required before S08 is committed and locally integrated.
