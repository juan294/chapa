import { StatusCallout } from "@chapa/web";

export const Verification = () => (
  <StatusCallout
    variant="verification"
    title="Metrics verified"
    description="This badge was signed with HMAC-SHA256 on 29 August 2026. The signature proves the scores have not been altered since they were computed."
  />
);

export const Success = () => (
  <StatusCallout
    variant="success"
    title="Badge generated"
    description="Your Impact Profile is live. Embed it in a README with the snippet below."
  />
);

export const Warning = () => (
  <StatusCallout
    variant="warning"
    title="Private repository access is limited"
    description="Merges in private repositories are not visible to your session token, so Delivery may read lower than your real activity."
  />
);

export const Error = () => (
  <StatusCallout
    variant="error"
    title="Could not reach GitHub"
    description="GitHub returned a rate-limit response. Cached scores are being shown; try a refresh in a few minutes."
  />
);
