import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-extrabold text-orange-600 mb-4">404</h1>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Faqja nuk u gjet</h2>
      <p className="text-gray-500 mb-8 max-w-md">
        Faqja qe po kerkoni nuk ekziston ose eshte zhvendosur.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-medium px-6 py-3 rounded-lg transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        Kthehu ne Kryefaqje
      </Link>
    </div>
  );
}
