import { SectionHeader } from "@chapa/web";

export const CommandWithResult = () => (
  <SectionHeader
    command="chapa features"
    title="Features"
    meta={
      <>
        <span className="text-terminal-green">&#10003;</span> exit 0 &middot; 5 results
      </>
    }
  />
);

export const ScoreReadout = () => (
  <SectionHeader
    command="chapa score @developer"
    title="Scoring"
    meta="composite 82 · high"
  />
);

export const StepCount = () => (
  <SectionHeader command="chapa explain" title="How it works" meta="3 steps · ~1 min" />
);

export const NoMeta = () => (
  <SectionHeader command="chapa login" title="Get started" />
);
