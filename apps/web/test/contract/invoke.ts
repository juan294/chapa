import { NextRequest } from "next/server";
import { expect } from "vitest";
import { generateCliToken } from "@/lib/auth/cli-token";
import { getSupabase } from "@/lib/db/supabase";
import type { MatrixResponse, Payload } from "./payload-matrix";

type Handler = (request: NextRequest) => Promise<Response> | Response;

export interface InvokeJsonOptions {
  method: string;
  path: string;
  body?: unknown;
  bearer?: string;
  headers?: Record<string, string>;
}

export function makeCliBearer(handle: string): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for CLI bearer tokens");
  return generateCliToken(handle, secret);
}

export async function invokeJson(
  handler: Handler,
  options: InvokeJsonOptions,
): Promise<MatrixResponse> {
  const headers = new Headers({
    "Content-Type": "application/json",
    ...options.headers,
  });
  if (options.bearer) headers.set("Authorization", `Bearer ${options.bearer}`);

  const request = new NextRequest(`https://contract.test${options.path}`, {
    method: options.method,
    headers,
    body:
      options.body === undefined
        ? undefined
        : typeof options.body === "string"
          ? options.body
          : JSON.stringify(options.body),
  });

  const response = await handler(request);
  const text = await response.text();
  let body: unknown = text;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: response.status, ok: response.ok, body };
}

export function getServiceClient() {
  const db = getSupabase();
  if (!db) throw new Error("Contract tests require Supabase service client");
  return db;
}

export async function seedUser(handle: string): Promise<void> {
  const db = getServiceClient();
  const { error } = await db
    .from("users")
    .upsert({ handle: handle.toLowerCase() }, { onConflict: "handle" });
  expect(error).toBeNull();
}

export async function cleanupUser(handle: string): Promise<void> {
  const db = getServiceClient();
  const lower = handle.toLowerCase();
  await Promise.allSettled([
    db.from("tool_insights").delete().eq("handle", lower),
    db.from("supplemental_stats").delete().eq("target_handle", lower),
    db.from("users").delete().eq("handle", lower),
  ]);
}

export function bodyAsRecord(response: MatrixResponse): Record<string, unknown> {
  if (response.body == null || typeof response.body !== "object") return {};
  return response.body as Record<string, unknown>;
}

export function payloadWith<T extends Payload>(payload: Payload): T {
  return payload as T;
}
