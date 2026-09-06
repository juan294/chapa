import { ChapaBadgeIcon } from "@/components/icons";

/**
 * The one badge-shaped loading plate.
 *
 * Two fallbacks cover a share-page load in sequence — the route's
 * `loading.tsx` while the shell streams, then `BadgeSkeleton` inside the
 * page's Suspense boundary while the profile data materializes — and the
 * second is on screen far longer than the first. Drawing them differently
 * made the wait read as "an animation, then nothing"; drawing them with this
 * component makes it one continuous state.
 *
 * No hooks, so a server component (`loading.tsx`) can render it directly.
 * Caption text is a prop because the two call sites resolve i18n differently.
 */
export function BadgeLoadingPlate({ caption }: { caption: string }) {
  return (
    <div className="relative aspect-[1200/630] w-full overflow-hidden rounded-[3px] bg-track">
      <div
        aria-hidden="true"
        className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-amber/20 to-transparent"
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
        <ChapaBadgeIcon className="h-14 w-14 animate-pulse text-amber-text" />
        <p className="font-heading text-xs tracking-wider text-text-secondary uppercase">{caption}</p>
      </div>
    </div>
  );
}
