"use client";

import { useState, useEffect, useRef } from "react";

type Action = "refresh-prices" | "discover" | "fetch-images";

interface Result {
  action: Action;
  ok: boolean;
  data: Record<string, unknown>;
}

// Fallback estimates (seconds) used until we have real timing data
const FALLBACK_DURATION: Record<Action, number> = {
  "refresh-prices": 240, // auto-loops ~3 batches × ~80s each
  "discover":       60,
  "fetch-images":   90,
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
  } catch { /* ignore */ }
}

function estimatedDuration(action: Action): number {
  try {
    const samples = loadHistory()[action];
    if (!samples?.length) return FALLBACK_DURATION[action];
    let total = 0, weight = 0;
    samples.forEach((s, i) => { const w = i + 1; total += s * w; weight += w; });
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

interface ProgressBarProps {
  action: Action;
  /** 0–1 override: when we know the real fraction (multi-batch) */
  overrideFraction?: number;
}

function ProgressBar({ action, overrideFraction }: ProgressBarProps) {
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

  // Use real fraction if available, otherwise auto-estimated
  const pct = overrideFraction != null
    ? Math.round(overrideFraction * 100)
    : Math.round(autoPct);

  const total = totalRef.current;
  const eta = Math.max(0, Math.round(total - elapsed));

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-gray-500">
        <span>
          {fmtSecs(elapsed)} kaluar
          {sampleCount > 0 && (
            <span className="ml-1 text-gray-400">
              · bazuar në {sampleCount} {sampleCount === 1 ? "run" : "runs"}
            </span>
          )}
        </span>
        <span className={eta === 0 ? "text-orange-500 font-medium" : ""}>
          {overrideFraction != null
            ? `${pct}% — ETA ~${fmtSecs(eta)}`
            : `ETA ~${fmtSecs(eta)}`}
        </span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className="h-2 rounded-full bg-orange-400 transition-all duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-400">Mos e mbyll faqen — po ekzekutohet</p>
    </div>
  );
}

export function AdminTriggers() {
  const [key, setKey] = useState(() =>
    typeof window !== "undefined" ? sessionStorage.getItem("admin_key") ?? "" : ""
  );
  const [loading, setLoading] = useState<Action | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Multi-batch progress for refresh-prices
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);

  async function trigger(action: Action) {
    if (!key.trim()) { setError("Vendos çelësin admin."); return; }
    sessionStorage.setItem("admin_key", key.trim());
    setLoading(action);
    setResult(null);
    setError(null);
    setBatchProgress(null);

    const started = Date.now();

    try {
      if (action === "refresh-prices") {
        // Auto-loop: call the endpoint repeatedly with increasing startIndex
        let startIndex = 0;
        let totalRefreshed = 0;
        let totalErrors = 0;
        let total = 0;

        while (true) {
          const res = await fetch(`/api/admin/trigger?action=refresh-prices`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: key.trim(), startIndex }),
          });
          const json = await res.json();

          if (!res.ok || !json.ok) {
            setError(json.error ?? json.data?.error ?? "Gabim i panjohur");
            return;
          }

          const d = json.data as { refreshed: number; errors: number; total: number; nextIndex: number; remaining: number };
          totalRefreshed += d.refreshed;
          totalErrors += d.errors;
          total = d.total;
          startIndex = d.nextIndex;

          setBatchProgress({ done: startIndex, total });

          if (d.remaining === 0) break;
        }

        const durationSecs = (Date.now() - started) / 1000;
        saveRunDuration(action, durationSecs);
        setResult({ action, ok: true, data: { refreshed: totalRefreshed, errors: totalErrors, total } });

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

  const buttons: { action: Action; label: string; desc: string }[] = [
    { action: "refresh-prices", label: "Rifresko Çmimet",   desc: "Të gjitha dyqanet, automatik" },
    { action: "discover",       label: "Zbulo Produkte",     desc: "Kërko produkte të reja" },
    { action: "fetch-images",   label: "Merr Fotot",         desc: "Plotëso fotot e munguara (50/run)" },
  ];

  const overrideFraction = batchProgress
    ? batchProgress.done / batchProgress.total
    : undefined;

  return (
    <section className="mb-8">
      <h2 className="text-base font-bold text-gray-700 mb-3 uppercase tracking-wide">
        Veprime Manuale
      </h2>
      <div className="border border-gray-100 rounded-xl p-5 space-y-4">
        <div className="flex gap-2 items-center">
          <label className="text-sm text-gray-600 whitespace-nowrap">Çelësi admin:</label>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="CRON_SECRET"
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-orange-400"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          {buttons.map(({ action, label, desc }) => (
            <button
              key={action}
              onClick={() => trigger(action)}
              disabled={loading !== null}
              className={`flex flex-col items-start border rounded-lg px-4 py-3 text-left transition-colors min-w-[180px]
                ${loading === action
                  ? "border-orange-300 bg-orange-50 text-orange-600 cursor-wait"
                  : "border-gray-200 bg-white text-gray-700 hover:border-orange-400 hover:text-orange-600 cursor-pointer disabled:opacity-50"
                }`}
            >
              <span className="text-sm font-semibold">{label}</span>
              <span className="text-xs text-gray-400 mt-0.5">
                {loading === action && batchProgress
                  ? `${batchProgress.done} / ${batchProgress.total} produkte`
                  : desc}
              </span>
            </button>
          ))}
        </div>

        {loading && (
          <ProgressBar action={loading} overrideFraction={overrideFraction} />
        )}

        {!loading && error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            ✗ {error}
          </div>
        )}
        {!loading && result && (
          <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
            <p className="font-semibold mb-1">✓ Sukses</p>
            <pre className="text-xs font-mono overflow-auto whitespace-pre-wrap">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </section>
  );
}
