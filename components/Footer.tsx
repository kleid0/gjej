import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-paper-deep border-t-2 border-ink text-ink/70 text-sm py-8 px-4 mt-auto">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
          <div>
            <h3 className="text-ink font-bold mb-2">gjej.al</h3>
            <p className="text-xs leading-relaxed">
              Krahasimi i çmimeve për konsumatorët shqiptarë. Gjej çmimin më të mirë pa u larguar nga faqja.
            </p>
          </div>
          <div>
            <h3 className="text-ink font-bold mb-2">Dyqanet</h3>
            <ul className="space-y-1 text-xs">
              <li><a href="https://foleja.al" target="_blank" rel="noopener noreferrer" className="hover:text-tomato">Foleja.al</a></li>
              <li><a href="https://shpresa.al" target="_blank" rel="noopener noreferrer" className="hover:text-tomato">Shpresa Group</a></li>
              <li><a href="https://neptun.al" target="_blank" rel="noopener noreferrer" className="hover:text-tomato">Neptun</a></li>
              <li><a href="https://globe.al" target="_blank" rel="noopener noreferrer" className="hover:text-tomato">Globe Albania</a></li>
              <li><a href="https://albagame.al" target="_blank" rel="noopener noreferrer" className="hover:text-tomato">AlbaGame</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-ink font-bold mb-2">Kategoritë</h3>
            <ul className="space-y-1 text-xs">
              <li><Link href="/kategori/telefona" className="hover:text-tomato">Telefona & Tablets</Link></li>
              <li><Link href="/kategori/kompjutera" className="hover:text-tomato">Kompjutera</Link></li>
              <li><Link href="/kategori/gaming" className="hover:text-tomato">Gaming</Link></li>
              <li><Link href="/kategori/shtepiake" className="hover:text-tomato">Elektroshtëpiake</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-ink font-bold mb-2">Informacion</h3>
            <ul className="space-y-1 text-xs">
              <li><Link href="/rreth-nesh" className="hover:text-tomato">Rreth nesh</Link></li>
              <li><Link href="/si-funksionon" className="hover:text-tomato">Si funksionon</Link></li>
              <li><Link href="/privatesia" className="hover:text-tomato">Politika e privatësisë</Link></li>
              <li><Link href="/kontakt" className="hover:text-tomato">Na kontaktoni</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-sand pt-4 text-xs text-ink/60">
          <p className="mb-1">
            ⚠️ <strong className="text-ink/80">Disclaimer:</strong> Çmimet, stoku dhe disponueshmëria e produkteve janë
            siç reklamohen nga dyqanet përkatëse. Gjej.al nuk verifikon stokun fizik dhe nuk garanton saktësinë
            e informacionit. Gjithmonë konfirmoni te dyqani para blerjes.
          </p>
          <p>© {new Date().getFullYear()} gjej.al · Ndërtuar për konsumatorët shqiptarë</p>
        </div>
      </div>
    </footer>
  );
}
