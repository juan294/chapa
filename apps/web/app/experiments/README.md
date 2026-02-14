# Experiments

Internal development pages for testing visual effects, animations, and badge rendering techniques.

## Why "use client"?

All experiment pages use `"use client"` because they rely on interactive React hooks
(`useState`, `useEffect`, `useRef`, `useCallback`) for live controls, sliders, replay
buttons, and animation previews. This is intentional and necessary.

## Production impact: none

- **Code-split by Next.js routing**: each experiment is a separate route chunk that is
  only loaded when navigated to directly. They do not inflate the main app bundle.
- **Not linked from production navigation**: no nav bar, footer, or internal link points
  to `/experiments/*`.
- **Excluded from search engines**: the experiments layout sets `robots: { index: false, follow: false }`
  and `robots.txt` disallows `/experiments/`.
- **No server-side data fetching**: experiments use mock/fixture data, so they have zero
  impact on API rate limits or caching.
