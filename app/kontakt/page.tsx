import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Na Kontaktoni · gjej.al",
  description: "Na kontaktoni për çdo pyetje ose sugjerim rreth gjej.al.",
};

export default function KontaktPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <nav className="text-xs text-gray-400 mb-6 flex items-center gap-1">
        <Link href="/" className="hover:text-orange-600">Kryefaqja</Link>
        <span>/</span>
        <span className="text-gray-600">Na kontaktoni</span>
      </nav>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">Na Kontaktoni</h1>
      <p className="text-sm text-gray-500 mb-8">Jemi këtu për çdo pyetje, sugjerim ose problem.</p>

      <div className="space-y-6">
        <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-1">Email</h2>
          <p className="text-sm text-gray-500 mb-2">Për pyetje të përgjithshme dhe sugjerime:</p>
          <a
            href="mailto:info@gjej.al"
            className="text-orange-600 font-medium hover:underline text-sm"
          >
            info@gjej.al
          </a>
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-1">Probleme me çmimet</h2>
          <p className="text-sm text-gray-600">
            Nëse shihni një çmim të gabuar ose një produkt që nuk përputhet saktë, na shkruani
            me emrin e produktit dhe dyqanin ku keni parë problemin. Do ta shqyrtojmë menjëherë.
          </p>
          <a
            href="mailto:info@gjej.al?subject=Problem me cmimin"
            className="inline-block mt-3 text-sm text-orange-600 font-medium hover:underline"
          >
            Raporto problem →
          </a>
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-1">Partneritet dyqanesh</h2>
          <p className="text-sm text-gray-600">
            Jeni pronar dyqani online dhe dëshironi të listoni produktet tuaja në gjej.al?
            Na kontaktoni dhe do të diskutojmë mundësitë e bashkëpunimit.
          </p>
          <a
            href="mailto:info@gjej.al?subject=Partneritet"
            className="inline-block mt-3 text-sm text-orange-600 font-medium hover:underline"
          >
            Na shkruani →
          </a>
        </div>

        <p className="text-xs text-gray-400 text-center">
          Zakonisht përgjigjemi brenda 24–48 orësh gjatë ditëve të punës.
        </p>
      </div>
    </div>
  );
}
