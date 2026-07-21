import Link from "next/link";
import type { ComboVariant } from "@/src/application/catalog/comboVariants";

// Bundle selector: a base product and its combos (e.g. console vs console +
// game) live on one grouped set of pages. Each pill links to that variant's
// page; the active one is highlighted. Server-rendered so every variant keeps
// its own indexable URL.
export default function ComboSelector({
  variants,
  activeId,
}: {
  variants: ComboVariant[];
  activeId: string;
}) {
  if (variants.length < 2) return null;
  return (
    <div className="mb-5">
      <p className="text-xs font-bold uppercase tracking-wide text-clay mb-2">
        Zgjidh paketën
      </p>
      <div className="flex flex-wrap gap-2">
        {variants.map((v) => {
          const active = v.id === activeId;
          return (
            <Link
              key={v.id}
              href={`/produkt/${v.id}`}
              aria-current={active ? "true" : undefined}
              className={`px-3 py-1.5 text-sm rounded-full border-2 border-ink transition-colors ${
                active
                  ? "bg-sun font-bold shadow-pika-sm"
                  : "bg-white hover:bg-sun font-medium"
              }`}
            >
              {v.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
