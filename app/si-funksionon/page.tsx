import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Si Funksionon · gjej.al",
  description: "Mëso si funksionon gjej.al dhe si mbledhim çmimet nga dyqanet shqiptare.",
};

export default function SiFunksiononPage() {
  const steps = [
    {
      num: "1",
      title: "Mbledhja e çmimeve",
      desc: "Çdo ditë sistemi ynë vizton automatikisht dyqanet partnere dhe mbledh çmimet aktuale të produkteve. Çmimet përditësohen çdo 24 orë.",
    },
    {
      num: "2",
      title: "Përpunimi dhe krahasimi",
      desc: "Produktet nga dyqane të ndryshme krahasohen dhe grupohen bashkë. Algoritmi ynë identifikon të njëjtin produkt edhe kur emrat ndryshojnë pak nga dyqani në dyqan.",
    },
    {
      num: "3",
      title: "Filtrimi i çmimeve të dyshimta",
      desc: "Çmimet që janë shumë të ulëta ose shumë të larta krahasuar me mesataren shënohen automatikisht si të dyshimta, për t'ju mbrojtur nga gabimet ose listimet e gabuara.",
    },
    {
      num: "4",
      title: "Kërkoni dhe krahasoni",
      desc: "Ju mund të kërkoni çdo produkt, të shihni historikun e çmimeve, dhe të vendosni alarme çmimi — ne do t'ju njoftojmë kur çmimi të bjerë nën nivelin që zgjidhni.",
    },
    {
      num: "5",
      title: "Blini te dyqani",
      desc: "Pasi gjeni çmimin më të mirë, gjej.al ju dërgon direkt te dyqani online ku mund të bëni blerjen. Ne nuk procesojmë pagesa dhe nuk mbajmë të dhëna karte.",
    },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <nav className="text-xs text-gray-400 mb-6 flex items-center gap-1">
        <Link href="/" className="hover:text-orange-600">Kryefaqja</Link>
        <span>/</span>
        <span className="text-gray-600">Si funksionon</span>
      </nav>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">Si funksionon gjej.al?</h1>
      <p className="text-sm text-gray-500 mb-10">Gjeni çmimin më të mirë në 5 hapa të thjeshtë</p>

      <div className="space-y-6">
        {steps.map((step) => (
          <div key={step.num} className="flex gap-4 items-start">
            <div className="shrink-0 w-10 h-10 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold text-lg">
              {step.num}
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-800 mb-1">{step.title}</h2>
              <p className="text-sm text-gray-600">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 bg-orange-50 border border-orange-100 rounded-xl p-5">
        <h3 className="font-semibold text-gray-800 mb-1">Alarmet e çmimit</h3>
        <p className="text-sm text-gray-600">
          Vendosni një çmim target për çdo produkt dhe ne do t'ju dërgojmë email kur ai çmim
          arrihet. Kjo veçori është falas dhe nuk kërkon regjistrim.
        </p>
      </div>
    </div>
  );
}
