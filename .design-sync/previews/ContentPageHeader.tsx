import { ContentPageHeader } from "@chapa/web";

export const WithIntro = () => (
  <ContentPageHeader
    command="chapa explain --scoring"
    title="Scoring Methodology"
    intro="Full transparency on how Chapa decodes your developer impact. Every weight, cap, and decision is explained here."
  />
);

export const HighlightedTitle = () => (
  <ContentPageHeader
    command="chapa explain --privacy"
    title={
      <>
        Privacy <span className="text-amber">Policy</span>
      </>
    }
    intro="What Chapa reads from your GitHub account, what it stores, and what it never touches."
  />
);

export const TitleOnly = () => (
  <ContentPageHeader command="chapa explain --about" title="About Chapa" />
);
