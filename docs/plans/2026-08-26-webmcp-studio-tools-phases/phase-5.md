# Phase 5 — Submission assets [docs part batch-eligible; actions MANUAL]

## 5A. Docs (automated-verifiable, batch-eligible)
- README: new "WebMCP" section + the rules-required **prior-work/new-work
  split**: dated statement that everything before 2026-08-25 is prior work
  (link v2.22.x/v2.23.0 tags), the Studio revival (v2.23.0) and the WebMCP
  layer (commits from 2026-08-26 on) are the submission-period work, with
  `git log --oneline` receipts. Candid, verifiable, no ambiguity.
- LICENSE prominence: root LICENSE exists (MIT); add a License section+badge
  near the top of README (rules: "prominently displayed").
- `docs/webmcp.md`: tool catalog (name, schema, page, annotations), the
  three-drivers architecture diagram-in-text, demo-mode instructions for
  judges, Chrome flag/origin-trial setup steps.
- Demo video script `docs/webmcp-demo-script.md` (<3 min, pitch order is a
  design constraint): 0:00-0:20 setup — your badge, your agent, one screen;
  0:20-1:30 Studio co-design (visible re-renders, human interrupt, human
  clicks the gated save); 1:30-2:20 verify close (`get_impact_profile` →
  `verify_badge` pass, tampered hash fail); 2:20-2:50 architecture: one
  command registry, three drivers, session inherited, writes human-gated.
- Devpost checklist in the same doc: live URL, description (use the fit
  doc's framing), YouTube link, repo URL, judge instructions incl.
  `/studio?demo=1` and Chrome setup.

## 5B. MANUAL, Juan-gated, in order
1. Release develop→main (`/pre-launch` → `/remediate` → `/update-docs` →
   `/release`) so the WebMCP layer + demo mode reach production. No later
   than Aug 31 (buffer before Sep 3 13:00 PT).
2. Flag flips in prod (admin PATCH, no deploy): `webmcp_enabled: true`,
   `studio_demo_enabled: true`. Verify: tools list in Chrome inspector on
   the live site; `/studio?demo=1` renders logged-out.
3. **Repo publication** (outward-facing; needs Juan's explicit go; secret
   scan CLEAN 2026-08-26 — re-run gitleaks on final HEAD first): flip
   `juan294/chapa` to public OR push a clean-tree seeded public repo.
   Immediately verify LICENSE renders on the repo landing page.
4. Record video against production; upload to YouTube (public).
5. Devpost submission (Juan submits or explicitly authorizes) BEFORE the
   deadline — target Sep 2 to keep a full day of buffer.
6. Post-deadline freeze: no repo/app/Devpost changes until winners
   (~Sep 23). Schedule nothing on main until then except emergencies.
