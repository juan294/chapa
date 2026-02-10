#!/usr/bin/env bash
# Setup GitHub issue labels for Chapa
# Run once after creating the repo: bash scripts/setup-labels.sh
#
# Requires: gh CLI authenticated with repo access

set -euo pipefail

REPO="juan294/chapa"  # Update this if the repo name differs

echo "Setting up labels for $REPO..."

# Delete default labels that we don't use
for label in "bug" "documentation" "duplicate" "enhancement" "good first issue" "help wanted" "invalid" "question" "wontfix"; do
  gh label delete "$label" --repo "$REPO" --yes 2>/dev/null || true
done

echo "Creating type labels..."
gh label create "type: bug"          --repo "$REPO" --color "d73a4a" --description "Something is broken" --force
gh label create "type: feature"      --repo "$REPO" --color "0e8a16" --description "Brand new functionality" --force
gh label create "type: enhancement"  --repo "$REPO" --color "1d76db" --description "Improvement to existing feature" --force
gh label create "type: chore"        --repo "$REPO" --color "666666" --description "Maintenance, deps, CI, cleanup" --force
gh label create "type: security"     --repo "$REPO" --color "e4e669" --description "Security vulnerability or hardening" --force
gh label create "type: docs"         --repo "$REPO" --color "0075ca" --description "Documentation improvements" --force

echo "Creating priority labels..."
gh label create "priority: critical" --repo "$REPO" --color "b60205" --description "Blocks demo, data loss, security vuln" --force
gh label create "priority: high"     --repo "$REPO" --color "d93f0b" --description "Major functionality affected" --force
gh label create "priority: medium"   --repo "$REPO" --color "fbca04" --description "Important but not urgent" --force
gh label create "priority: low"      --repo "$REPO" --color "c2e0c6" --description "Backlog, nice to have" --force

echo "Creating area labels..."
gh label create "area: oauth"        --repo "$REPO" --color "5319e7" --description "GitHub OAuth, sessions, tokens" --force
gh label create "area: scoring"      --repo "$REPO" --color "006b75" --description "Impact v3 compute, normalization, tiers" --force
gh label create "area: badge"        --repo "$REPO" --color "0052cc" --description "SVG rendering, themes, animations" --force
gh label create "area: share-page"   --repo "$REPO" --color "d4c5f9" --description "Share page UI, embed snippets, OG meta" --force
gh label create "area: cache"        --repo "$REPO" --color "f9d0c4" --description "Upstash Redis, TTL, cache invalidation" --force
gh label create "area: infra"        --repo "$REPO" --color "1d1d8e" --description "CI/CD, Vercel, deployment, monitoring" --force
gh label create "area: ux"           --repo "$REPO" --color "bfd4f2" --description "UI/UX, design, accessibility" --force

echo "Creating workflow labels..."
gh label create "blocked"            --repo "$REPO" --color "000000" --description "Waiting on external dependency or decision" --force
gh label create "duplicate"          --repo "$REPO" --color "cfd3d7" --description "Already tracked in another issue" --force
gh label create "wontfix"            --repo "$REPO" --color "ffffff" --description "Intentionally not addressing" --force

echo "Done! All labels created for $REPO"
