type LogLevel = "info" | "warn" | "error";
type LogExtras = Record<string, unknown>;

function emit(level: LogLevel, msg: string, extras?: LogExtras): void {
  const entry = {
    level,
    msg,
    ts: new Date().toISOString(),
    env: process.env.VERCEL_ENV ?? "development",
    ...extras,
  };
  console.log(JSON.stringify(entry));
}

export const log = {
  info: (msg: string, extras?: LogExtras) => emit("info", msg, extras),
  warn: (msg: string, extras?: LogExtras) => emit("warn", msg, extras),
  error: (msg: string, extras?: LogExtras) => emit("error", msg, extras),
};
