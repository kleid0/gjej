"use client";

import { useState, useEffect, useRef } from "react";

type Action = "refresh-prices" | "discover" | "fetch-images" | "fuse-duplicates";

interface Result {
  action: Action;
  ok: boolean;
  data: Record<string, unknown>;
}

/* ─── Timing utilities ─── */

const FALLBACK_DURATION: Record<Action, number> = {
  "refresh-prices": 240,
  discover: 60,
  "fetch-images": 90,
  "fuse-duplicates": 15,
};

const HISTORY_KEY = "admin_run_history";
const MAX_SAMPLES = 10;

function loadHistory(): Record<string, number[]> {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveRunDuration(action: Action, durationSecs: number) {
  try {
    const history = loadHistory();
    const samples = history[action] ?? [];
    samples.push(Math.round(durationSecs));
    history[action] = samples.slice(-MAX_SAMPLES);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    /* ignore */
  }
}

function estimatedDuration(action: Action): number {
  try {
    const samples = loadHistory()[action];
    if (!samples?.length) return FALLBACK_DURATION[action];
    let total = 0,
      weight = 0;
    samples.forEach((s, i) => {
      const w = i + 1;
      total += s * w;
      weight += w;
    });
    return Math.round(total / weight);
  } catch {
    return FALLBACK_DURATION[action];
  }
}

function fmtSecs(s: number): string {
  if (s <= 0) return "acum";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

/* ─── Action icon paths (Heroicons outline) ─── */

const actionIcons: Record<Action, string> = {
  "refresh-prices":
    "M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99",
  discover:
    "m21 21-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6",
  "fetch-images":
    "m2.25 15.75 5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 002.25-2.25V5.25a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z",
  "fuse-duplicates":
    "M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244",
};

/* ─── Progress Bar ─── */

function ProgressBar({
  action,
  overrideFraction,
}: {
  action: Action;
  overrideFraction?: number;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [autoPct, setAutoPct] = useState(0);
  const startRef = useRef(Date.now());
  const totalRef = useRef(estimatedDuration(action));
  const sampleCount = loadHistory()[action]?.length ?? 0;

  useEffect(() => {
    startRef.current = Date.now();
    totalRef.current = estimatedDuration(action);

    const interval = setInterval(() => {
      const secs = (Date.now() - startRef.current) / 1000;
      setElapsed(Math.floor(secs));
      const pct = 95 * (1 - Math.exp(-secs / (totalRef.current * 0.6)));
      setAutoPct(Math.min(pct, 95));
    }, 200);

    return () => clearInterval(interval);
  }, [action]);

  const pct =
    overrideFraction != null
      ? Math.round(overrideFraction * 100)
      : Math.round(autoPct);

  const total = totalRef.current;
  const eta = Math.max(0, Math.round(total - elapsed));

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-slate-500">
        <span>
          {fmtSecs(elapsed)} kaluar
          {sampleCount > 0 && (
            <span className="ml-1 text-slate-400">
              · bazuar në {sampleCount} {sampleCount === 1 ? "run" : "runs"}
            </span>
          )}
        </span>
        <span className={eta === 0 ? "text-orange-600 font-medium" : ""}>
          {overrideFraction != null
            ? `${pct}% — ETA ~${fmtSecs(eta)}`
            : `ETA ~${fmtSecs(eta)}`}
        </span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-orange-400 to-orange-500 transition-all duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-slate-400">
        Mos e mbyll faqen — po ekzekutohet
      </p>
    </div>
  );
}

/* ─── Admin Triggers ─── */

export function AdminTriggers() {
  const [key, setKey] = useState(() =>
    typeof window !== "undefined"
      ? sessionStorage.getItem("admin_key") ?? ""
      : "",
  );
  const [loading, setLoading] = useState<Action | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [autoFetchAll, setAutoFetchAll] = useState(false);

  async function trigger(action: Action) {
    if (!key.trim()) {
      setError("Vendos çelësin admin.");
      return;
    }
    sessionStorage.setItem("admin_key", key.trim());
    setLoading(action);
    setResult(null);
    setError(null);
    setBatchProgress(null);

    const started = Date.now();

    try {
      if (action === "refresh-prices") {
        let startIndex = 0;
        let totalRefreshed = 0;
        let totalErrors = 0;
        let total = 0;

        while (true) {
          const res = await fetch(
            `/api/admin/trigger?action=refresh-prices`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key: key.trim(), startIndex }),
            },
          );
          const json = await res.json();

          if (!res.ok || !json.ok) {
            setError(json.error ?? json.data?.error ?? "Gabim i panjohur");
            return;
          }

          const d = json.data as {
            refreshed: number;
            errors: number;
            total: number;
            nextIndex: number;
            remaining: number;
          };
          totalRefreshed += d.refreshed;
          totalErrors += d.errors;
          total = d.total;
          startIndex = d.nextIndex;

          setBatchProgress({ done: startIndex, total });

          if (d.remaining === 0) break;
        }

        const durationSecs = (Date.now() - started) / 1000;
        saveRunDuration(action, durationSecs);
        setResult({
          action,
          ok: true,
          data: { refreshed: totalRefreshed, errors: totalErrors, total },
        });
      } else if (action === "fetch-images") {
        let totalUpdated = 0;
        let totalSkipped = 0;
        let initialTotal = 0;
        let totalProcessed = 0;
        let first = true;

        while (true) {
          const res = await fetch(`/api/admin/trigger?action=fetch-images`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: key.trim() }),
          });
          const json = await res.json();

          if (!res.ok || !json.ok) {
            setError(json.error ?? json.data?.error ?? "Gabim i panjohur");
            return;
          }

          const d = json.data as {
            updated: number;
            skipped: number;
            total: number;
            remaining: number;
          };

          if (first) {
            initialTotal = d.total;
            first = false;
          }
          totalUpdated += d.updated;
          totalSkipped += d.skipped;
          totalProcessed += d.updated + d.skipped;

          if (initialTotal > 0) {
            setBatchProgress({ done: totalProcessed, total: initialTotal });
          }

          // Stop: all done, auto-repeat off, or no progress (avoids infinite loop)
          if (d.remaining === 0 || !autoFetchAll || d.updated === 0) break;
        }

        const durationSecs = (Date.now() - started) / 1000;
        saveRunDuration(action, durationSecs);
        setResult({
          action,
          ok: true,
          data: { updated: totalUpdated, skipped: totalSkipped, total: initialTotal },
        });
      } else {
        const res = await fetch(`/api/admin/trigger?action=${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: key.trim() }),
        });
        const json = await res.json();
        const durationSecs = (Date.now() - started) / 1000;

        if (!res.ok || !json.ok) {
          setError(json.error ?? json.data?.error ?? "Gabim i panjohur");
        } else {
          saveRunDuration(action, durationSecs);
          setResult({ action, ok: true, data: json.data });
        }
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(null);
      setBatchProgress(null);
    }
  }

  const buttons: {
    action: Action;
    label: string;
    desc: string;
  }[] = [
    {
      action: "refresh-prices",
      label: "Rifresko Çmimet",
      desc: "Të gjitha dyqanet, automatik",
    },
    {
      action: "discover",
      label: "Zbulo Produkte",
      desc: "Kërko produkte të reja",
    },
    {
      action: "fetch-images",
      label: "Merr Fotot",
      desc: "Plotëso fotot e munguara (50/run)",
    },
    {
      action: "fuse-duplicates",
      label: "Bashko Dublikatat",
      desc: "Gjej dhe bashko produktet e njëjta",
    },
  ];

  const overrideFraction = batchProgress
    ? batchProgress.done / batchProgress.total
    : undefined;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Veprime Manuale
        </h2>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
        {/* Auth input */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-600 whitespace-nowrap">
            Çelësi admin:
          </label>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="CRON_SECRET"
            className="flex-1 text-sm border border-slate-200 rounded-lg px-3.5 py-2.5 font-mono bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all"
          />
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {buttons.map(({ action, label, desc }) => (
            <button
              key={action}
              onClick={() => trigger(action)}
              disabled={loading !== null}
              className={`group flex items-start gap-3 border rounded-xl px-4 py-4 text-left transition-all ${
                loading === action
                  ? "border-orange-300 bg-orange-50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-orange-300 hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
              }`}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  loading === action
                    ? "bg-orange-100 text-orange-600"
                    : "bg-slate-100 text-slate-500 group-hover:bg-orange-50 group-hover:text-orange-600"
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d={actionIcons[action]}
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <p
                  className={`text-sm font-semibold ${
                    loading === action ? "text-orange-700" : "text-slate-800"
                  }`}
                >
                  {label}
                </p>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  {loading === action && batchProgress
                    ? `${batchProgress.done} / ${batchProgress.total} produkte`
                    : desc}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Merr Fotot auto-repeat */}
        <div className="flex items-center gap-2">
          <input
            id="auto-fetch-all"
            type="checkbox"
            checked={autoFetchAll}
            onChange={(e) => setAutoFetchAll(e.target.checked)}
            disabled={loading !== null}
            className="h-3.5 w-3.5 rounded border-slate-300 accent-orange-500 disabled:opacity-40 cursor-pointer"
          />
          <label
            htmlFor="auto-fetch-all"
            className={`text-sm select-none ${loading !== null ? "text-slate-400 cursor-not-allowed" : "text-slate-500 cursor-pointer"}`}
          >
            Merr Fotot — vazhdo automatikisht deri në fund
          </label>
        </div>

        {/* Progress */}
        {loading && (
          <ProgressBar action={loading} overrideFraction={overrideFraction} />
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex items-start gap-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <svg
              className="w-5 h-5 shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Success */}
        {!loading && result && (
          <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 font-semibold mb-2">
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Sukses
            </div>
            <pre className="text-xs font-mono bg-emerald-100/50 rounded-lg p-3 overflow-auto whitespace-pre-wrap text-emerald-800">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
