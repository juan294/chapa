import { GitlabIcon } from "@chapa/web";

export const Default = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 20, padding: 24, color: "var(--color-text-primary)" }}>
    <GitlabIcon className="w-4 h-4" />
    <GitlabIcon className="w-6 h-6" />
    <GitlabIcon className="w-10 h-10" />
  </div>
);

export const OnAccent = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px",
                background: "var(--color-amber-dark)", borderRadius: 8, color: "#fff", width: "fit-content" }}>
    <GitlabIcon className="w-5 h-5" />
    <span style={{ font: "600 14px/1 var(--font-body)" }}>GitlabIcon</span>
  </div>
);
