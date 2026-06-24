# Phase 3 — `ScoreExplanationPanel` component + wiring + owner gating

> Depends on: Phase 1 (`buildScoreExplanation`) and Phase 2 (i18n keys).
> Files: `apps/web/components/dashboard/ScoreExplanationPanel.tsx` (new), `apps/web/components/dashboard/ScoreExplanationPanel.test.tsx` (new), `apps/web/components/SharePageOwnerContent.tsx` (wire-in).

## Intent

Render the `ScoreExplanation` model as a collapsible panel inside the breakdown, public for formulas + caveats, owner-only for the confidence section.

## Component

```
// ScoreExplanationPanel.tsx  ("use client")
interface Props { impact: ImpactV6Result; stats: StatsData; isOwner: boolean }

export function ScoreExplanationPanel({ impact, stats, isOwner }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const explanation = useMemo(() => buildScoreExplanation(impact, stats), [impact, stats])
  const panelId = "score-explanation-panel"

  return (
    <section className="rounded-xl bg-card shadow-card ...">
      <button aria-expanded={open} aria-controls={panelId}
              aria-label={t('aria.toggleScoreExplanation') as string}
              onClick={() => setOpen(v => !v)} onKeyDown={enterSpaceToggle}>
        {t('scoreExplanation.toggle') as string}
        <Chevron className={open ? "rotate-180" : ""} />
      </button>

      {/* reveal via .collapse-grid (globals.css) OR conditional mount */}
      <div id={panelId} className="collapse-grid" data-expanded={open}>
       <div>
        {/* 1. Composite roll-up */}
        <CompositeBlock composite={explanation.composite} />   // formula, solo note, adjusted note

        {/* 2. Per-dimension breakdown */}
        {explanation.dimensions.map(d =>
          <DimensionBlock key={d.key} d={d}
             label={t(`dimensions.${d.key}.label`)}
             formula={t(`scoreExplanation.dimensions.${d.key}Formula...`)}
             subLabel={k => t(`scoreExplanation.subMetrics.${k}`)}
             colorFrom/To={DIMENSION_COLORS[d.key]} />)}

        {/* 3. Data sources & caveats (PUBLIC) */}
        <DataSourcesBlock sources={explanation.dataSources} />

        {/* 4. Confidence (OWNER-ONLY) */}
        {isOwner && <ConfidenceBlock conf={explanation.confidence}
                       reason={flag => t(`scoreExplanation.confidence.reasons.${flag}`)} />}
       </div>
      </div>
    </section>
  )
}
```

### Reuse / design-system
- Card: `rounded-xl bg-card shadow-card` + `hover:shadow-card-hover transition-shadow` (no `border` — shadow ring replaces it). Match `DimensionCard.tsx:157`.
- Disclosure button + chevron-rotate + Enter/Space: copy the pattern from `DimensionCard.tsx:210-237`.
- Reveal animation: `.collapse-grid[data-expanded]` (`globals.css:520-534`) — same as `QuickControls`.
- Per-dimension progress bars: `role="progressbar"` on `bg-track`, gradient from `DIMENSION_COLORS` tokens (`ImpactBreakdown.tsx:262-277`).
- Section kicker headings: `font-heading text-xs tracking-[0.2em] uppercase text-text-secondary`.
- Formula callout: `rounded-lg border border-stroke bg-card p-4 font-heading text-sm` (`ScoringMethodologyClient.tsx:154`).
- Any info icon uses `InfoTooltip` (portal, `z-[99999]`) — never a raw `title`.
- `notCounted` chip on the solo Quality dimension via `t('scoreExplanation.dimensions.notCounted')`.

### Confidence block specifics (owner-only)
- Show `valueLine` ({value}%), `explainer`, `ownerOnlyNote`.
- List `penalties`: each `flag` → reason via i18n + the numeric `penalty` (e.g. "−5"); `platform_linked` shows as informational "verified" with 0. If empty, show `noPenalties`.

## Wiring

In `SharePageOwnerContent.tsx` (`:92-133`), `isOwner` already exists (`:99`). Add the panel right after the `ImpactDashboard` section (so it sits within the breakdown, below the cards):

```
{impact && stats && (
  <section className="mb-12 animate-fade-in-up ...">
    <ScoreExplanationPanel impact={impact} stats={stats} isOwner={isOwner} />
  </section>
)}
```

- `isOwner` is `false` during the session `loading` window (`:99`) — acceptable: the confidence section simply stays hidden until session resolves, then reveals on the owner's machine (no layout shift beyond the gated block). Document this as expected.

## Tests (write FIRST — `ScoreExplanationPanel.test.tsx`, RTL)
Using the mdburgos-like fixture:
1. Renders the toggle; expands on click; `aria-expanded` flips.
2. **Visitor (`isOwner={false}`)**: composite formula, per-dimension formulas, and data-source caveats are present; the confidence section (its heading / "%") is **absent** (`queryByText` null).
3. **Owner (`isOwner={true}`)**: confidence heading, `95%`, and the `single_repo_concentration` reason text are present.
4. Solo profile: Quality dimension shows the "shown, not counted" chip; composite formula lists only delivery/consistency/breadth.
5. GitLab data-source line shows the quality caveat copy.
- Tests run without a `LanguageProvider` (English fallback per project convention).

## Success criteria
- Automated: component tests pass; typecheck/lint/circular clean; bundle budget holds (panel ships inside the already-lazy `SharePageOwnerContentLazy`).
- Manual: light/dark visual check; tooltip not clipped; owner-vs-visitor confirmed in a real session.
