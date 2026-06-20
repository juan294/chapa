# ADR: Terminal-First UI — Conversion Barrier Analysis & Escape Hatch

**Date:** 2026-06-20
**Status:** Proposed — **NEEDS PRODUCT SIGN-OFF** (no final decision asserted)
**Refs:** Refs #783 (UX-S1)

> This ADR analyzes a UX/conversion concern and presents options. It deliberately
> does **not** assert a final decision. The recommendation below is a starting
> point for a product conversation, not a commitment.

## Context

Chapa's UI is intentionally a **developer-tool, terminal-first aesthetic** (see
`docs/design-system.md`: "Terminal Dark + Purple Accent"). Two of the highest-
traffic surfaces lean heavily on this metaphor:

- **Landing (`/`)** — structured as a "terminal session": each section is a
  `$ command` + output pair. The primary login affordance is a `/ login` text link
  styled as a terminal command, not a conventional button.
- **Share page (`/u/:handle`)** — renders `<GlobalCommandBarLazy />` to **every
  visitor**, authenticated or not (`apps/web/app/u/[handle]/page.tsx`). The share
  page is the page a developer's audience (recruiters, managers, non-developer
  peers, social-media referrals) is most likely to land on via an embedded badge.

The concern (#783): the terminal metaphor — `$` prompts, command-bar affordances,
`/`-prefixed nav — may read as friction or as "not for me" to **non-developer
visitors** on exactly the pages meant to convert them (the share page reached via a
badge embed, and the landing page reached via marketing). A developer audience
finds the metaphor delightful and on-brand; a non-developer audience may find it
opaque.

This is a genuine tension: the terminal aesthetic is a deliberate brand asset, and
the audience for badges is **mostly** developers — but the share page is precisely
where non-developer eyeballs arrive.

## What this ADR is *not*

- It is not a claim that the terminal UI is bad. The metaphor is a core,
  intentional brand decision.
- It is not a redesign spec. It frames options for a product decision.
- It does not assert a winner. The recommendation requires product sign-off.

## Options

### Option A — Keep as-is (brand identity)

Treat the terminal metaphor as a non-negotiable brand asset on every surface,
including the public share page.

- **Pros:** Strongest, most distinctive brand identity; zero work; the primary
  audience (developers) is delighted; consistent experience end to end.
- **Cons:** Highest risk of bouncing non-developer visitors on the share page; the
  command bar shown to anonymous visitors offers affordances most of them won't
  use; potential conversion drag on the badge → signup funnel.

### Option B — Simplified non-authenticated share view

Serve a calmer, conventional layout to **anonymous** visitors of `/u/:handle`
(badge, archetype, a plain-language one-line explanation, a single obvious CTA),
and keep the full terminal experience (including `GlobalCommandBarLazy`) for
authenticated users and the studio/landing surfaces.

- **Pros:** Targets the exact surface where non-developers land; preserves the
  terminal brand everywhere it serves the core audience; the command bar stops
  being shown to visitors who can't use it.
- **Cons:** Two share-page variants to maintain; risk of brand dilution if the
  simplified view drifts too far; needs care so the badge itself (the hero asset)
  stays prominent in both.

### Option C — Progressive disclosure

Keep a single share page but make the terminal/command-bar affordances
**opt-in**: lead with the badge + plain-language summary + primary CTA, and tuck
the command bar / terminal interactions behind a discoverable "developer mode" or
keyboard trigger rather than rendering them to everyone by default.

- **Pros:** One page to maintain; non-developers get a clean first impression;
  developers can still summon the full power surface; smallest brand compromise.
- **Cons:** More design/engineering nuance to get the disclosure trigger right;
  the value of the command bar drops if it's hidden too well; needs measurement to
  confirm developers still find it.

## Cross-cutting accessibility note

Whichever option is chosen, the share page should already meet the project's
accessibility bar (keyboard nav, ARIA on the command bar, visible focus). The
command bar being present for anonymous users is a UX/conversion question, not an
a11y defect — but a simplified or progressively-disclosed view must not regress
keyboard or screen-reader access to the badge, breakdown, and embed snippet.

## Recommendation (for discussion — NEEDS PRODUCT SIGN-OFF)

A **leaning** toward **Option C (progressive disclosure)** on the share page,
because it preserves the single-page brand experience while removing the most
likely source of non-developer friction (a command bar rendered to every
anonymous visitor). **Option B** is the fallback if measurement shows a clean
split between authenticated (developer) and anonymous (mixed) audiences justifies
two variants. **Option A** remains valid if product decides brand consistency
outweighs the conversion concern.

**This is not a decision.** Before any implementation:

1. **Instrument first.** Add/inspect funnel analytics on the badge → share →
   signup path. Segment anonymous vs. authenticated, and (where possible)
   referrer (README/GitHub vs. social vs. direct). Decide with data, not vibes.
2. **Get product sign-off** on which option to pursue.
3. **Only then** open implementation issues with acceptance criteria.

## Consequences

- **Of deciding (any option):** Affects the highest-traffic public surface; should
  be validated with funnel metrics, not shipped blind.
- **Of not deciding:** Status quo is Option A by default — acceptable, but leaves
  a plausible conversion drag unexamined. This ADR keeps the question open and
  evidence-driven rather than letting inertia decide.

## Next step

Route to product for sign-off on instrumentation + option selection. No code
changes flow from this ADR until that sign-off exists.
