export type OutputLineType =
  | "info"
  | "success"
  | "error"
  | "warning"
  | "system"
  | "dim"
  | "input";

export interface OutputLine {
  id: string;
  type: OutputLineType;
  text: string;
}

export interface CommandResult {
  lines: OutputLine[];
  action?: CommandAction;
}

export type CommandAction =
  | { type: "navigate"; path: string }
  | { type: "clear" }
  | { type: "set"; category: string; value: string }
  | { type: "preset"; name: string }
  | { type: "save" }
  | { type: "reset" };

export interface CommandDef {
  name: string;
  aliases?: string[];
  description: string;
  usage?: string;
  execute: (args: string[]) => CommandResult;
}

let lineCounter = 0;

export function makeLine(
  type: OutputLineType,
  text: string,
): OutputLine {
  return { id: `line-${++lineCounter}`, type, text };
}

/** Category short aliases for /set */
const CATEGORY_ALIASES: Record<string, string> = {
  bg: "background",
  card: "cardStyle",
  border: "border",
  score: "scoreEffect",
  heatmap: "heatmapAnimation",
  interact: "interaction",
  stats: "statsDisplay",
  tier: "tierTreatment",
  celebrate: "celebration",
};

/** Resolve a short alias or full key to the config key */
export function resolveCategory(input: string): string | null {
  if (CATEGORY_ALIASES[input]) return CATEGORY_ALIASES[input];
  if (Object.values(CATEGORY_ALIASES).includes(input)) return input;
  return null;
}

export function createCoreCommands(): CommandDef[] {
  return [
    {
      name: "/help",
      description: "List all commands",
      execute: () => ({
        lines: [
          makeLine("system", "Available commands:"),
          makeLine("info", "  /help              List all commands"),
          makeLine("info", "  /set <cat> <val>   Set badge config field"),
          makeLine("info", "  /preset <name>     Apply preset (minimal/premium/holographic/maximum)"),
          makeLine("info", "  /save              Save configuration"),
          makeLine("info", "  /reset             Reset to defaults"),
          makeLine("info", "  /embed             Show embed snippets"),
          makeLine("info", "  /share             Show share links"),
          makeLine("info", "  /status            Show current config summary"),
          makeLine("info", "  /clear             Clear output"),
          makeLine("info", "  /login             Go to GitHub login"),
          makeLine("info", "  /studio            Go to Creator Studio"),
          makeLine("info", "  /badge <handle>    Go to share page"),
          makeLine("dim", ""),
          makeLine("dim", "Category aliases for /set:"),
          makeLine("dim", "  bg, card, border, score, heatmap, interact, stats, tier, celebrate"),
        ],
      }),
    },
    {
      name: "/clear",
      description: "Clear output",
      execute: () => ({
        lines: [],
        action: { type: "clear" },
      }),
    },
    {
      name: "/login",
      description: "Navigate to GitHub login",
      execute: () => ({
        lines: [makeLine("system", "Redirecting to GitHub login...")],
        action: { type: "navigate", path: "/api/auth/login" },
      }),
    },
    {
      name: "/studio",
      description: "Navigate to Creator Studio",
      execute: () => ({
        lines: [makeLine("system", "Opening Creator Studio...")],
        action: { type: "navigate", path: "/studio" },
      }),
    },
    {
      name: "/badge",
      aliases: ["/b"],
      description: "Navigate to share page",
      usage: "/badge <handle>",
      execute: (args) => {
        if (args.length === 0) {
          return {
            lines: [makeLine("error", "Usage: /badge <handle>")],
          };
        }
        const handle = args[0].replace(/^@/, "");
        return {
          lines: [makeLine("system", `Opening badge for @${handle}...`)],
          action: { type: "navigate", path: `/u/${handle}` },
        };
      },
    },
    {
      name: "/set",
      description: "Set badge config field",
      usage: "/set <category> <value>",
      execute: (args) => {
        if (args.length < 2) {
          return {
            lines: [
              makeLine("error", "Usage: /set <category> <value>"),
              makeLine("dim", "Example: /set bg aurora"),
            ],
          };
        }
        const catInput = args[0];
        const value = args[1];
        const resolved = resolveCategory(catInput);

        if (!resolved) {
          return {
            lines: [
              makeLine("error", `Unknown category: ${catInput}`),
              makeLine("dim", "Valid: bg, card, border, score, heatmap, interact, stats, tier, celebrate"),
            ],
          };
        }

        return {
          lines: [makeLine("success", `${resolved} → ${value}`)],
          action: { type: "set", category: resolved, value },
        };
      },
    },
    {
      name: "/preset",
      description: "Apply a preset",
      usage: "/preset <name>",
      execute: (args) => {
        if (args.length === 0) {
          return {
            lines: [
              makeLine("error", "Usage: /preset <name>"),
              makeLine("dim", "Available: minimal, premium, holographic, maximum"),
            ],
          };
        }
        const name = args[0].toLowerCase();
        const valid = ["minimal", "premium", "holographic", "maximum"];
        if (!valid.includes(name)) {
          return {
            lines: [
              makeLine("error", `Unknown preset: ${name}`),
              makeLine("dim", `Available: ${valid.join(", ")}`),
            ],
          };
        }
        return {
          lines: [makeLine("success", `Applied preset: ${name}`)],
          action: { type: "preset", name },
        };
      },
    },
    {
      name: "/save",
      description: "Save configuration",
      execute: () => ({
        lines: [makeLine("system", "Saving configuration...")],
        action: { type: "save" },
      }),
    },
    {
      name: "/reset",
      description: "Reset to defaults",
      execute: () => ({
        lines: [makeLine("warning", "Configuration reset to defaults.")],
        action: { type: "reset" },
      }),
    },
    {
      name: "/embed",
      description: "Show embed snippets",
      execute: () => ({
        lines: [
          makeLine("system", "Embed your badge:"),
          makeLine("dim", ""),
          makeLine("info", "Markdown:"),
          makeLine("success", "![Chapa Badge](https://chapa.thecreativetoken.com/u/YOUR_HANDLE/badge.svg)"),
          makeLine("dim", ""),
          makeLine("info", "HTML:"),
          makeLine("success", '<img src="https://chapa.thecreativetoken.com/u/YOUR_HANDLE/badge.svg" alt="Chapa Badge" width="600" />'),
        ],
      }),
    },
    {
      name: "/share",
      description: "Show share links",
      execute: () => ({
        lines: [
          makeLine("system", "Share your badge:"),
          makeLine("info", "Direct link: https://chapa.thecreativetoken.com/u/YOUR_HANDLE"),
          makeLine("info", "Badge SVG:   https://chapa.thecreativetoken.com/u/YOUR_HANDLE/badge.svg"),
        ],
      }),
    },
    {
      name: "/status",
      description: "Show current config summary",
      execute: () => ({
        lines: [makeLine("dim", "Use /status in Creator Studio to see config.")],
      }),
    },
  ];
}

