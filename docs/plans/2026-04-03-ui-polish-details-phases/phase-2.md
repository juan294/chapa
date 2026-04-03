# Phase 2: Text Wrap Balance on Headings [batch-eligible]

## Goal

Add `text-balance` (Tailwind v4 utility for `text-wrap: balance`) to multi-line headings and `text-pretty` to body paragraphs on public-facing pages. This prevents orphaned single words at the end of wrapped lines.

## Why

`text-wrap: balance` distributes text evenly across lines, eliminating orphaned words that create visual imbalance in headings. `text-wrap: pretty` does the same for body text with a different algorithm. Neither affects single-line text, so it's safe to apply broadly. Browser support: Chrome 114+, Firefox 121+, Safari 17.5+ (graceful degradation — no visual difference in older browsers).

## Files to Modify

### 1. `apps/web/app/page.tsx` — Landing page

**Line 139** — hero heading:
```
BEFORE: <h1 className="font-heading text-3xl sm:text-4xl md:text-6xl tracking-tight leading-[0.95]">
AFTER:  <h1 className="font-heading text-3xl sm:text-4xl md:text-6xl tracking-tight leading-[0.95] text-balance">
```

**Line 145** — hero description paragraph:
```
BEFORE: <p className="text-base text-text-primary font-medium">
AFTER:  <p className="text-base text-text-primary font-medium text-pretty">
```

**Line 281** — "What we measure" body text:
```
BEFORE: <p className="text-text-secondary text-sm mt-2 leading-relaxed max-w-2xl">
AFTER:  <p className="text-text-secondary text-sm mt-2 leading-relaxed max-w-2xl text-pretty">
```

**Line 323** — enterprise section body:
```
BEFORE: <p className="text-text-secondary text-sm mt-2 leading-relaxed max-w-2xl">
AFTER:  <p className="text-text-secondary text-sm mt-2 leading-relaxed max-w-2xl text-pretty">
```

### 2. `apps/web/app/u/[handle]/page.tsx` — Share page

**Line 231** — section title:
```
BEFORE: <h2 className="font-heading text-xs tracking-[0.2em] uppercase text-text-secondary mb-4 ...">
AFTER:  <h2 className="font-heading text-xs tracking-[0.2em] uppercase text-text-secondary mb-4 ... text-balance">
```

### 3. `apps/web/components/SharePageOwnerContent.tsx` — Visitor CTA

**Line 50** — CTA heading:
```
BEFORE: <h2 className="font-heading text-lg sm:text-xl font-bold text-text-primary tracking-tight mb-2">
AFTER:  <h2 className="font-heading text-lg sm:text-xl font-bold text-text-primary tracking-tight mb-2 text-balance">
```

**Line 53** — CTA body:
```
BEFORE: <p className="text-sm text-text-secondary leading-relaxed mb-6 max-w-md mx-auto">
AFTER:  <p className="text-sm text-text-secondary leading-relaxed mb-6 max-w-md mx-auto text-pretty">
```

### 4. `apps/web/components/ImpactBreakdown.tsx` — Section headings

**Line 246** — "Performance Dimensions" heading:
```
BEFORE: <h3 className="font-heading text-xs tracking-[0.2em] uppercase text-text-secondary mb-4">
AFTER:  <h3 className="font-heading text-xs tracking-[0.2em] uppercase text-text-secondary mb-4 text-balance">
```

### 5. `docs/design-system.md` — Document the convention

Add to Typography rules section:
```
- Use `text-balance` on all `<h1>`-`<h3>` elements to prevent orphaned words.
- Use `text-pretty` on body paragraphs longer than one sentence.
```

## Tests

Source-level assertions in existing test files:

### `apps/web/components/ImpactBreakdown.test.tsx`
```
it("section headings use text-balance for even line distribution", () => {
  expect(SOURCE).toContain("text-balance");
});
```

## Success Criteria

### Automated
- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run test` passes
- [ ] `pnpm run lint` passes

### Manual
- [ ] Resize browser on landing page — headings wrap evenly, no orphaned words
- [ ] Share page section titles wrap cleanly at narrow viewports
- [ ] CTA text on visitor share page wraps without trailing single word
