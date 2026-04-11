import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const inter = Inter({ subsets: ["latin"] });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gjej.al";

export const metadata: Metadata = {
  title: {
    default: "Gjej.al – Krahasimi i Çmimeve në Shqipëri",
    template: "%s",
  },
  description:
    "Gjej çmimin më të mirë për produktet tuaja te dyqanet shqiptare. Krahasoni çmimet nga Foleja, Shpresa, Neptun, PC Store dhe Globe Albania.",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sq">
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
