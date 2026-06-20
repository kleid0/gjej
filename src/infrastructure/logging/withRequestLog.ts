// One-line-per-request logging wrapper for API route handlers.
//
// Console-only by design: user-facing routes have no end-of-run git commit to
// ride, so their request logs live in Vercel's runtime logs (read live via the
// dashboard / Vercel MCP). Committing per request would blow GitHub rate limits
// and trigger a Vercel deploy on every hit.

import type { NextRequest } from "next/server";
import { createLogger } from "./logger";

type RouteContext = { params?: Record<string, string | string[]> };
// ctx is optional so wrapped handlers stay callable with a single argument
// (Next.js passes it for dynamic routes; internal callers / tests omit it).
type RouteHandler = (req: NextRequest, ctx?: RouteContext) => Promise<Response> | Response;

/**
 * Wrap a route handler so every request emits one structured line
 * (method, path, status, duration in ms; plus the error on a throw).
 */
export function withRequestLog(scope: string, handler: RouteHandler): RouteHandler {
  const log = createLogger(`api/${scope}`);
  return async (req, ctx) => {
    const start = Date.now();
    const meta = { method: req.method, path: req.nextUrl.pathname };
    try {
      const res = await handler(req, ctx);
      log.info("request", { ...meta, status: res.status, ms: Date.now() - start });
      return res;
    } catch (err) {
      log.error("request failed", { ...meta, ms: Date.now() - start, err });
      throw err;
    }
  };
}
