"use client";

import { useState } from "react";
import type { SharedContextEntry } from "../agents-types";

interface CrossAgentInsightsProps {
  entries: SharedContextEntry[];
}

/** Simple markdown to HTML: headings, bold, bullets, inline code. */
function renderMarkdown(md: string): string {
  return md
    .split("\n")
    .map((line) => {
      // Headings
      if (line.startsWith("## "))
        return `<h3 class="font-heading text-sm font-medium text-text-primary mt-3 mb-1">${line.slice(3)}</h3>`;
      if (line.startsWith("# "))
        return `<h2 class="font-heading text-base font-medium text-text-primary mt-3 mb-1">${line.slice(2)}</h2>`;
      // Bullets
      if (line.startsWith("- ")) {
        const content = line.slice(2);
        return `<li class="ml-4 text-text-primary">${inlineFormat(content)}</li>`;
      }
      // Empty lines
      if (line.trim() === "") return "";
      // Regular text
      return `<p class="text-text-primary">${inlineFormat(line)}</p>`;
    })
    .join("");
}

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    .replace(/`(.+?)`/g, '<code class="bg-stroke/50 px-1 rounded text-amber text-xs">$1</code>');
}

export function CrossAgentInsights({ entries }: CrossAgentInsightsProps) {
  // Group entries by agent, pick most recent per agent
  const latestByAgent = new Map<string, SharedContextEntry>();
  for (const entry of entries) {
    const existing = latestByAgent.get(entry.agent);
    if (!existing || entry.timestamp > existing.timestamp) {
      latestByAgent.set(entry.agent, entry);
    }
  }

  const agentKeys = Array.from(latestByAgent.keys());
  const [selected, setSelected] = useState(agentKeys[0] ?? "");

  if (agentKeys.length === 0) {
    return (
      <div className="rounded-xl border border-stroke bg-card p-4">
        <p className="font-heading text-sm text-text-secondary">
          <span className="text-terminal-dim">$</span> agents/insights — No
          shared context available yet. Run an agent to generate insights.
        </p>
      </div>
    );
  }

  const entry = latestByAgent.get(selected);

  return (
    <div className="rounded-xl border border-stroke bg-card overflow-hidden">
      {/* Agent pills */}
      <div className="flex gap-2 border-b border-stroke px-4 py-3">
        <span className="font-heading text-xs text-terminal-dim mr-1">
          $ agents/insights
        </span>
        {agentKeys.map((key) => (
          <button
            key={key}
            onClick={() => setSelected(key)}
            className={`rounded-md px-2.5 py-1 text-xs font-heading transition-colors ${
              selected === key
                ? "bg-amber text-white"
                : "bg-stroke/50 text-text-secondary hover:text-text-primary"
            }`}
          >
            {key.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {/* Content */}
      {entry && (
        <div className="p-4 text-sm leading-relaxed">
          <p className="text-xs text-text-secondary mb-2">
            Updated: {new Date(entry.timestamp).toLocaleString()}
          </p>
          <div
            className="space-y-1"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(entry.content) }}
          />
        </div>
      )}
    </div>
  );
}
