/**
 * Re-export the lazy command bar as LandingTerminal for backwards compatibility.
 *
 * The command bar is non-critical below-the-fold chrome on the landing page,
 * so keep it out of the public route's initial client baseline.
 */
export { GlobalCommandBarLazy as LandingTerminal } from "@/components/GlobalCommandBarLazy";
