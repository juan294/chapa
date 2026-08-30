// Design-system entry for design-sync (see .design-sync/config.json).
//
// Must live inside apps/web: the converter derives the package directory by
// walking up from --entry, so an entry outside the package resolves to the
// wrong package.json.
//
// The synth-entry fallback `export *`s every component under srcDir, which
// pulls the whole app in and with it server-only modules (lib/auth,
// node:crypto). This barrel pins the bundle to the curated presentational set.
// Adding a component here is the deliberate act of putting it in the DS.
export { StatusCallout } from "./components/StatusCallout";
export { ConfirmDialog } from "./components/ConfirmDialog";
export { LoginCtaButton } from "./components/LoginCtaButton";
export { ClaudeCodeStar } from "./components/ClaudeCodeStar";
export { LiteYouTubeEmbed } from "./components/LiteYouTubeEmbed";
export { InsightCard } from "./components/dashboard/InsightCard";
export { Sparkline } from "./components/dashboard/Sparkline";
export { GitHubIcon } from "./components/icons/GitHubIcon";
export { GitlabIcon } from "./components/icons/GitlabIcon";
export { BitbucketIcon } from "./components/icons/BitbucketIcon";
export { CodebergIcon } from "./components/icons/CodebergIcon";
export { CopyIcon } from "./components/icons/CopyIcon";

// v2 layout primitives (#1214, #1218). SectionHeader and ContentPageHeader are
// plain server components; OnThisPageIndex is a client leaf whose only context
// dependency is useTranslation, which falls back to the English dictionary when
// no LanguageProvider is present.
export { SectionHeader } from "./components/SectionHeader";
export { ContentPageHeader } from "./components/content/ContentPageHeader";
export { OnThisPageIndex } from "./components/content/OnThisPageIndex";
