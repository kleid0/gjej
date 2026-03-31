"use client";

import { useState } from "react";

interface Props {
  productId: string;
}

type Status = "idle" | "loading" | "success" | "error";

export default function PriceAlertButton({ productId }: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [threshold, setThreshold] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/price-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, email, threshold: parseInt(threshold, 10) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Gabim i panjohur");
        setStatus("error");
      } else {
        setStatus("success");
      }
    } catch {
      setErrorMsg("Gabim gjatë dërgimit — kontrolloni lidhjen");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="mt-4 flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
        <span className="text-base leading-none mt-0.5">✓</span>
        <span>
          Do të njoftoheni kur çmimi të bjerë nën{" "}
          <strong>{parseInt(threshold, 10).toLocaleString("sq-AL")} ALL</strong>.
        </span>
      </div>
    );
  }

  return (
    <div className="mt-4">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 text-sm font-medium text-orange-600 hover:text-orange-700 border border-orange-200 rounded-lg px-4 py-2.5 hover:bg-orange-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          Më njofto kur çmimi të ulet
        </button>
      ) : (
        <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-1.5">
              <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              Njoftim për çmim
            </h3>
            <button
              onClick={() => { setOpen(false); setStatus("idle"); setErrorMsg(""); }}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              aria-label="Mbyll"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Email-i juaj
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="emaili@juaj.com"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Njoftomë kur çmimi të bjerë nën (ALL)
              </label>
              <input
                type="number"
                required
                min="1"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="p.sh. 50000"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent"
              />
            </div>

            {status === "error" && errorMsg && (
              <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded px-2 py-1">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full btn-orange text-sm py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === "loading" ? "Duke ruajtur…" : "Ruaj njoftimin"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
