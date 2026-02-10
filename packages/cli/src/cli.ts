import { parseArgs as nodeParseArgs } from "node:util";

const DEFAULT_SERVER = "https://chapa.thecreativetoken.com";

export interface CliArgs {
  command: "merge" | null;
  handle?: string;
  emuHandle?: string;
  emuToken?: string;
  token?: string;
  server: string;
}

export function parseArgs(argv: string[]): CliArgs {
  // Extract positional command before flags
  const positional = argv.find((a) => !a.startsWith("--"));
  const command = positional === "merge" ? "merge" : null;

  // Remove positional from argv for nodeParseArgs
  const flagArgs = argv.filter((a) => a !== positional || a.startsWith("--"));

  const { values } = nodeParseArgs({
    args: flagArgs,
    options: {
      handle: { type: "string" },
      "emu-handle": { type: "string" },
      "emu-token": { type: "string" },
      token: { type: "string" },
      server: { type: "string", default: DEFAULT_SERVER },
    },
    strict: false,
  });

  return {
    command,
    handle: values.handle as string | undefined,
    emuHandle: values["emu-handle"] as string | undefined,
    emuToken: values["emu-token"] as string | undefined,
    token: values.token as string | undefined,
    server: (values.server as string) ?? DEFAULT_SERVER,
  };
}
