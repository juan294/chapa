# Phase 1 — i18n Keys [batch-eligible]

**Goal:** Add `scoreExplanation.challenge.*` keys to both dictionaries. Parity test must stay green.

**Files changed:**
- `apps/web/lib/i18n/dictionaries/en.ts`
- `apps/web/lib/i18n/dictionaries/es.ts`

**Files read (no change):**
- `apps/web/lib/i18n/dictionaries/parity.test.ts` (understand what it checks)

---

## Red — Failing Test

The parity test already exists at `apps/web/lib/i18n/dictionaries/parity.test.ts`. It will fail once keys are added to `en.ts` but not yet to `es.ts`. Use that as the red state.

---

## Green — Implementation

### `en.ts` — add inside `scoreExplanation` after the `confidence` block (after line 1030)

```ts
// after confidence: { ... },
challenge: {
  ctaButton: 'Something seem off?',
  heading: 'Challenge your score',
  intro: 'If something in your score doesn\'t add up, describe what seems wrong and we\'ll review your data.',
  label: 'Describe the issue',
  placeholder: 'e.g. My PRs were merged but aren\'t showing in Delivery. Most of my activity was in Q1 but the score looks low...',
  submit: 'Send to support',
  submitting: 'Sending...',
  cancel: 'Cancel',
  successTitle: 'Message sent',
  successDescription: 'Thanks — we\'ll review your score data and follow up via GitHub if needed.',
  errorText: 'Couldn\'t send your message. Please try again.',
  tooManyRequests: 'You\'ve sent too many challenges recently. Please try again tomorrow.',
  validationMinLength: 'Please describe the issue in at least 20 characters.',
  validationMaxLength: 'Please keep your description under 1000 characters.',
},
```

### `es.ts` — add the identical key path with Spanish values

```ts
challenge: {
  ctaButton: '¿Algo no cuadra?',
  heading: 'Cuestiona tu puntuación',
  intro: 'Si algo en tu puntuación no parece correcto, descríbelo y revisaremos tus datos.',
  label: 'Describe el problema',
  placeholder: 'p. ej. Mis PRs fueron fusionados pero no aparecen en Delivery. La mayor parte de mi actividad fue en Q1 pero la puntuación parece baja...',
  submit: 'Enviar al soporte',
  submitting: 'Enviando...',
  cancel: 'Cancelar',
  successTitle: 'Mensaje enviado',
  successDescription: 'Gracias — revisaremos tus datos y te contactaremos por GitHub si es necesario.',
  errorText: 'No se pudo enviar tu mensaje. Por favor, inténtalo de nuevo.',
  tooManyRequests: 'Has enviado demasiados cuestionamientos recientemente. Por favor, inténtalo mañana.',
  validationMinLength: 'Por favor describe el problema con al menos 20 caracteres.',
  validationMaxLength: 'Por favor mantén la descripción en menos de 1000 caracteres.',
},
```

Both blocks go in the same position in their respective files (nested inside `scoreExplanation`, after `confidence`).

---

## Verification

```bash
pnpm run test apps/web/lib/i18n/dictionaries/parity.test.ts
pnpm run typecheck
```

Parity test must pass. TypeScript must infer the new keys without errors when used as `t('scoreExplanation.challenge.ctaButton') as string`.

---

## Implementation Status

- [x] Phase 1 implemented in worktree `/Users/juan/code/chapa-phase-1` on branch `implement/challenge-my-score-phase-1`
- [x] Red state confirmed: parity test failed when English keys existed without matching Spanish keys
- [x] Plan-compliance review approved the dictionary diff
- [x] `/simplify` equivalent completed; no plan-compatible cleanup edits applied
- [x] Verification passed: `pnpm run test apps/web/lib/i18n/dictionaries/parity.test.ts`
- [x] Verification passed: `pnpm run typecheck`
- [x] Full gates passed: `pnpm run test ; pnpm run typecheck ; pnpm run lint ; pnpm run check:circular ; pnpm run build`
