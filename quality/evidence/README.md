# Release evidence runs

This directory contains the tracked contract for Chapa release evidence. Runtime
runs belong under `quality/evidence/runs/<run-id>/` and are intentionally
gitignored.

Prepare a run with a concrete baseline, develop commit, candidate tree, and
preview URL:

```sh
pnpm release:prepare-run -- \
  --baseline-tag v2.22.1 \
  --develop-commit <40-character-commit> \
  --candidate-tree <40-character-tree> \
  --preview-url https://preview.example.test \
  --run-id release-YYYYMMDD-NNN \
  --output quality/evidence/runs/release-YYYYMMDD-NNN/release-run.json
```

Collectors append normalized results and artifacts to that run. Analyze and
render the complete local evidence without contacting production:

```sh
pnpm release:analyze -- \
  --run quality/evidence/runs/<run-id>/release-run.json \
  --stage final
pnpm release:render-report -- \
  --run quality/evidence/runs/<run-id>/release-run.json \
  --stage final \
  --output quality/evidence/runs/<run-id>/release-report.md
```

The analyzer fails closed when required evidence is absent, failed, skipped,
identity-mismatched, or leaves synthetic fixture residue. Runtime evidence must
contain only synthetic identifiers and secret-free artifacts. Do not commit
run directories, credentials, cookies, tokens, personal data, or production
write payloads.

Collector outputs conform to
`quality/schemas/evidence-fragment.schema.json`: they bind one environment's
normalized results to the run and candidate identity. The merged release
artifact conforms to `quality/schemas/evidence-manifest.schema.json`: it binds
the analysis stage, full candidate identity, all results, exploratory charters,
manual obligations, exceptions, rollback reference, and tag authorization.
Scenario evidence is keyed by both stable scenario ID and environment; the same
required probe may therefore have distinct preview and production results. A
fragment is never sufficient as a final release manifest.

Tracked fixtures under `quality/fixtures/` are inert synthetic examples used to
test the contract. The passing fixture is not evidence of a real release.
