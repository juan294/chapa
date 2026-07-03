#!/usr/bin/env node
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface WriteRoute {
  key: string;
  method: HttpMethod;
  routePath: string;
  routeFile: string;
}

export interface RegistrationResult {
  discovered: WriteRoute[];
  registered: WriteRoute[];
  exempt: Array<WriteRoute & { reason: string }>;
  unregistered: WriteRoute[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.join(__dirname, "..");
const DEFAULT_API_ROOT = path.join(REPO_ROOT, "apps", "web", "app", "api");
const WRITE_METHODS: readonly HttpMethod[] = ["POST", "PUT", "PATCH", "DELETE"];
const EXPORTED_METHOD_RE =
  /export\s+(?:const|async\s+function)\s+(GET|POST|PUT|PATCH|DELETE)\b/g;

export const DEFAULT_KNOWN_WRITE_GETS = new Set<string>([
  "GET /api/auth/login",
  "GET /api/auth/callback",
  "GET /api/auth/bitbucket/callback",
  "GET /api/auth/codeberg/callback",
  "GET /api/auth/gitlab/callback",
  "GET /api/cli/auth/poll",
  "GET /api/notifications/unsubscribe",
  "GET /api/cron/warm-cache",
  "GET /api/cron/sync-audience",
  "GET /api/cron/process-campaigns",
]);

export const DEFAULT_EXEMPTIONS: Readonly<Record<string, string>> = {
  "POST /api/webhooks/resend":
    "Svix HMAC-verified provider payload, not user JSON",
  "GET /api/cron/warm-cache":
    "CRON_SECRET, no body — freshness gated by heartbeat health checks",
  "GET /api/cron/sync-audience": "CRON_SECRET, no body",
  "GET /api/cron/process-campaigns": "CRON_SECRET, no body",
  "POST /api/admin/agents/run": "dev-only, prod-blocked",
  "DELETE /api/admin/agents/run": "dev-only, prod-blocked",
};

export function discoverWriteRoutes(
  apiRoot = DEFAULT_API_ROOT,
  knownWriteGets: ReadonlySet<string> = DEFAULT_KNOWN_WRITE_GETS,
): WriteRoute[] {
  const routeFiles = walkFiles(apiRoot).filter((file) => file.endsWith("route.ts"));
  const routes: WriteRoute[] = [];

  for (const routeFile of routeFiles) {
    const source = fs.readFileSync(routeFile, "utf8");
    const routePath = toApiRoutePath(apiRoot, routeFile);
    const methods = new Set<HttpMethod>();
    let match: RegExpExecArray | null;
    EXPORTED_METHOD_RE.lastIndex = 0;

    while ((match = EXPORTED_METHOD_RE.exec(source)) !== null) {
      methods.add(match[1] as HttpMethod);
    }

    for (const method of methods) {
      const key = `${method} ${routePath}`;
      if (WRITE_METHODS.includes(method) || knownWriteGets.has(key)) {
        routes.push({ key, method, routePath, routeFile });
      }
    }
  }

  return routes.sort((a, b) => a.key.localeCompare(b.key));
}

export function isRouteRegistered(route: WriteRoute): boolean {
  const dir = path.dirname(route.routeFile);
  const testFiles = walkFiles(dir).filter((file) => file.endsWith(".contract.test.ts"));
  const methodImportRe = new RegExp(
    `import\\s*\\{[^}]*\\b${route.method}\\b[^}]*\\}\\s*from\\s*["']\\.\\/route["']`,
  );

  return testFiles.some((testFile) => {
    const source = fs.readFileSync(testFile, "utf8");
    return methodImportRe.test(source);
  });
}

export function evaluateRegistration(options: {
  apiRoot?: string;
  knownWriteGets?: ReadonlySet<string>;
  exemptions?: Readonly<Record<string, string>>;
} = {}): RegistrationResult {
  const exemptions = options.exemptions ?? DEFAULT_EXEMPTIONS;
  const discovered = discoverWriteRoutes(options.apiRoot, options.knownWriteGets);
  const registered: WriteRoute[] = [];
  const exempt: Array<WriteRoute & { reason: string }> = [];
  const unregistered: WriteRoute[] = [];

  for (const route of discovered) {
    const reason = exemptions[route.key];
    if (reason) {
      exempt.push({ ...route, reason });
      continue;
    }
    if (isRouteRegistered(route)) {
      registered.push(route);
      continue;
    }
    unregistered.push(route);
  }

  return { discovered, registered, exempt, unregistered };
}

function walkFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const entries = fs.readdirSync(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function toApiRoutePath(apiRoot: string, routeFile: string): string {
  const relativeDir = path.relative(apiRoot, path.dirname(routeFile));
  return `/api/${relativeDir.split(path.sep).join("/")}`;
}

function parseMaxUnregistered(argv: string[]): number {
  const index = argv.indexOf("--max-unregistered");
  if (index === -1) return 0;
  const value = argv[index + 1];
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("--max-unregistered must be a non-negative integer");
  }
  return parsed;
}

function main(): void {
  const maxUnregistered = parseMaxUnregistered(process.argv.slice(2));
  const result = evaluateRegistration();

  console.log(`Discovered ${result.discovered.length} write route(s).`);
  console.log(`Registered: ${result.registered.length}`);
  console.log(`Exempt: ${result.exempt.length}`);
  console.log(`Unregistered: ${result.unregistered.length}\n`);

  if (result.exempt.length > 0) {
    console.log("Exempt routes:");
    for (const route of result.exempt) {
      console.log(`  - ${route.key}: ${route.reason}`);
    }
    console.log();
  }

  if (result.unregistered.length > 0) {
    console.log("Unregistered write routes:");
    for (const route of result.unregistered) {
      const relative = path.relative(REPO_ROOT, route.routeFile);
      console.log(`  - ${route.key} (${relative})`);
    }
    console.log();
  }

  if (result.unregistered.length > maxUnregistered) {
    console.error(
      `Write-route registration failed: ${result.unregistered.length} unregistered route(s), max allowed ${maxUnregistered}.`,
    );
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
