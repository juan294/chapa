import Home, { generateMetadata as localizedMetadata } from "../LocalizedHome";

// A literal route admits only this locale before streaming starts. Keep the
// live scoring selection; unknown top-level paths have no landing-page match.
export const dynamic = "force-dynamic";

export function generateMetadata() {
  return localizedMetadata({ params: Promise.resolve({ locale: "es" }) });
}

export default function Page() {
  return Home({ params: Promise.resolve({ locale: "es" }) });
}
