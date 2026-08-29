import { LoginCtaButton } from "@chapa/web";

export const Small = () => (
  <LoginCtaButton label="Get your badge" pendingLabel="Connecting to GitHub…" size="sm" />
);

export const Large = () => (
  <LoginCtaButton label="Get your badge" pendingLabel="Connecting to GitHub…" size="lg" />
);
