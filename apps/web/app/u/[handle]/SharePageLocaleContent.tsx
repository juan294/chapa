'use client';

import { useTranslation } from '@/lib/i18n';
import { interpolate } from '@/lib/i18n/interpolate';

// #1184 (FE-L4): document.title is intentionally NOT set here. Both
// `generateMetadata` (page.tsx) and this component resolve locale — including
// the `?lang=` deep-link override — via the same `getServerLocale()` call
// (#1066), and the root layout's `"%s — Chapa"` title template already
// appends the suffix. A duplicate client-side `document.title` write would
// run after React's own head management (so it wins) and would silently go
// stale if the layout's title template ever changed.
export function SharePageLocaleContent({
  handle,
  badgeLabelId,
}: {
  handle: string;
  badgeLabelId: string;
}) {
  const { t } = useTranslation();

  return (
    <>
      <h1 className="sr-only">
        {interpolate(t('sharePage.srH1') as string, { handle })}
      </h1>
      <span id={badgeLabelId} className="sr-only">
        {interpolate(t('sharePage.badgeAriaLabel') as string, { handle })}
      </span>
    </>
  );
}
