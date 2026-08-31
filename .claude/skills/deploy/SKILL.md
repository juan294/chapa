---
name: deploy
description: Deploy Chapa to production through the develop-to-main release path, required CI checks, production verification, and documentation updates. Use only when the user explicitly requests a production deployment.
---

# Deploy to Production
1. Run full test suite and confirm all pass
2. Check current branch — if on develop, create PR to main
3. Wait for CI green on the PR
4. Merge PR to main
5. Verify production deployment via site check
6. Update any relevant documentation
