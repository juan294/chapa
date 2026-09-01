import { after } from "next/server";
import { classifyAgentUserAgent } from "./agent-ua";
import { captureServerEvent } from "./server-errors";

export function scheduleServerEvent(
  event: string,
  properties: Record<string, unknown>,
): void {
  try {
    after(() => captureServerEvent(event, properties));
  } catch {
    // Observability must never change request behavior.
  }
}

export function scheduleAgentSurfaceFetch(
  request: Request,
  surface: string,
): void {
  const agentClass = classifyAgentUserAgent(
    request.headers.get("user-agent"),
  );
  if (!agentClass) return;

  scheduleServerEvent("agent_surface_fetch", { surface, agentClass });
}
