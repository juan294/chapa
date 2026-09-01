export type AgentClass =
  | "openai"
  | "anthropic"
  | "perplexity"
  | "google"
  | "meta"
  | "mcp-client"
  | "generic-bot"
  | null;

const KNOWN_AGENT_PATTERNS: ReadonlyArray<readonly [
  Exclude<AgentClass, "mcp-client" | "generic-bot" | null>,
  readonly string[],
]> = [
  ["openai", ["gptbot", "chatgpt-user", "oai-searchbot"]],
  ["anthropic", ["claudebot", "claude-user", "claude-web", "anthropic-ai"]],
  ["perplexity", ["perplexitybot", "perplexity-user"]],
  ["google", ["google-extended", "googleother"]],
  ["meta", ["meta-externalagent"]],
];

const DEFAULT_HTTP_CLIENT_UA = /^(?:node-fetch(?:\/|\s|$)|undici(?:\/|\s|$))/;

export function classifyAgentUserAgent(ua: string | null): AgentClass {
  if (!ua) return null;
  const normalized = ua.toLowerCase().trim();
  if (!normalized || DEFAULT_HTTP_CLIENT_UA.test(normalized)) return null;

  for (const [agentClass, patterns] of KNOWN_AGENT_PATTERNS) {
    if (patterns.some((pattern) => normalized.includes(pattern))) {
      return agentClass;
    }
  }
  if (normalized.includes("mcp")) return "mcp-client";
  if (/bot|crawler|spider/.test(normalized)) return "generic-bot";
  return null;
}
