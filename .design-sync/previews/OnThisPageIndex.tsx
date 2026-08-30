import { OnThisPageIndex } from "@chapa/web";

const SCORING_SECTIONS = [
  { id: "philosophy", label: "Philosophy" },
  { id: "normalization", label: "Normalization" },
  { id: "signal-caps", label: "Signal caps" },
  { id: "core-dimensions", label: "The core dimensions" },
  { id: "archetypes", label: "Developer archetypes" },
  { id: "confidence", label: "Confidence system" },
];

const LEGAL_SECTIONS = [
  { id: "collect", label: "Information we collect" },
  { id: "use", label: "How we use it" },
  { id: "retention", label: "Retention" },
];

// The active item comes from the URL hash, which is this component's context
// the way a theme is another component's. Setting it at import time - before
// React mounts, and only for the cell that wants it - is what makes the accent
// rail visible on the card at all. Without it every cell shows a plain list and
// the component's whole point is invisible.
if (
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("story") === "ActiveSection"
) {
  window.location.hash = "signal-caps";
}

export const ActiveSection = () => (
  <OnThisPageIndex heading="On this page" items={SCORING_SECTIONS} />
);

export const LongIndex = () => (
  <OnThisPageIndex heading="On this page" items={SCORING_SECTIONS} />
);

export const ShortIndex = () => (
  <OnThisPageIndex heading="On this page" items={LEGAL_SECTIONS} />
);
