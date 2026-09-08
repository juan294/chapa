import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { getSupabaseUrl } from "@/lib/env";

/** Test-only inspection of the established local project. Credentials come
 * from test:contract:local; this helper never reads any environment file.
 * Guard cleanup as well as inspection so failed setup cannot mutate a host.
 */
export function assertLocalSqlTarget(): string {
  let endpoint: URL;
  try {
    endpoint = new URL(getSupabaseUrl() ?? "");
  } catch {
    throw new Error("Local SQL inspection requires a loopback Supabase URL");
  }
  if (!["http:", "https:"].includes(endpoint.protocol)
    || !["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname)
    || endpoint.username || endpoint.password) {
    throw new Error("Local SQL inspection requires a loopback Supabase URL");
  }

  const config = readFileSync("supabase/config.toml", "utf8");
  const root = config.split(/^\s*\[/m)[0] ?? "";
  const identities = [...root.matchAll(/^\s*project_id\s*=\s*(.*?)\s*$/gm)];
  const project = identities.length === 1
    ? identities[0]?.[1]?.match(/^"([A-Za-z0-9_-]+)"\s*(?:#.*)?$/)?.[1]
    : undefined;
  if (!project) throw new Error("Missing, unsafe or ambiguous local Supabase project identity");

  // The HTTP fixtures and the SQL privilege assertions must inspect the same
  // local project, even when several disposable Supabase stacks are running.
  const apiSections = config.split(/(?=^[ \t]*\[)/m)
    .filter(section => /^[ \t]*\[api\][ \t]*(?:#.*)?\r?\n/.test(section));
  const ports = [...(apiSections[0] ?? "").matchAll(/^[ \t]*port[ \t]*=[ \t]*(.*)$/gm)];
  const port = ports[0]?.[1]?.match(/^(\d+)[ \t]*(?:#.*)?$/)?.[1];
  if (apiSections.length !== 1 || ports.length !== 1 || !port
    || Number(port) < 1 || Number(port) > 65535
    || Number(endpoint.port || (endpoint.protocol === "https:" ? 443 : 80)) !== Number(port)) {
    throw new Error("Supabase URL must match the unambiguous local config API port");
  }

  const container = `supabase_db_${project}`;
  const names = execFileSync("docker", ["ps", "--filter", `name=^/${container}$`, "--format", "{{.Names}}"], { encoding: "utf8" })
    .trim().split("\n").filter(Boolean);
  if (names.length !== 1 || names[0] !== container) {
    throw new Error("Local SQL inspection requires exactly one running configured database container");
  }
  return container;
}

export function inspectLocalSql(statement: string): string {
  const container = assertLocalSqlTarget();
  return execFileSync("docker", ["exec", container, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-At", "-c", statement], { encoding: "utf8" }).trim();
}
