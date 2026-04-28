type Level = "debug" | "info" | "warn" | "error";

export interface LogContext {
  route?: string;
  requestId?: string;
  handle?: string;
  [k: string]: unknown;
}

export function log(level: Level, msg: string, context: LogContext = {}): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    env: process.env.VERCEL_ENV ?? "development",
    ...context,
  });
  if (level === "error" || level === "warn") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export function getRequestId(req: Request): string {
  return req.headers.get("x-vercel-id") ?? crypto.randomUUID();
}
