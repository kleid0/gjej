export default function Footer() {
  return (
    <footer className="bg-gray-800 text-gray-400 text-sm py-8 px-4 mt-auto">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
          <div>
            <h3 className="text-white font-semibold mb-2">gjej.al</h3>
            <p className="text-xs leading-relaxed">
              Krahasimi i çmimeve për konsumatorët shqiptarë. Gjej çmimin më të mirë pa u larguar nga faqja.
            </p>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-2">Dyqanet</h3>
            <ul className="space-y-1 text-xs">
              <li><a href="https://foleja.al" target="_blank" rel="noopener noreferrer" className="hover:text-white">Foleja.al</a></li>
              <li><a href="https://shpresa.al" target="_blank" rel="noopener noreferrer" className="hover:text-white">Shpresa Group</a></li>
              <li><a href="https://neptun.al" target="_blank" rel="noopener noreferrer" className="hover:text-white">Neptun</a></li>
              <li><a href="https://pcstore.al" target="_blank" rel="noopener noreferrer" className="hover:text-white">PC Store</a></li>
              <li><a href="https://globe.al" target="_blank" rel="noopener noreferrer" className="hover:text-white">Globe Albania</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-2">Kategoritë</h3>
            <ul className="space-y-1 text-xs">
              <li>Telefona & Tablets</li>
              <li>Kompjutera</li>
              <li>Elektronikë</li>
              <li>Shtëpi & Kopsht</li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-2">Informacion</h3>
            <ul className="space-y-1 text-xs">
              <li>Rreth nesh</li>
              <li>Si funksionon</li>
              <li>Politika e privatësisë</li>
              <li>Na kontaktoni</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-700 pt-4 text-xs text-gray-500">
          <p className="mb-1">
            ⚠️ <strong className="text-gray-400">Disclaimer:</strong> Çmimet, stoku dhe disponueshmëria e produkteve janë
            siç reklamohen nga dyqanet përkatëse. Gjej.al nuk verifikon stokun fizik dhe nuk garanton saktësinë
            e informacionit. Gjithmonë konfirmoni te dyqani para blerjes.
          </p>
          <p>© {new Date().getFullYear()} gjej.al · Ndërtuar për konsumatorët shqiptarë</p>
        </div>
      </div>
    </footer>
  );
}
