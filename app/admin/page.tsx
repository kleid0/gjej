// Admin panel — server component (auth temporarily disabled for verification)

import Link from "next/link";
import {
  getAdminStats,
  getRecentScraperErrors,
  getDiscoveryLog,
} from "@/src/infrastructure/db/PriceHistoryRepository";
import { priceQuery, productCatalog } from "@/src/infrastructure/container";
import { STORES } from "@/src/infrastructure/stores/registry";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: { key?: string };
}

function StatCard({ label, value, sub, color = "gray" }: {
  label: string;
  value: number | string;
  sub?: string;
  color?: "gray" | "orange" | "red" | "green" | "blue";
}) {
  const colors = {
    gray:   "bg-gray-50 border-gray-200 text-gray-700",
    orange: "bg-orange-50 border-orange-200 text-orange-700",
    red:    "bg-red-50 border-red-200 text-red-700",
    green:  "bg-green-50 border-green-200 text-green-700",
    blue:   "bg-blue-50 border-blue-200 text-blue-700",
  };
  return (
    <div className={`border rounded-xl p-4 ${colors[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm font-semibold mt-0.5">{label}</p>
      {sub && <p className="text-xs opacity-70 mt-0.5">{sub}</p>}
    </div>
  );
}

export default async function AdminPage({ searchParams: _searchParams }: Props) {
  const [stats, errors, discoveryLog, allPrices, allProducts] = await Promise.allSettled([
    getAdminStats(),
    getRecentScraperErrors(50),
    getDiscoveryLog(10),
    priceQuery.getAllCachedPrices(),
    productCatalog.getAllProducts(),
  ]);

  const s = stats.status === "fulfilled" ? stats.value : null;
  const errList = errors.status === "fulfilled" ? errors.value : [];
  const discLog = discoveryLog.status === "fulfilled" ? discoveryLog.value : [];
  const prices = allPrices.status === "fulfilled" ? allPrices.value : {};
  const products = allProducts.status === "fulfilled" ? allProducts.value : [];

  // Suspicious and overpriced prices from cache
  const flaggedPrices: Array<{
    productId: string;
    productName: string;
    storeId: string;
    price: number;
    flag: "suspicious" | "overpriced";
  }> = [];

  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

  for (const [productId, record] of Object.entries(prices)) {
    const pName = productMap[productId]?.family ?? productId;
    for (const p of record.prices) {
      if (p.price !== null && (p.suspicious || p.overpriced)) {
        flaggedPrices.push({
          productId,
          productName: pName,
          storeId: p.storeId,
          price: p.price,
          flag: p.suspicious ? "suspicious" : "overpriced",
        });
      }
    }
  }

  // Products missing image
  const missingImage = products.filter((p) => !p.imageUrl);

  // Store health: last time each store returned a non-null price
  const storeLastSeen: Record<string, string> = {};
  for (const record of Object.values(prices)) {
    for (const p of record.prices) {
      if (p.price !== null) {
        const prev = storeLastSeen[p.storeId];
        if (!prev || record.refreshedAt > prev) {
          storeLastSeen[p.storeId] = record.refreshedAt;
        }
      }
    }
  }

  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("sq-AL", {
      timeZone: "Europe/Tirane",
      dateStyle: "short",
      timeStyle: "short",
    });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paneli i Administrimit</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gjej.al — menaxhimi i katalogut dhe çmimeve</p>
        </div>
        <div className="flex gap-3">
          <a
            href={`/api/health`}
            target="_blank"
            className="text-xs border border-gray-200 rounded-lg px-3 py-2 text-gray-600 hover:border-orange-400 hover:text-orange-600 transition-colors"
          >
            ↗ Health Check
          </a>
          <Link href="/" className="text-xs border border-gray-200 rounded-lg px-3 py-2 text-gray-600 hover:border-orange-400 hover:text-orange-600 transition-colors">
            ← Kryefaqja
          </Link>
        </div>
      </div>

      {/* Catalogue stats */}
      {s && (
        <section className="mb-8">
          <h2 className="text-base font-bold text-gray-700 mb-3 uppercase tracking-wide">Katalogu</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Produkte gjithsej" value={s.totalProducts} color="blue" />
            <StatCard label="Me specifika" value={s.enrichedProducts} color="green" />
            <StatCard
              label="Pa foto"
              value={s.missingImageProducts}
              color={s.missingImageProducts > 0 ? "orange" : "green"}
            />
            <StatCard
              label="Jashtë shitjes"
              value={s.discontinuedProducts}
              color="gray"
              sub="≥30 ditë pa u parë"
            />
            <StatCard
              label="Në pritje review"
              value={s.pendingReviewMappings}
              color={s.pendingReviewMappings > 0 ? "orange" : "green"}
              sub="store mappings"
            />
            <StatCard
              label="Gabime 24h"
              value={s.recentErrors}
              color={s.recentErrors > 10 ? "red" : s.recentErrors > 0 ? "orange" : "green"}
            />
          </div>
        </section>
      )}

      {/* Store health */}
      <section className="mb-8">
        <h2 className="text-base font-bold text-gray-700 mb-3 uppercase tracking-wide">Gjendja e Dyqaneve</h2>
        <div className="border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2">Dyqani</th>
                <th className="text-left px-4 py-2">ID</th>
                <th className="text-left px-4 py-2">Herën e fundit aktiv</th>
                <th className="text-left px-4 py-2">Gjendja</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {STORES.map((store) => {
                const lastSeen = storeLastSeen[store.id];
                const ok = lastSeen && lastSeen > cutoff24h;
                return (
                  <tr key={store.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-800">{store.name}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-500">{store.id}</td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {lastSeen ? fmt(lastSeen) : "Asnjëherë"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          ok
                            ? "bg-green-100 text-green-700"
                            : lastSeen
                              ? "bg-amber-100 text-amber-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {ok ? "✓ Aktiv" : lastSeen ? "⚠ I vjetër" : "✗ Pa të dhëna"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Flagged prices */}
      {flaggedPrices.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-bold text-gray-700 mb-3 uppercase tracking-wide">
            Çmime të Dyshimta ({flaggedPrices.length})
          </h2>
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2">Produkti</th>
                  <th className="text-left px-4 py-2">Dyqani</th>
                  <th className="text-right px-4 py-2">Çmimi</th>
                  <th className="text-left px-4 py-2">Flamuri</th>
                  <th className="text-left px-4 py-2">Veprim</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {flaggedPrices.slice(0, 30).map((fp, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-800 max-w-xs truncate">
                      {fp.productName}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{fp.storeId}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-gray-800">
                      {fp.price.toLocaleString("sq-AL")} ALL
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          fp.flag === "suspicious"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {fp.flag === "suspicious" ? "⚠ I ulët" : "⚠ I lartë"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/produkt/${fp.productId}`}
                        className="text-xs text-orange-600 hover:underline"
                      >
                        Kontrollo →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Products missing images */}
      {missingImage.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-bold text-gray-700 mb-3 uppercase tracking-wide">
            Pa Foto ({missingImage.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {missingImage.slice(0, 20).map((p) => (
              <Link
                key={p.id}
                href={`/produkt/${p.id}`}
                className="text-xs border border-amber-200 bg-amber-50 rounded-lg px-3 py-1.5 text-amber-700 hover:border-amber-400 transition-colors"
              >
                {p.family}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Discovery log */}
      {discLog.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-bold text-gray-700 mb-3 uppercase tracking-wide">
            Log i Zbulimit (Ditët e Fundit)
          </h2>
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2">Data</th>
                  <th className="text-right px-4 py-2">Zbuluar</th>
                  <th className="text-right px-4 py-2">Shtuar auto</th>
                  <th className="text-right px-4 py-2">Kërkon review</th>
                  <th className="text-right px-4 py-2">Ndërprerë</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {discLog.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-600">{fmt(row.run_at)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-800">{row.total_discovered}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-green-700">{row.auto_added}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-amber-700">{row.pending_review}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-500">{row.discontinued}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Scraper errors */}
      {errList.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-bold text-gray-700 mb-3 uppercase tracking-wide">
            Gabime të Scrapers ({errList.length} të fundit)
          </h2>
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2">Koha</th>
                  <th className="text-left px-4 py-2">Dyqani</th>
                  <th className="text-left px-4 py-2">Lloji</th>
                  <th className="text-left px-4 py-2">Mesazhi</th>
                  <th className="text-left px-4 py-2">Produkti</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {errList.map((err) => (
                  <tr key={err.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{fmt(err.occurred_at)}</td>
                    <td className="px-4 py-2 font-medium text-gray-700">{err.store_id}</td>
                    <td className="px-4 py-2">
                      <span className="text-xs bg-red-50 text-red-700 border border-red-200 rounded px-1.5 py-0.5">
                        {err.error_type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-600 max-w-xs truncate">
                      {err.error_message ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-gray-500 font-mono text-xs">
                      {err.product_id ? (
                        <Link href={`/produkt/${err.product_id}`} className="hover:text-orange-600">
                          {err.product_id}
                        </Link>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {errList.length === 0 && flaggedPrices.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">✓</p>
          <p className="font-medium">Asnjë problem i zbuluar</p>
        </div>
      )}
    </div>
  );
}
