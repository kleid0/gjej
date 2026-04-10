// Admin dashboard — server component

import Link from "next/link";
import {
  getAdminStats,
  getRecentScraperErrors,
  getDiscoveryLog,
  getStoreLastRecorded,
} from "@/src/infrastructure/db/PriceHistoryRepository";
import { priceQuery, productCatalog } from "@/src/infrastructure/container";
import { STORES } from "@/src/infrastructure/stores/registry";
import { AdminTriggers } from "@/components/AdminTriggers";

export const dynamic = "force-dynamic";

/* ─── Stat Card ─── */

function StatCard({
  label,
  value,
  sub,
  status = "neutral",
}: {
  label: string;
  value: number | string;
  sub?: string;
  status?: "success" | "warning" | "danger" | "info" | "neutral";
}) {
  const dot: Record<string, string> = {
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
    info: "bg-blue-500",
    neutral: "bg-slate-300",
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full ${dot[status]}`} />
        <p className="text-sm font-medium text-slate-500">{label}</p>
      </div>
      <p className="text-3xl font-bold text-slate-900 tracking-tight">
        {typeof value === "number" ? value.toLocaleString("sq-AL") : value}
      </p>
      {sub && <p className="text-xs text-slate-400 mt-1.5">{sub}</p>}
    </div>
  );
}

/* ─── Section Heading ─── */

function SectionHeading({
  title,
  badge,
}: {
  title: string;
  badge?: string | number;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {badge !== undefined && (
        <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </div>
  );
}

/* ─── Status Badge ─── */

function StatusBadge({
  variant,
  children,
}: {
  variant: "success" | "warning" | "danger";
  children: React.ReactNode;
}) {
  const styles = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    danger: "bg-red-50 text-red-700 border-red-200",
  };
  const dots = {
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${styles[variant]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dots[variant]}`} />
      {children}
    </span>
  );
}

/* ─── Table wrapper (handles overflow) ─── */

function TableCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

/* ─── Main Page ─── */

