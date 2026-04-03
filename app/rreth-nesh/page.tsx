import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rreth Nesh · gjej.al",
  description: "Mëso më shumë rreth gjej.al — platformës shqiptare të krahasimit të çmimeve.",
};

export default function RrethNeshPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <nav className="text-xs text-gray-400 mb-6 flex items-center gap-1">
        <Link href="/" className="hover:text-orange-600">Kryefaqja</Link>
        <span>/</span>
        <span className="text-gray-600">Rreth nesh</span>
      </nav>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">Rreth gjej.al</h1>
      <p className="text-sm text-gray-500 mb-8">Platforma shqiptare e krahasimit të çmimeve</p>

      <div className="prose prose-sm max-w-none text-gray-700 space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Kush jemi ne?</h2>
          <p>
            <strong>gjej.al</strong> është një platformë shqiptare e krahasimit të çmimeve, e ndërtuar
            me një qëllim të thjeshtë: t'ju ndihmojë të gjeni çmimin më të mirë pa pasur nevojë të
            vizitoni dyqan pas dyqani. Ne mbledhim çmimet nga dyqanet kryesore online në Shqipëri
            dhe i shfaqim ato në një vend të vetëm.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Misioni ynë</h2>
          <p>
            Misioni ynë është të bëjmë tregun dixhital shqiptar më transparent dhe të drejtë për
            konsumatorët. Duke pasur akses të lehtë në çmimet e produkteve nga shumë dyqane,
            ju mund të merrni vendime më të mira blerjeje dhe të kurseni kohë e para.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Dyqanet tona partnere</h2>
          <p>Aktualisht mbledhim çmime nga këto dyqane:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><a href="https://foleja.al" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">Foleja.al</a></li>
            <li><a href="https://shpresa.al" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">Shpresa Group</a></li>
            <li><a href="https://neptun.al" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">Neptun</a></li>
            <li><a href="https://pcstore.al" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">PC Store</a></li>
            <li><a href="https://globe.al" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">Globe Albania</a></li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Shënim i rëndësishëm</h2>
          <p>
            gjej.al nuk shet produkte dhe nuk është dyqan online. Ne vetëm shfaqim çmimet dhe
            drejtojmë vizitorët tek dyqanet përkatëse. Çmimet, stoku dhe disponueshmëria e
            produkteve mund të ndryshojnë — gjithmonë konfirmoni detajet te dyqani para blerjes.
          </p>
        </section>
      </div>
    </div>
  );
}
