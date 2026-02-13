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

/** Navigation commands available on all pages (global command bar). */
export function createNavigationCommands(): CommandDef[] {
  const studioEnabled = isStudioEnabled();

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

  return commands;
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