export default async function AdminPage() {
  const [stats, errors, discoveryLog, storeHealth, allPrices, allProducts] =
    await Promise.allSettled([
      getAdminStats(),
      getRecentScraperErrors(50),
      getDiscoveryLog(10),
      getStoreLastRecorded(),
      priceQuery.getAllCachedPrices(),
      productCatalog.getAllProducts(),
    ]);

  const s = stats.status === "fulfilled" ? stats.value : null;
  const errList = errors.status === "fulfilled" ? errors.value : [];
  const discLog =
    discoveryLog.status === "fulfilled" ? discoveryLog.value : [];
  const dbStoreLastSeen =
    storeHealth.status === "fulfilled" ? storeHealth.value : {};
  const prices = allPrices.status === "fulfilled" ? allPrices.value : {};
  const products =
    allProducts.status === "fulfilled" ? allProducts.value : [];

  // Flagged prices from cache
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

  const missingImage = products.filter((p) => !p.imageUrl);

  // Date helpers
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000)
    .toISOString()
    .split("T")[0];

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("sq-AL", {
      timeZone: "Europe/Tirane",
      dateStyle: "short",
      timeStyle: "short",
    });

  const thClass =
    "text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/80";

  return (
    <>
      {/* ── Header ── */}
      <header id="overview" className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Paneli i Administrimit
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Menaxhimi i katalogut dhe çmimeve — Gjej.al
        </p>
      </header>

      {/* ── Catalogue Stats ── */}
      {s && (
        <section className="mb-10">
          <SectionHeading title="Katalogu" />
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <StatCard
              label="Produkte gjithsej"
              value={s.totalProducts}
              status="info"
            />
            <StatCard
              label="Me specifika"
              value={s.enrichedProducts}
              status="success"
            />
            <StatCard
              label="Pa foto"
              value={s.missingImageProducts}
              status={s.missingImageProducts > 0 ? "warning" : "success"}
            />
            <StatCard
              label="Jashtë shitjes"
              value={s.discontinuedProducts}
              status="neutral"
              sub="≥30 ditë pa u parë"
            />
            <StatCard
              label="Në pritje review"
              value={s.pendingReviewMappings}
              status={
                s.pendingReviewMappings > 0 ? "warning" : "success"
              }
              sub="store mappings"
            />
            <StatCard
              label="Gabime 24h"
              value={s.recentErrors}
              status={
                s.recentErrors > 10
                  ? "danger"
                  : s.recentErrors > 0
                    ? "warning"
                    : "success"
              }
            />
          </div>
        </section>
      )}

      {/* ── Store Health ── */}
      <section id="stores" className="mb-10">
        <SectionHeading
          title="Gjendja e Dyqaneve"
          badge={`${STORES.length} dyqane`}
        />
        <TableCard>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className={thClass}>Dyqani</th>
                <th className={thClass}>ID</th>
                <th className={thClass}>Herën e fundit aktiv</th>
                <th className={thClass}>Gjendja</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {STORES.map((store) => {
                const lastDate = dbStoreLastSeen[store.id];
                const ok =
                  lastDate &&
                  (lastDate >= today || lastDate >= yesterday);
                const displayDate = lastDate
                  ? fmt(lastDate + "T12:00:00Z")
                  : null;
                return (
                  <tr
                    key={store.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-5 py-3.5 font-medium text-slate-800">
                      {store.name}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-400 text-xs">
                      {store.id}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {displayDate ?? "Asnjëherë"}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge
                        variant={
                          ok
                            ? "success"
                            : lastDate
                              ? "warning"
                              : "danger"
                        }
                      >
                        {ok
                          ? "Aktiv"
                          : lastDate
                            ? "I vjetër"
                            : "Pa të dhëna"}
                      </StatusBadge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableCard>
      </section>

      {/* ── Manual Triggers ── */}
      <section id="triggers" className="mb-10">
        <AdminTriggers />
      </section>

      {/* ── Flagged Prices ── */}
      {flaggedPrices.length > 0 && (
        <section id="flagged" className="mb-10">
          <SectionHeading
            title="Çmime të Dyshimta"
            badge={flaggedPrices.length}
          />
          <TableCard>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className={thClass}>Produkti</th>
                  <th className={thClass}>Dyqani</th>
                  <th className={`${thClass} text-right`}>Çmimi</th>
                  <th className={thClass}>Flamuri</th>
                  <th className={thClass}>Veprim</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {flaggedPrices.slice(0, 30).map((fp, i) => (
                  <tr
                    key={i}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-5 py-3.5 text-slate-800 max-w-xs truncate">
                      {fp.productName}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">
                      {fp.storeId}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-semibold text-slate-800">
                      {fp.price.toLocaleString("sq-AL")} Lekë
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge
                        variant={
                          fp.flag === "suspicious" ? "warning" : "danger"
                        }
                      >
                        {fp.flag === "suspicious" ? "I ulët" : "I lartë"}
                      </StatusBadge>
                    </td>
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/produkt/${fp.productId}`}
                        className="text-xs font-medium text-orange-600 hover:text-orange-700 hover:underline"
                      >
                        Kontrollo
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>
        </section>
      )}

      {/* ── Missing Images ── */}
      {missingImage.length > 0 && (
        <section id="images" className="mb-10">
          <SectionHeading title="Pa Foto" badge={missingImage.length} />
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex flex-wrap gap-2">
              {missingImage.slice(0, 20).map((p) => (
                <Link
                  key={p.id}
                  href={`/produkt/${p.id}`}
                  className="text-xs font-medium border border-amber-200 bg-amber-50 rounded-lg px-3 py-1.5 text-amber-700 hover:border-amber-400 hover:bg-amber-100 transition-colors"
                >
                  {p.family}
                </Link>
              ))}
              {missingImage.length > 20 && (
                <span className="text-xs text-slate-400 self-center px-2">
                  +{missingImage.length - 20} më shumë
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Discovery Log ── */}
      {discLog.length > 0 && (
        <section id="discovery" className="mb-10">
          <SectionHeading title="Log i Zbulimit" badge="Ditët e Fundit" />
          <TableCard>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className={thClass}>Data</th>
                  <th className={`${thClass} text-right`}>Zbuluar</th>
                  <th className={`${thClass} text-right`}>Shtuar auto</th>
                  <th className={`${thClass} text-right`}>Kërkon review</th>
                  <th className={`${thClass} text-right`}>Ndërprerë</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {discLog.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-5 py-3.5 text-slate-600">
                      {fmt(row.run_at)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-slate-800">
                      {row.total_discovered}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-emerald-600">
                      {row.auto_added}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-amber-600">
                      {row.pending_review}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-slate-400">
                      {row.discontinued}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>
        </section>
      )}

      {/* ── Scraper Errors ── */}
      {errList.length > 0 && (
        <section id="errors" className="mb-10">
          <SectionHeading
            title="Gabime të Scrapers"
            badge={`${errList.length} të fundit`}
          />
          <TableCard>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className={thClass}>Koha</th>
                  <th className={thClass}>Dyqani</th>
                  <th className={thClass}>Lloji</th>
                  <th className={thClass}>Mesazhi</th>
                  <th className={thClass}>Produkti</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {errList.map((err) => (
                  <tr
                    key={err.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap text-xs">
                      {fmt(err.occurred_at)}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-700">
                      {err.store_id}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-medium bg-red-50 text-red-700 border border-red-200 rounded-md px-2 py-0.5">
                        {err.error_type}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 max-w-xs truncate text-xs">
                      {err.error_message ?? "\u2014"}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 font-mono text-xs">
                      {err.product_id ? (
                        <Link
                          href={`/produkt/${err.product_id}`}
                          className="hover:text-orange-600 transition-colors"
                        >
                          {err.product_id}
                        </Link>
                      ) : (
                        "\u2014"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>
        </section>
      )}

      {/* ── All Clear ── */}
      {errList.length === 0 && flaggedPrices.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-emerald-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
          </div>
          <p className="font-semibold text-slate-700">
            Asnjë problem i zbuluar
          </p>
          <p className="text-sm text-slate-400 mt-1">
            Të gjitha sistemet janë në rregull
          </p>
        </div>
      )}
    </>
  );
}
