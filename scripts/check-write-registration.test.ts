import { afterEach, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  discoverWriteRoutes,
  evaluateRegistration,
} from "./check-write-registration";

const tmpRoots: string[] = [];

function makeTmpApiRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "write-registration-"));
  tmpRoots.push(root);
  return path.join(root, "apps", "web", "app", "api");
}

function writeFile(file: string, source: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, source);
}

afterEach(() => {
  for (const root of tmpRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("check-write-registration", () => {
  it("discovers exported write methods and known mutating GETs", () => {
    const apiRoot = makeTmpApiRoot();
    writeFile(
      path.join(apiRoot, "example", "route.ts"),
      `
        export const POST = async () => new Response();
        export async function GET() { return new Response(); }
      `,
    );
    const knownWriteGets = new Set(["GET /api/example"]);

    const routes = discoverWriteRoutes(apiRoot, knownWriteGets).map((route) => route.key);

    expect(routes).toEqual(["GET /api/example", "POST /api/example"]);
  });

  it("reports an unregistered non-exempt write route", () => {
    const apiRoot = makeTmpApiRoot();
    writeFile(
      path.join(apiRoot, "example", "route.ts"),
      `export const POST = async () => new Response();`,
    );

    const result = evaluateRegistration({ apiRoot, knownWriteGets: new Set(), exemptions: {} });

    expect(result.unregistered.map((route) => route.key)).toEqual([
      "POST /api/example",
    ]);
  });

  it("does not report an explicitly exempt write route", () => {
    const apiRoot = makeTmpApiRoot();
    writeFile(
      path.join(apiRoot, "webhooks", "resend", "route.ts"),
      `export const POST = async () => new Response();`,
    );

    const result = evaluateRegistration({
      apiRoot,
      knownWriteGets: new Set(),
      exemptions: {
        "POST /api/webhooks/resend": "provider webhook",
      },
    });

    expect(result.exempt.map((route) => route.key)).toEqual([
      "POST /api/webhooks/resend",
    ]);
    expect(result.unregistered).toHaveLength(0);
  });

  it("treats a colocated contract test importing the method from ./route as registered", () => {
    const apiRoot = makeTmpApiRoot();
    writeFile(
      path.join(apiRoot, "example", "route.ts"),
      `export const PUT = async () => new Response();`,
    );
    writeFile(
      path.join(apiRoot, "example", "route.contract.test.ts"),
      `
        import { PUT } from "./route";
        void PUT;
      `,
    );

    const result = evaluateRegistration({ apiRoot, knownWriteGets: new Set(), exemptions: {} });

    expect(result.registered.map((route) => route.key)).toEqual([
      "PUT /api/example",
    ]);
    expect(result.unregistered).toHaveLength(0);
  });
});
