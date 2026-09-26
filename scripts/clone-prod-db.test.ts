import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { cloneProdDb, preflightCollectionStorage } from "./clone-prod-db";

const source = { url: "https://source.example", key: "test-service-role" };
const directories: string[] = [];
afterEach(() => {
  vi.unstubAllGlobals();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

it("rejects generation-backed data before any local clone deletion", async () => {
  const calls = vi.fn(async () => reply([{ id: "generation" }]));
  vi.stubGlobal("fetch", calls);
  const directory = mkdtempSync(join(tmpdir(), "chapa-clone-preflight-"));
  directories.push(directory);
  const sourcePath = join(directory, "source.env");
  const targetPath = join(directory, "target.env");
  writeFileSync(sourcePath, `SUPABASE_URL=${source.url}\nSUPABASE_SERVICE_ROLE_KEY=${source.key}\n`);
  writeFileSync(targetPath, "SUPABASE_URL=http://127.0.0.1:54331\nSUPABASE_SERVICE_ROLE_KEY=local-test\n");
  await expect(cloneProdDb(sourcePath, targetPath)).rejects.toThrow("local database is unchanged");
  expect(calls).toHaveBeenCalledTimes(1);
  expect(calls.mock.calls[0]?.[1]).toMatchObject({ headers: expect.any(Object) });
});

it("rejects a row-mode observation even when no generation row is visible", async () => {
  const calls = vi.fn()
    .mockResolvedValueOnce(reply([]))
    .mockResolvedValueOnce(reply([{ id: "observation" }]));
  vi.stubGlobal("fetch", calls);
  await expect(preflightCollectionStorage(source)).rejects.toThrow("row-mode observations");
  expect(calls).toHaveBeenCalledTimes(2);
});

it("allows a pre-061 source and fails closed on an unreadable source", async () => {
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce(reply({ code: "PGRST205" }, 404))
    .mockResolvedValueOnce(reply({ code: "42703" }, 400)));
  await expect(preflightCollectionStorage(source)).resolves.toBeUndefined();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ code: "42501" }, 403)));
  await expect(preflightCollectionStorage(source)).rejects.toThrow("Cannot inspect scoring_collection_generations");
});
