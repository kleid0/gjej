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
  "refresh-prices": 180,
  "discover":       60,
  "fetch-images":   90,
};

const HISTORY_KEY = "admin_run_history";
const MAX_SAMPLES = 10;

function loadHistory(): Record<Action, number[]> {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "{}");
  } catch {
    return {} as Record<Action, number[]>;
  }
}

function saveRunDuration(action: Action, durationSecs: number) {
  try {
    const history = loadHistory();
    const samples = history[action] ?? [];
    samples.push(Math.round(durationSecs));
    history[action] = samples.slice(-MAX_SAMPLES); // keep last N
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch { /* ignore */ }
}

function estimatedDuration(action: Action): number {
  try {
    const samples = loadHistory()[action];
    if (!samples?.length) return FALLBACK_DURATION[action];
    // Weighted average: recent runs count more
    let total = 0, weight = 0;
    samples.forEach((s, i) => {
      const w = i + 1; // older runs have lower weight
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
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function ProgressBar({ action, onDone }: { action: Action; onDone: (secs: number) => void }) {
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [eta, setEta] = useState<number | null>(null);
  const startRef = useRef(Date.now());
  const totalRef = useRef(estimatedDuration(action));
  const doneCalledRef = useRef(false);

  useEffect(() => {
    startRef.current = Date.now();
    totalRef.current = estimatedDuration(action);
    doneCalledRef.current = false;
    setProgress(0);
    setElapsed(0);
    setEta(totalRef.current);

    const interval = setInterval(() => {
      const secs = (Date.now() - startRef.current) / 1000;
      const total = totalRef.current;
      setElapsed(Math.floor(secs));
      // Exponential ease toward 95%
      const pct = 95 * (1 - Math.exp(-secs / (total * 0.6)));
      setProgress(Math.min(pct, 95));
      // ETA: remaining time based on current pace
      const remaining = Math.max(0, Math.round(total - secs));
      setEta(remaining);
    }, 200);

    return () => {
      clearInterval(interval);
      if (!doneCalledRef.current) {
        const secs = (Date.now() - startRef.current) / 1000;
        doneCalledRef.current = true;
        onDone(secs);
      }
    };
  }, [action]); // eslint-disable-line react-hooks/exhaustive-deps

  const sampleCount = loadHistory()[action]?.length ?? 0;
  const etaLabel = eta === null ? null : eta === 0 ? "acum" : `~${fmtSecs(eta)}`;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-gray-500">
        <span>
          {fmtSecs(elapsed)} kaluar
          {sampleCount > 0 && (
            <span className="ml-1 text-gray-400">
              · bazuar në {sampleCount} {sampleCount === 1 ? "run" : "runs"} të mëparshëm
            </span>
          )}
        </span>
        {etaLabel && (
          <span className={eta === 0 ? "text-orange-500 font-medium" : "text-gray-500"}>
            ETA {etaLabel}
          </span>
        )}
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className="h-2 rounded-full bg-orange-400 transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-gray-400">
        Mos e mbyll faqen — po ekzekutohet në sfond
      </p>
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

  async function trigger(action: Action) {
    if (!key.trim()) {
      setError("Vendos çelësin admin.");
      return;
    }
    sessionStorage.setItem("admin_key", key.trim());
    setLoading(action);
    setResult(null);
    setError(null);

    const started = Date.now();

    try {
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
        // Only record successful runs for ETA calibration
        saveRunDuration(action, durationSecs);
        setResult({ action, ok: true, data: json.data });
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(null);
    }
  }

  const buttons: { action: Action; label: string; desc: string }[] = [
    { action: "refresh-prices", label: "Rifresko Çmimet",   desc: "Scrape të gjitha dyqanet tani" },
    { action: "discover",       label: "Zbulo Produkte",     desc: "Kërko produkte të reja" },
    { action: "fetch-images",   label: "Merr Fotot",         desc: "Plotëso fotot e munguara (50/run)" },
  ];

  return (
    <section className="mb-8">
      <h2 className="text-base font-bold text-gray-700 mb-3 uppercase tracking-wide">
        Veprime Manuale
      </h2>
      <div className="border border-gray-100 rounded-xl p-5 space-y-4">
        {/* Key input */}
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

        {/* Trigger buttons */}
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
              <span className="text-xs text-gray-400 mt-0.5">{desc}</span>
            </button>
          ))}
        </div>

        {/* Progress bar */}
        {loading && (
          <ProgressBar
            action={loading}
            onDone={() => { /* duration saved in trigger() on success */ }}
          />
        )}

        {/* Result / error */}
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
