import type { Locale } from "@/lib/i18n";
import { getServerT } from "@/lib/i18n/server";
import {
  evidenceWorkflowItems,
  summarizeEvidenceWorkflow,
  type EvidenceWorkflowState,
} from "@/lib/evidence/workflow-state";
import { dbReadEngineeringEvidence } from "@/lib/db/engineering-evidence";
import { createScoringWindow } from "@chapa/shared";

const STATE_STYLE: Record<EvidenceWorkflowState, string> = {
  pending: "border-terminal-yellow/30 bg-terminal-yellow/10 text-terminal-yellow",
  accepted: "border-terminal-green/30 bg-terminal-green/10 text-terminal-green",
  rejected: "border-stroke bg-track text-text-secondary",
  withdrawn: "border-stroke bg-track text-text-secondary",
};
const STATE_KEY: Record<EvidenceWorkflowState, string> = {
  pending: "settings.evidenceStatePending",
  accepted: "settings.evidenceStateAccepted",
  rejected: "settings.evidenceStateRejected",
  withdrawn: "settings.evidenceStateWithdrawn",
};

/**
 * The owner's view of their own evidence.
 *
 * Every submitted item is shown with the state it is actually in — a claim
 * nobody has assessed reads "pending review", never as though it already
 * counts. The Craft section is deliberately open to everyone: the policy
 * scores engineering practice, and choosing not to use an AI tool demonstrates
 * judgment the same way using one does, so a reader with no report to import
 * still has a route in.
 */
export async function EvidenceWorkflow({ handle, locale }: { handle: string; locale: Locale }) {
  const t = getServerT(locale);
  const owner = handle.toLowerCase();

  let items: ReturnType<typeof evidenceWorkflowItems> = [];
  try {
    const snapshot = await dbReadEngineeringEvidence(owner, owner, createScoringWindow(new Date().toISOString()));
    items = evidenceWorkflowItems(snapshot);
  } catch {
    // A ledger read failure must not take the whole settings page down; the
    // empty state below is honest about showing nothing.
  }
  const summary = summarizeEvidenceWorkflow(items);

  return (
    <section aria-labelledby="settings-evidence" className="border-t border-stroke pt-8">
      <h2 id="settings-evidence" className="font-heading text-lg font-semibold tracking-tight text-text-primary">
        {t("settings.evidenceTitle") as string}
      </h2>
      <p className="mt-2 max-w-2xl text-pretty text-sm leading-relaxed text-text-secondary">
        {t("settings.evidenceDescription") as string}
      </p>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-text-secondary">{t("settings.evidenceEmpty") as string}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map(item => (
            <li
              key={item.revisionId}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-stroke bg-card px-4 py-3"
            >
              <span className="font-heading text-xs text-terminal-dim">
                {t(item.channel === "craft" ? "settings.evidenceChannelCraft" : "settings.evidenceChannelCore") as string}
              </span>
              <span className="min-w-0 flex-1 truncate font-heading text-sm text-text-primary">{item.workItemId}</span>
              <span className={`rounded-lg border px-2 py-1 text-[11px] font-medium ${STATE_STYLE[item.state]}`}>
                {t(STATE_KEY[item.state]) as string}
              </span>
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-8 font-heading text-base font-semibold tracking-tight text-text-primary">
        {t("settings.evidenceCraftTitle") as string}
      </h3>
      <p className="mt-2 max-w-2xl text-pretty text-sm leading-relaxed text-text-secondary">
        {t("settings.evidenceCraftDescription") as string}
      </p>
      <p className="mt-2 text-sm text-text-secondary">
        {t(summary.craftPortfolioEmpty ? "settings.evidenceCraftEmpty" : "settings.evidenceCraftPresent") as string}
      </p>
    </section>
  );
}
