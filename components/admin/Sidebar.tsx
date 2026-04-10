"use client";

import { useState } from "react";
import Link from "next/link";

/* ─── Icon paths (Heroicons outline 24×24) ─── */

const iconPaths: Record<string, string> = {
  overview:
    "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
  stores:
    "M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.015a2.993 2.993 0 002.25 1.015c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72l1.189-1.19A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72M6.75 18h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .414.336.75.75.75z",
  flag:
    "M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5",
  photo:
    "m2.25 15.75 5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 002.25-2.25V5.25a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z",
  search:
    "m21 21-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z",
  warning:
    "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z",
  play:
    "M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.971l-11.54 6.348a1.125 1.125 0 01-1.667-.986V5.653z",
  heart:
    "M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z",
  home:
    "m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25",
  external:
    "M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25",
};

function NavIcon({ name, className = "w-5 h-5" }: { name: string; className?: string }) {
  return (
    <svg
      className={`shrink-0 ${className}`}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={iconPaths[name]} />
    </svg>
  );
}

/* ─── Navigation items ─── */

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const monitoringLinks: NavItem[] = [
  { label: "Përmbledhje", href: "#overview", icon: "overview" },
  { label: "Dyqanet", href: "#stores", icon: "stores" },
  { label: "Çmime të Dyshimta", href: "#flagged", icon: "flag" },
  { label: "Pa Foto", href: "#images", icon: "photo" },
  { label: "Log Zbulimi", href: "#discovery", icon: "search" },
  { label: "Gabime", href: "#errors", icon: "warning" },
];

const actionLinks: NavItem[] = [
  { label: "Veprime Manuale", href: "#triggers", icon: "play" },
];

/* ─── Sidebar ─── */

export function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-slate-900 px-4 h-14 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xs">G</span>
          </div>
          <span className="text-white font-semibold text-sm">Admin</span>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="text-slate-400 hover:text-white p-1 transition-colors"
          aria-label="Toggle menu"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed top-0 left-0 z-40 h-full w-64 bg-slate-900 flex flex-col transition-transform duration-200 ease-out lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-800 shrink-0">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">G</span>
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">Gjej.al</p>
            <p className="text-slate-500 text-xs">Paneli i Administrimit</p>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <p className="px-3 mb-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Monitorimi
          </p>
          {monitoringLinks.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800/70 transition-colors"
            >
              <NavIcon name={item.icon} />
              {item.label}
            </a>
          ))}

          <p className="px-3 mb-2 mt-6 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Veprime
          </p>
          {actionLinks.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800/70 transition-colors"
            >
              <NavIcon name={item.icon} />
              {item.label}
            </a>
          ))}
        </nav>

        {/* Bottom links */}
        <div className="px-3 py-4 border-t border-slate-800 space-y-1 shrink-0">
          <a
            href="/api/health"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-white hover:bg-slate-800/70 transition-colors"
          >
            <NavIcon name="heart" />
            <span className="flex-1">Health Check</span>
            <NavIcon name="external" className="w-3.5 h-3.5" />
          </a>
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-white hover:bg-slate-800/70 transition-colors"
          >
            <NavIcon name="home" />
            Kryefaqja
          </Link>
        </div>
      </aside>
    </>
  );
}
