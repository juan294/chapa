/**
 * Re-export GlobalCommandBar as LandingTerminal for backwards compatibility.
 *
 * Intentionally synchronous (not GlobalCommandBarLazy) — the command bar IS
 * the primary interaction surface on the landing page and must be available
 * immediately without a loading flash. Admin and share pages use the lazy
 * variant because the bar is secondary there.
 */
export { GlobalCommandBar as LandingTerminal } from "@/components/GlobalCommandBar";
