# Standalone loading and global-error visual evidence

Eight actual-component Chromium captures at 1440 and 390 CSS pixels, in OS light and dark modes, with reduced motion. Each PNG was visually inspected. No horizontal overflow, clipped controls, or missing glyphs appeared.

The ignored harness in `logs/redesign/standalone-states/` imports the production `app/loading.tsx` and `app/global-error.tsx` components and uses React `renderToStaticMarkup`. A separate loopback-only server on port 4174 served the resulting documents as UTF-8 and was stopped after capture. No production route, provider mock, application source rewrite, or external request was used.

- `root-loading-en-*`: the actual static fallback uses `DEFAULT_LOCALE = 'en'`. The normal body classes, current compiled application CSS, and built local font files reproduce its page context. Browser font records confirm JetBrains Mono 400 and Manrope 400 loaded. Both themes retain the fixed dark terminal surface. There is no separate ES root-loading variant.
- `global-error-bilingual-*`: the actual component always contains ES and EN spans under `html lang="es"`. Its own head/body and inline CSS are used without application CSS or added fonts, matching its root-layout replacement contract. System sans and Courier fallback render correctly. There is no locale-selected variant.

`verification.json` records configured/document widths, loaded font faces, control bounds, and the empty unexpected-network list for every capture. These are source-rendered visual checks, not a forced Next.js exception, hydration/reset interaction test, or telemetry check; those behavioral contracts remain covered by the application's existing tests.
