import { makeLine, type CommandDef, type CommandDescriptions } from "../terminal/command-registry";

export const LANDING_SECTIONS = {
  hero: "hero", identity: "identity", features: "features", scoring: "scoring",
  "how-it-works": "how-it-works", embed: "how-it-works", enterprise: "enterprise",
  "agent-tools": "agent-tools", trust: "trust", closing: "closing",
} as const;
const ARCHETYPES = ["builder", "guardian", "marathoner", "polymath", "artificer", "balanced", "emerging"];
const DIMENSIONS = ["delivery", "quality", "consistency", "breadth", "craft"];

export function createLandingCommands(descriptions: CommandDescriptions = {}, messages: CommandDescriptions = {}): CommandDef[] {
  const section = (id: string) => ({type: "custom" as const, event: "chapa:landing-section", detail: {id}});
  const usageError = (usage: string) => ({lines: [makeLine("error", `${messages.usage ?? "Usage:"} ${usage}`)]});
  return [
    ...([
      ["archetypes", ARCHETYPES, "features", "chapa:landing-archetype"],
      ["dimensions", DIMENSIONS, "scoring", "chapa:landing-dimension"],
    ] as const).map(([name, ids, root, event]): CommandDef => {
      const usage = `/${name} [${ids.join("|")}]`;
      return {name: `/${name}`, description: descriptions[name] ?? name, usage, execute: args => {
        if (args.length > 1 || (args[0] && !ids.includes(args[0]))) return usageError(usage);
        return {lines: [], action: args[0] ? {type: "custom", event, detail: {id: args[0]}} : section(root)};
      }};
    }),
    {name: "/section", description: descriptions.section ?? "Explore a section", usage: `/section <${Object.keys(LANDING_SECTIONS).join("|")}>`, execute: args => {
      const id = args[0];
      if (args.length !== 1 || !id || !Object.hasOwn(LANDING_SECTIONS, id)) return usageError(`/section <${Object.keys(LANDING_SECTIONS).join("|")}>`);
      return {lines: [], action: section(LANDING_SECTIONS[id as keyof typeof LANDING_SECTIONS])};
    }},
    ...([['embed', 'how-it-works'], ['mcp', 'agent-tools']] as const).map(([name, id]): CommandDef => ({name: `/${name}`, description: descriptions[name] ?? name, execute: args => args.length ? usageError(`/${name}`) : {lines: [], action: section(id)}})),
    {name: "/copy", description: descriptions.copy ?? "Copy the example embed", execute: args => args.length ? usageError("/copy") : {lines: [], action: {type: "custom", event: "chapa:landing-copy"}}},
    {name: "/whoami", description: descriptions.whoami ?? "About this sample", execute: args => args.length ? usageError("/whoami") : {lines: [makeLine("info", messages.sampleIdentity ?? "You are exploring an illustrative sample, not a personal account.")] }},
  ];
}
