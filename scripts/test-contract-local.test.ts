import { describe, expect, it } from "vitest";
import { parseSupabaseEnv } from "./test-contract-local";

describe("parseSupabaseEnv", () => {
  it("parses KEY=\"VALUE\" lines from `supabase status -o env` stdout", () => {
    const stdout = [
      'ANON_KEY="anon-key-value"',
      'API_URL="http://127.0.0.1:54331"',
      'DB_URL="postgresql://postgres:postgres@127.0.0.1:54332/postgres"',
      'SERVICE_ROLE_KEY="service-role-key-value"',
      'STUDIO_URL="http://127.0.0.1:54333"',
    ].join("\n");

    expect(parseSupabaseEnv(stdout)).toEqual({
      ANON_KEY: "anon-key-value",
      API_URL: "http://127.0.0.1:54331",
      DB_URL: "postgresql://postgres:postgres@127.0.0.1:54332/postgres",
      SERVICE_ROLE_KEY: "service-role-key-value",
      STUDIO_URL: "http://127.0.0.1:54333",
    });
  });

  it("ignores WARN/log lines mixed into stdout", () => {
    const stdout = [
      "WARN: config section [inbucket] is deprecated. Please use [local_smtp] instead.",
      'API_URL="http://127.0.0.1:54331"',
      "Stopped services: [supabase_imgproxy_chapa]",
      'SERVICE_ROLE_KEY="service-role-key-value"',
    ].join("\n");

    expect(parseSupabaseEnv(stdout)).toEqual({
      API_URL: "http://127.0.0.1:54331",
      SERVICE_ROLE_KEY: "service-role-key-value",
    });
  });

  it("returns an empty object for empty stdout", () => {
    expect(parseSupabaseEnv("")).toEqual({});
  });

  it("does not match values that aren't quoted", () => {
    const stdout = ["API_URL=http://127.0.0.1:54331 (unquoted)"].join("\n");
    expect(parseSupabaseEnv(stdout)).toEqual({});
  });
});
