import { ChapaBadgeIcon } from "@chapa/web";

export const Default = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 20, padding: 24, color: "var(--color-text-primary)" }}>
    <ChapaBadgeIcon className="w-4 h-4" />
    <ChapaBadgeIcon className="w-6 h-6" />
    <ChapaBadgeIcon className="w-10 h-10" />
  </div>
);

export const OnAction = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px",
                background: "var(--color-action)", borderRadius: 3, color: "var(--color-action-text)", width: "fit-content" }}>
    <ChapaBadgeIcon className="w-5 h-5" />
    <span style={{ font: "600 14px/1 var(--font-heading)" }}>Get your badge</span>
  </div>
);
