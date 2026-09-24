import "server-only";
import type { CollectSlice } from "./plan";
import { collectGitHubSlice } from "@/lib/github/evidence";
import { collectBitbucketSlice } from "@/lib/bitbucket/evidence";
import { collectGitlabSlice } from "@/lib/gitlab/evidence";
import { collectCodebergSlice } from "@/lib/codeberg/evidence";

/**
 * The worker's single entry point into per-provider collection (#1335 phase
 * 3). A pure dispatch: each provider's own `collectXSlice` is fully
 * self-contained, including its own canonical identity check as the first
 * checkpoint operation ("profile" for GitHub, the equivalent `/user` fetch
 * for the other three) -- so a credential or identity failure surfaces as an
 * ordinary `stop` on the first slice, through the same checkpoint/budget
 * mechanics as every other operation, rather than as a one-off call outside
 * the checkpoint model.
 */
export const collectSourceSlice: CollectSlice = (input, credential, checkpoint, budget, stagedKeys) => {
  switch (input.requestedSource.provider) {
    case "github": return collectGitHubSlice(input, credential, checkpoint, budget, stagedKeys);
    case "bitbucket": return collectBitbucketSlice(input, credential, checkpoint, budget, stagedKeys);
    case "gitlab": return collectGitlabSlice(input, credential, checkpoint, budget, stagedKeys);
    case "codeberg": return collectCodebergSlice(input, credential, checkpoint, budget, stagedKeys);
  }
};
