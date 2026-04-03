"use client";

import { useState } from "react";

type Action = "refresh-prices" | "discover" | "fetch-images";

interface Result {
  action: Action;
  ok: boolean;
  data: Record<string, unknown>;
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
    { action: "refresh-prices",  label: "Rifresko Çmimet",     desc: "Scrape të gjitha dyqanet tani" },
    { action: "discover",        label: "Zbulo Produkte",       desc: "Kërko produkte të reja" },
    { action: "fetch-images",    label: "Merr Fotot",           desc: "Plotëso fotot e munguara (50 × rrun)" },
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
              <span className="text-sm font-semibold">
                {loading === action ? "Duke u ekzekutuar…" : label}
              </span>
              <span className="text-xs text-gray-400 mt-0.5">{desc}</span>
            </button>
          ))}
        </div>

        {/* Result */}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            ✗ {error}
          </div>
        )}
        {result && (
          <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
            <p className="font-semibold mb-1">✓ Sukses — {result.action}</p>
            <pre className="text-xs font-mono overflow-auto whitespace-pre-wrap">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </section>
  );
}
