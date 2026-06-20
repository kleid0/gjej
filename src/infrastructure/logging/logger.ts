// Structured, single-line-JSON logger shared by API routes, cron jobs, and
// infrastructure services.
//
// Two channels (see tasks/todo.md for the full rationale):
//   1. Console — every entry at/above LOG_LEVEL is written as ONE line of JSON
//      to stdout/stderr. On Vercel these become the runtime logs, readable
//      live via the dashboard or the Vercel MCP. Single-line JSON keeps each
//      entry under Vercel's ~4 KB per-line truncation limit and parseable.
//   2. Git buffer — every entry at/above LOG_PERSIST_LEVEL is appended to an
//      in-memory buffer that cron / committing routes flush to
//      data/logs/events.ndjson (see ./gitSink). That file rides the existing
//      chore(data): commit, so it adds no extra Vercel deploys and survives
//      indefinitely for later inspection.

export type LogLevel = "debug" | "info" | "warn" | "error";

const SEVERITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolveLevel(value: string | undefined, fallback: LogLevel): LogLevel {
  const v = (value ?? "").toLowerCase();
  return v in SEVERITY ? (v as LogLevel) : fallback;
}

// Default to the chattiest level on both channels ("super chatty"). Set
// LOG_LEVEL / LOG_PERSIST_LEVEL=info to quieten the console / git trail.
const CONSOLE_LEVEL = resolveLevel(process.env.LOG_LEVEL, "debug");
const PERSIST_LEVEL = resolveLevel(process.env.LOG_PERSIST_LEVEL, "debug");

export interface LogEntry {
  /** ISO-8601 timestamp. */
  t: string;
  level: LogLevel;
  /** Logical source, e.g. "cron/refresh-prices" or "scraper/woo". */
  scope: string;
  msg: string;
  /** Arbitrary structured fields. */
  [key: string]: unknown;
}

export type LogFields = Record<string, unknown>;

// ── Git-sink buffer ─────────────────────────────────────────────────────────
// Bounded so a long-lived warm instance serving many requests (whose buffer is
// never flushed) can't grow without limit. The git sink applies its own,
// larger cap on the committed file.
const MAX_BUFFER_ENTRIES = 5000;
const buffer: LogEntry[] = [];

export function bufferLength(): number {
  return buffer.length;
}

/** Drain and return the buffered entries (used by the git sink at flush). */
export function drainBuffer(): LogEntry[] {
  return buffer.splice(0, buffer.length);
}

// ── Serialization ────────────────────────────────────────────────────────────

// axios errors define toJSON(), which JSON.stringify invokes BEFORE the
// replacer — so by the time we see one it's a plain object carrying the entire
// request config (headers, params, the full stack...). Detect that shape and
// keep only the useful, compact fields. Avoids ~1.5 KB lines, keeps Error
// serialization consistent, and prevents request headers leaking into the log.
function isAxiosErrorJson(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "config" in value &&
    "message" in value &&
    ("code" in value || "status" in value)
  );
}

function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (isAxiosErrorJson(value)) {
    const v = value as {
      name?: unknown; message?: unknown; code?: unknown; status?: unknown;
      response?: { status?: unknown }; config?: { url?: unknown; method?: unknown };
    };
    return {
      name: v.name ?? "AxiosError",
      message: v.message,
      code: v.code,
      status: v.status ?? v.response?.status,
      url: v.config?.url,
      method: v.config?.method,
    };
  }
  if (typeof value === "bigint") return value.toString();
  return value;
}

/** Serialize an entry to a single line of JSON, resilient to bad input. */
export function formatEntry(entry: LogEntry): string {
  try {
    return JSON.stringify(entry, replacer);
  } catch {
    // Circular structure or otherwise non-serializable field — fall back to a
    // minimal entry so a logging call never throws.
    return JSON.stringify({
      t: entry.t,
      level: entry.level,
      scope: entry.scope,
      msg: entry.msg,
      _unserializable: true,
    });
  }
}

function emit(scope: string, level: LogLevel, msg: string, fields?: LogFields): void {
  const entry: LogEntry = { t: new Date().toISOString(), level, scope, msg, ...fields };
  const severity = SEVERITY[level];

  if (severity >= SEVERITY[CONSOLE_LEVEL]) {
    const line = formatEntry(entry);
    // Route to the matching console method so Vercel tags the log level, which
    // keeps the MCP `level` filter (and the dashboard's) useful.
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  }

  if (severity >= SEVERITY[PERSIST_LEVEL]) {
    buffer.push(entry);
    if (buffer.length > MAX_BUFFER_ENTRIES) {
      buffer.splice(0, buffer.length - MAX_BUFFER_ENTRIES);
    }
  }
}

export interface Logger {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
  /** Derive a logger with a nested scope and/or merged base fields. */
  child(scope: string, fields?: LogFields): Logger;
}

export function createLogger(scope: string, base?: LogFields): Logger {
  const withBase = (fields?: LogFields): LogFields | undefined =>
    base ? { ...base, ...fields } : fields;
  return {
    debug: (msg, fields) => emit(scope, "debug", msg, withBase(fields)),
    info: (msg, fields) => emit(scope, "info", msg, withBase(fields)),
    warn: (msg, fields) => emit(scope, "warn", msg, withBase(fields)),
    error: (msg, fields) => emit(scope, "error", msg, withBase(fields)),
    child: (childScope, fields) => createLogger(`${scope}/${childScope}`, withBase(fields)),
  };
}