/** Navigation commands available on all pages (global command bar). */
export function createNavigationCommands(): CommandDef[] {
  return [
    {
      name: "/help",
      description: "List available commands",
      execute: () => ({
        lines: [
          makeLine("system", "Available commands:"),
          makeLine("info", "  /help              List available commands"),
          makeLine("info", "  /home              Go to home page"),
          makeLine("info", "  /studio            Open Creator Studio"),
          makeLine("info", "  /login             Sign in with GitHub"),
          makeLine("info", "  /badge <handle>    View a developer badge"),
          makeLine("info", "  /about             About Chapa"),
          makeLine("info", "  /terms             Terms of Service"),
          makeLine("info", "  /privacy           Privacy Policy"),
        ],
      }),
    },
    {
      name: "/home",
      description: "Go to home page",
      execute: () => ({
        lines: [makeLine("system", "Going home...")],
        action: { type: "navigate", path: "/" },
      }),
    },
    {
      name: "/studio",
      description: "Open Creator Studio",
      execute: () => ({
        lines: [makeLine("system", "Opening Creator Studio...")],
        action: { type: "navigate", path: "/studio" },
      }),
    },
    {
      name: "/login",
      description: "Sign in with GitHub",
      execute: () => ({
        lines: [makeLine("system", "Redirecting to GitHub login...")],
        action: { type: "navigate", path: "/api/auth/login" },
      }),
    },
    {
      name: "/badge",
      aliases: ["/b"],
      description: "View a developer badge",
      usage: "/badge <handle>",
      execute: (args) => {
        if (args.length === 0) {
          return {
            lines: [makeLine("error", "Usage: /badge <handle>")],
          };
        }
        const handle = args[0].replace(/^@/, "");
        return {
          lines: [makeLine("system", `Opening badge for @${handle}...`)],
          action: { type: "navigate", path: `/u/${handle}` },
        };
      },
    },
    {
      name: "/about",
      description: "About Chapa",
      execute: () => ({
        lines: [makeLine("system", "Opening about page...")],
        action: { type: "navigate", path: "/about" },
      }),
    },
    {
      name: "/terms",
      description: "Terms of Service",
      execute: () => ({
        lines: [makeLine("system", "Opening terms...")],
        action: { type: "navigate", path: "/terms" },
      }),
    },
    {
      name: "/privacy",
      description: "Privacy Policy",
      execute: () => ({
        lines: [makeLine("system", "Opening privacy policy...")],
        action: { type: "navigate", path: "/privacy" },
      }),
    },
  ];
}

/** @deprecated Use createNavigationCommands() instead */
export function createLandingCommands(): CommandDef[] {
  return createNavigationCommands();
}

export function parseCommand(input: string): { name: string; args: string[] } | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;

  const parts = trimmed.split(/\s+/);
  const name = parts[0].toLowerCase();
  const args = parts.slice(1);

  return { name, args };
}

export function executeCommand(
  input: string,
  commands: CommandDef[],
): CommandResult {
  const parsed = parseCommand(input);

  if (!parsed) {
    return {
      lines: [makeLine("error", `Unknown input. Type /help for commands.`)],
    };
  }

  const cmd = commands.find(
    (c) =>
      c.name === parsed.name ||
      (c.aliases && c.aliases.includes(parsed.name)),
  );

  if (!cmd) {
    return {
      lines: [makeLine("error", `Unknown command: ${parsed.name}. Type /help.`)],
    };
  }

  return cmd.execute(parsed.args);
}

export function getMatchingCommands(
  partial: string,
  commands: CommandDef[],
): CommandDef[] {
  const lower = partial.toLowerCase();
  if (!lower.startsWith("/")) return [];

  return commands.filter(
    (c) =>
      c.name.startsWith(lower) ||
      (c.aliases && c.aliases.some((a) => a.startsWith(lower))),
  );
}
