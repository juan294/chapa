import type { PointResult, RegisteredScoringReceipt, ScoreBounds } from "@chapa/shared";
import { StatusCallout } from "@/components/StatusCallout";
import type { ReceiptVerificationV7 } from "@/lib/verification/types";

function score(value: ScoreBounds | PointResult) {
  return value.kind === "point" ? String(value.displayValue) : `${value.displayLower}–${value.displayUpper}`;
}

function craftScore(receipt: RegisteredScoringReceipt, text: (key: string) => string): string {
  if (receipt.policyVersion === "v7.2") {
    if (receipt.craft.status === "scored") return receipt.craft.report.result.point.displayLabel;
    return text(receipt.craft.status === "no_report" ? "craftAbsent" : "unavailableTitle");
  }
  return receipt.craft === null ? text("craftAbsent") : receipt.craft.result.status === "not_observed" ? text("craftUnobserved") : score(receipt.craft.result.composite);
}

/** Only the consent-checked, strictly allowlisted public receipt reaches this view. */
export function ReceiptCard({ token, result, t }: {
  token: string;
  result: ReceiptVerificationV7 | null | "unavailable";
  t: (key: string) => unknown;
}) {
  const text = (key: string) => t(`verifyReceipt.${key}`) as string;
  if (result === "unavailable" || result === null || result.status === "revoked") {
    const state = result === "unavailable" ? "unavailable" : result === null ? "missing" : "revoked";
    return <StatusCallout variant="warning" titleAs="h1" title={text(`${state}Title`)} description={text(`${state}Body`)} />;
  }
  const receipt = result.envelope.receipt;
  const api = `/api/verify/${token}`;
  return (
    <StatusCallout variant={result.status === "current" && result.signatureAuthenticated ? "verification" : "warning"} titleAs="h1" title={text("title")} description={text("intro")}>
      <p className="mb-4 font-heading text-sm text-text-primary">{text(result.status)}</p>
      <ul className="mb-6 list-disc space-y-2 pl-5 text-sm text-text-primary">
        <li>{text("issuance")}</li>
        <li>{text(result.signatureAuthenticated ? "authenticated" : "unauthenticated")}</li>
        <li>{text("replay")}</li>
      </ul>
      <dl className="mb-6 space-y-3 text-sm">
        <div><dt className="text-text-secondary">{text("reference")}</dt><dd className="break-all font-heading text-text-primary">{receipt.window.referenceTime}</dd></div>
        <div><dt className="text-text-secondary">{text("window")}</dt><dd className="break-all font-heading text-text-primary">{receipt.window.startInclusive} → {receipt.window.endExclusive}</dd></div>
        <div><dt className="text-text-secondary">{text("core")}</dt><dd className="font-heading text-xl text-text-primary">{score(receipt.core.composite)}</dd></div>
      </dl>
      <dl className="mb-6 grid grid-cols-2 gap-3 text-sm">
        {Object.entries(receipt.core.dimensions).map(([key, value]) => <div key={key} className="rounded-[3px] border border-stroke bg-bg px-3 py-2"><dt className="text-text-secondary">{text(key)}</dt><dd className="font-heading text-text-primary">{score(value)}</dd></div>)}
      </dl>
      {receipt.core.composite.kind === "range" && <p className="mb-6 text-pretty text-sm text-text-secondary">{text("range")}</p>}
      <section className="mb-6 border-t border-stroke pt-4">
        <h2 className="mb-2 text-balance font-heading text-sm text-text-primary">{text("craft")}</h2>
        <p className="text-sm text-text-primary">{craftScore(receipt, text)}</p>
      </section>
      <p className="mb-3 text-pretty text-sm leading-relaxed text-text-secondary">{text("source")}</p>
      <p className="mb-4 text-pretty text-sm leading-relaxed text-text-secondary">{text("svg")}</p>
      <a className="inline-flex min-h-11 items-center text-sm text-complement-text underline hover:text-complement-text-hover" href={api}>{text("json")}</a>
      <p className="mb-6 text-pretty text-sm leading-relaxed text-text-secondary">{text("replayBody")}</p>
      <details className="mb-6 rounded-[3px] border border-stroke bg-bg p-3">
        <summary className="min-h-11 cursor-pointer content-center text-sm text-text-primary">{text("compare")}</summary>
        <p className="mb-3 text-pretty text-sm leading-relaxed text-text-secondary">{text("compareBody")}</p>
        <code className="block break-all text-xs text-text-primary">{api}</code>
      </details>
      <p className="text-pretty text-sm leading-relaxed text-text-secondary">{text("retention")}</p>
    </StatusCallout>
  );
}
