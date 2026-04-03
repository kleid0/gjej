import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politika e Privatësisë · gjej.al",
  description: "Politika e privatësisë e gjej.al — si i mbledhim dhe përdorim të dhënat tuaja.",
};

export default function PrivatesiePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <nav className="text-xs text-gray-400 mb-6 flex items-center gap-1">
        <Link href="/" className="hover:text-orange-600">Kryefaqja</Link>
        <span>/</span>
        <span className="text-gray-600">Politika e privatësisë</span>
      </nav>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">Politika e Privatësisë</h1>
      <p className="text-sm text-gray-500 mb-8">Përditësuar: Janar 2025</p>

      <div className="space-y-8 text-sm text-gray-700">
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">1. Çfarë të dhënash mbledhim</h2>
          <p className="mb-2">gjej.al mbledh vetëm të dhënat minimale të nevojshme:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Adresa email</strong> — vetëm nëse vendosni një alarm çmimi. Nuk kërkohet regjistrim.</li>
            <li><strong>Të dhëna teknike</strong> — adresa IP, lloji i shfletuesit dhe faqet e vizituara, të mbledhura automatikisht për funksionimin e faqes.</li>
            <li><strong>Cookies</strong> — cookie-t esenciale për funksionimin e faqes (p.sh. preferencat e pamjes).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">2. Si i përdorim të dhënat</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Dërgimi i njoftimeve të alarmeve të çmimit në emailin tuaj.</li>
            <li>Përmirësimi i funksionimit të faqes dhe i algoritmeve të kërkimit.</li>
            <li>Analitika anonime e trafikut (nuk identifikojmë persona fizikë).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">3. Ndarje me palë të treta</h2>
          <p>
            Ne nuk shesim, ndajmë, apo japim me qira të dhënat tuaja personale te palë të treta.
            Emailet dërgohen përmes <strong>Resend</strong> (ofrues i shërbimit të emailit), i cili
            operon sipas standardeve GDPR.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">4. Ruajtja e të dhënave</h2>
          <p>
            Adresat email të lidhura me alarme çmimi ruhen derisa ju vetë të fshini alarmin.
            Të dhënat teknike të logeve fshihen automatikisht pas 30 ditësh.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">5. Të drejtat tuaja</h2>
          <p className="mb-2">Ju keni të drejtë të:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Kërkoni fshirjen e adresës tuaj email nga sistemi ynë.</li>
            <li>Merrni informacion mbi çfarë të dhënash kemi për ju.</li>
            <li>Tërhiqni pëlqimin tuaj në çdo kohë.</li>
          </ul>
          <p className="mt-2">
            Për çdo kërkesë, na kontaktoni në{" "}
            <Link href="/kontakt" className="text-orange-600 hover:underline">faqen e kontaktit</Link>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">6. Ndryshime në politikë</h2>
          <p>
            Mund të përditësojmë këtë politikë herë pas here. Ndryshimet hyjnë në fuqi sapo
            publikohen në faqe. Ju rekomandojmë ta rishikoni periodikisht.
          </p>
        </section>
      </div>
    </div>
  );
}
