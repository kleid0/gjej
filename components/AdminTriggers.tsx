"use client";

import { useState, useEffect, useRef } from "react";

type Action = "refresh-prices" | "discover" | "fetch-images";

interface Result {
  action: Action;
  ok: boolean;
  data: Record<string, unknown>;
}

// Estimated durations in seconds for each action (used to drive the progress bar)
const ESTIMATED_DURATION: Record<Action, number> = {
  "refresh-prices": 180,
  "discover":       60,
  "fetch-images":   90,
};

function ProgressBar({ action }: { action: Action }) {
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  const total = ESTIMATED_DURATION[action];

  useEffect(() => {
    startRef.current = Date.now();
    setProgress(0);
    setElapsed(0);

    const interval = setInterval(() => {
      const secs = (Date.now() - startRef.current) / 1000;
      setElapsed(Math.floor(secs));
      // Ease toward 95% — never hits 100% until we're done
      const pct = 95 * (1 - Math.exp(-secs / (total * 0.6)));
      setProgress(Math.min(pct, 95));
    }, 200);

    return () => clearInterval(interval);
  }, [action, total]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-gray-500">
        <span>Duke u ekzekutuar…</span>
        <span>{timeStr} kaluar</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className="h-2 rounded-full bg-orange-400 transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-gray-400">
        Mund të zgjasë deri në {Math.ceil(total / 60)} min — mos e mbyll faqen
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

    try {
      const res = await fetch(`/api/admin/trigger?action=${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: key.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? json.data?.error ?? "Gabim i panjohur");
      } else {
        setResult({ action, ok: true, data: json.data });
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(null);
    }
  }

  const buttons: { action: Action; label: string; desc: string }[] = [
    { action: "refresh-prices", label: "Rifresko Çmimet",    desc: "Scrape të gjitha dyqanet tani" },
    { action: "discover",       label: "Zbulo Produkte",      desc: "Kërko produkte të reja" },
    { action: "fetch-images",   label: "Merr Fotot",          desc: "Plotëso fotot e munguara (50/run)" },
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

        {/* Progress bar — shown while a job is running */}
        {loading && <ProgressBar action={loading} />}

        {/* Result */}
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
