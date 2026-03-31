"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceDot,
  ResponsiveContainer,
} from "recharts";
import { STORES, STORE_MAP } from "@/src/infrastructure/stores/registry";

interface DataRow {
  date: string;
  [storeId: string]: string | number | null;
}

interface HistoryResponse {
  history: DataRow[];
  hasEnoughData: boolean;
  daysOldest: number;
}

const RANGES = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1V", days: 365 },
] as const;

type RangeDays = (typeof RANGES)[number]["days"];

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("sq-AL", { day: "2-digit", month: "short" });
}

function fmtPrice(price: number): string {
  return price.toLocaleString("sq-AL") + " ALL";
}

interface TooltipPayloadEntry {
  dataKey: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length || !label) return null;
  const sorted = [...payload]
    .filter((e) => e.value != null)
    .sort((a, b) => a.value - b.value);
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm min-w-[160px]">
      <p className="font-semibold text-gray-700 mb-2">{fmtDate(label)}</p>
      {sorted.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-500 text-xs">{STORE_MAP[entry.dataKey]?.name ?? entry.dataKey}:</span>
          <span className="font-bold text-gray-800 ml-auto">{fmtPrice(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

interface Props {
  productId: string;
}

export default function PriceHistoryGraph({ productId }: Props) {
  const [days, setDays] = useState<RangeDays>(365);
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [hiddenStores, setHiddenStores] = useState<Set<string>>(new Set());

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/price-history?product=${encodeURIComponent(productId)}&days=${days}`
      );
      setData(await res.json());
    } catch {
      setData({ history: [], hasEnoughData: false, daysOldest: 0 });
    } finally {
      setLoading(false);
    }
  }, [productId, days]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  function toggleStore(storeId: string) {
    setHiddenStores((prev) => {
      const next = new Set(prev);
      if (next.has(storeId)) next.delete(storeId);
      else next.add(storeId);
      return next;
    });
  }

  // Find global minimum price across all visible stores
  let minPrice: number | null = null;
  let minDate: string | null = null;
  let minStore: string | null = null;

  if (data?.history.length) {
    for (const row of data.history) {
      for (const store of STORES) {
        if (hiddenStores.has(store.id)) continue;
        const p = row[store.id];
        if (typeof p === "number" && p > 0 && (minPrice === null || p < minPrice)) {
          minPrice = p;
          minDate = row.date;
          minStore = store.id;
        }
      }
    }
  }

  const visibleStores = STORES.filter((s) => !hiddenStores.has(s.id));

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-800">Historia e Çmimeve</h2>
        <div className="flex gap-1">
          {RANGES.map(({ label, days: d }) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                days === d
                  ? "bg-orange-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Store toggle pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {STORES.map((store) => {
          const hidden = hiddenStores.has(store.id);
          return (
            <button
              key={store.id}
              onClick={() => toggleStore(store.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                hidden
                  ? "bg-white text-gray-400 border-gray-200 opacity-50"
                  : "bg-white text-gray-700 border-gray-200"
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: hidden ? "#d1d5db" : store.color }}
              />
              {store.name}
            </button>
          );
        })}
      </div>

      {loading && <div className="h-64 bg-gray-50 rounded-xl animate-pulse" />}

      {!loading && !data?.hasEnoughData && (
        <div className="h-48 bg-gray-50 rounded-xl border border-gray-100 flex flex-col items-center justify-center gap-2 px-6 text-center">
          <svg
            className="w-10 h-10 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <p className="text-sm font-medium text-gray-500">
            Duke mbledhur të dhëna historike
          </p>
          <p className="text-xs text-gray-400">
            Grafiku do të jetë i disponueshëm pas 30 ditësh
            {data && data.daysOldest > 0 && ` (${30 - data.daysOldest} ditë mbeten)`}
          </p>
        </div>
      )}

      {!loading && data?.hasEnoughData && data.history.length > 0 && (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data.history} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="date"
              tickFormatter={fmtDate}
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(v) => `${Math.round(v / 1000)}k`}
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              tickLine={false}
              axisLine={false}
              width={38}
            />
            <Tooltip content={<CustomTooltip />} />
            {STORES.map((store) => (
              <Line
                key={store.id}
                type="monotone"
                dataKey={store.id}
                stroke={store.color}
                strokeWidth={hiddenStores.has(store.id) ? 0 : 2}
                dot={false}
                activeDot={hiddenStores.has(store.id) ? false : { r: 4, fill: store.color, strokeWidth: 0 }}
                connectNulls={false}
                hide={hiddenStores.has(store.id)}
              />
            ))}
            {minPrice !== null && minDate !== null && minStore !== null && visibleStores.length > 0 && (
              <ReferenceDot
                x={minDate}
                y={minPrice}
                r={5}
                fill={STORE_MAP[minStore]?.color ?? "#f97316"}
                stroke="#fff"
                strokeWidth={2}
                label={{
                  value: `Minimumi: ${fmtPrice(minPrice)}`,
                  position: "top",
                  fontSize: 10,
                  fill: "#6b7280",
                }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
