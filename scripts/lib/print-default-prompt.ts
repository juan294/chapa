/**
 * Bridge script: prints the default prompt for a given agent key.
 * Used by shell scripts to get the compiled default prompt from TypeScript config.
 *
 * Usage: npx tsx scripts/lib/print-default-prompt.ts <agent_key>
 */

import { AGENTS } from "../../apps/web/lib/agents/agent-config";

const agentKey = process.argv[2];

if (!agentKey) {
  console.error("Usage: print-default-prompt.ts <agent_key>");
  process.exit(1);
}

const agent = AGENTS[agentKey];

if (!agent) {
  console.error(`Unknown agent key: ${agentKey}`);
  console.error(`Available keys: ${Object.keys(AGENTS).join(", ")}`);
  process.exit(1);
}

process.stdout.write(agent.defaultPrompt);
