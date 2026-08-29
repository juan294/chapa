import { ClaudeCodeStar } from "@chapa/web";

export const Mark = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 24, color: "var(--color-text-primary)" }}>
    <ClaudeCodeStar />
    <span style={{ font: "500 15px/1.4 var(--font-body)" }}>Built with Claude Code</span>
  </div>
);

export const OnDark = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 24,
                background: "var(--color-dark-section)", borderRadius: 10, color: "#E2E4E9" }}>
    <ClaudeCodeStar />
    <span style={{ font: "500 15px/1.4 var(--font-body)" }}>Built with Claude Code</span>
  </div>
);
