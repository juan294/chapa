import { isStudioEnabled } from "../../lib/feature-flags";

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
  | { type: "reset" }
  | { type: "custom"; event: string; detail?: Record<string, unknown> };

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

/** Sort field aliases for /sort command (alias → SortField) */
const SORT_FIELD_ALIASES: Record<string, string> = {
  handle: "handle",
  name: "handle",
  archetype: "archetype",
  tier: "tier",
  score: "adjustedComposite",
  confidence: "confidence",
  conf: "confidence",
  commits: "commitsTotal",
  prs: "prsMergedCount",
  reviews: "reviewsSubmittedCount",
  days: "activeDays",
  stars: "totalStars",
  updated: "fetchedAt",
};

/** Admin-only commands for the admin dashboard. */
export function createAdminCommands(): CommandDef[] {
  return [
    {
      name: "/admin",
      description: "Navigate to admin dashboard",
      execute: () => ({
        lines: [makeLine("system", "Opening admin dashboard...")],
        action: { type: "navigate", path: "/admin" },
      }),
    },
    {
      name: "/refresh",
      description: "Refresh dashboard data",
      execute: () => ({
        lines: [makeLine("system", "Refreshing dashboard data...")],
        action: { type: "custom", event: "chapa:admin-refresh" },
      }),
    },
    {
      name: "/sort",
      description: "Sort table by field",
      usage: "/sort <field>",
      execute: (args) => {
        if (args.length === 0) {
          const fields = Object.keys(SORT_FIELD_ALIASES).join(", ");
          return {
            lines: [
              makeLine("error", `Usage: /sort <field>`),
              makeLine("info", `Available fields: ${fields}`),
            ],
          };
        }
        const alias = args[0]!.toLowerCase();
        const field = SORT_FIELD_ALIASES[alias];
        if (!field) {
          const fields = Object.keys(SORT_FIELD_ALIASES).join(", ");
          return {
            lines: [
              makeLine("error", `Unknown sort field: ${alias}`),
              makeLine("info", `Available fields: ${fields}`),
            ],
          };
        }
        return {
          lines: [makeLine("system", `Sorting by ${alias}...`)],
          action: { type: "custom", event: "chapa:admin-sort", detail: { field } },
        };
      },
    },
  ];
}

/** Navigation commands available on all pages (global command bar). */
export function createNavigationCommands(options?: {
  isAdmin?: boolean;
}): CommandDef[] {
  const studioEnabled = isStudioEnabled();
  const isAdmin = options?.isAdmin ?? false;

  const helpLines: OutputLine[] = [
    makeLine("system", "Available commands:"),
    makeLine("info", "  /help              List available commands"),
    makeLine("info", "  /home              Go to home page"),
    ...(studioEnabled
      ? [makeLine("info", "  /studio            Open Creator Studio")]
      : []),
    makeLine("info", "  /login             Sign in with GitHub"),
    makeLine("info", "  /badge <handle>    View a developer badge"),
    makeLine("info", "  /about             About Chapa"),
    makeLine("info", "  /terms             Terms of Service"),
    makeLine("info", "  /privacy           Privacy Policy"),
    makeLine("dim", ""),
    makeLine("system", "Archetypes:"),
    makeLine("info", "  /builder           The Builder archetype"),
    makeLine("info", "  /guardian           The Guardian archetype"),
    makeLine("info", "  /marathoner        The Marathoner archetype"),
    makeLine("info", "  /polymath          The Polymath archetype"),
    makeLine("info", "  /balanced          The Balanced archetype"),
    makeLine("info", "  /emerging          The Emerging archetype"),
    ...(isAdmin
      ? [
          makeLine("dim", ""),
          makeLine("system", "Admin:"),
          makeLine("info", "  /admin             Navigate to admin dashboard"),
          makeLine("info", "  /refresh           Refresh dashboard data"),
          makeLine("info", "  /sort <field>      Sort table by field"),
        ]
      : []),
  ];

  const commands: CommandDef[] = [
    {
      name: "/help",
      description: "List available commands",
      execute: () => ({ lines: helpLines }),
    },
    {
      name: "/home",
      description: "Go to home page",
      execute: () => ({
        lines: [makeLine("system", "Going home...")],
        action: { type: "navigate", path: "/" },
      }),
    },
    ...(studioEnabled
      ? [
          {
            name: "/studio",
            description: "Open Creator Studio",
            execute: () => ({
              lines: [makeLine("system", "Opening Creator Studio...")],
              action: { type: "navigate" as const, path: "/studio" },
            }),
          },
        ]
      : []),
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
        const handle = args[0]!.replace(/^@/, "");
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
    {
      name: "/builder",
      description: "The Builder archetype",
      execute: () => ({
        lines: [makeLine("system", "Opening Builder archetype...")],
        action: { type: "navigate", path: "/archetypes/builder" },
      }),
    },
    {
      name: "/guardian",
      description: "The Guardian archetype",
      execute: () => ({
        lines: [makeLine("system", "Opening Guardian archetype...")],
        action: { type: "navigate", path: "/archetypes/guardian" },
      }),
    },
    {
      name: "/marathoner",
      description: "The Marathoner archetype",
      execute: () => ({
        lines: [makeLine("system", "Opening Marathoner archetype...")],
        action: { type: "navigate", path: "/archetypes/marathoner" },
      }),
    },
    {
      name: "/polymath",
      description: "The Polymath archetype",
      execute: () => ({
        lines: [makeLine("system", "Opening Polymath archetype...")],
        action: { type: "navigate", path: "/archetypes/polymath" },
      }),
    },
    {
      name: "/balanced",
      description: "The Balanced archetype",
      execute: () => ({
        lines: [makeLine("system", "Opening Balanced archetype...")],
        action: { type: "navigate", path: "/archetypes/balanced" },
      }),
    },
    {
      name: "/emerging",
      description: "The Emerging archetype",
      execute: () => ({
        lines: [makeLine("system", "Opening Emerging archetype...")],
        action: { type: "navigate", path: "/archetypes/emerging" },
      }),
    },
    ...(isAdmin ? createAdminCommands() : []),
  ];

  return commands;
}

export function parseCommand(input: string): { name: string; args: string[] } | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;

  const parts = trimmed.split(/\s+/);
  const name = parts[0]!.toLowerCase();
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
