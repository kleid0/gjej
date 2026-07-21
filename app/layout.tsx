import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { productCatalog } from "@/src/infrastructure/container";
import { buildNavMenu, type NavCategoryData } from "@/src/application/catalog/NavMenu";

const inter = Inter({ subsets: ["latin"] });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gjej.al";

export const metadata: Metadata = {
  title: {
    default: "Gjej.al – Krahasimi i Çmimeve në Shqipëri",
    template: "%s",
  },
  description:
    "Gjej çmimin më të mirë për produktet tuaja te dyqanet shqiptare. Krahasoni çmimet nga Foleja, Shpresa, Neptun, Globe Albania dhe AlbaGame.",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    siteName: "Gjej.al",
    type: "website",
    locale: "sq_AL",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
  },
};

// Proper mobile viewport — prevents text size inflation on iOS
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
};

// The mega-menu needs brand/featured data from the catalogue. Memoize per
// server instance — the layout renders on every page and the nav only
// changes when the catalogue does (10 min staleness is invisible here).
let navCache: { at: number; data: NavCategoryData[] } | null = null;
async function getNav(): Promise<NavCategoryData[]> {
  if (navCache && Date.now() - navCache.at < 10 * 60_000) return navCache.data;
  const products = await productCatalog.getAllProducts();
  navCache = { at: Date.now(), data: buildNavMenu(products) };
  return navCache.data;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nav = await getNav();
  return (
    <html lang="sq">
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        <Header nav={nav} />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
