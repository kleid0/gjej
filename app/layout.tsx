import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Gjej.al – Krahasimi i Çmimeve në Shqipëri",
  description:
    "Gjej çmimin më të mirë për produktet tuaja te dyqanet shqiptare. Krahasoni çmimet nga Foleja, Shpresa, Neptun, PC Store dhe Globe Albania.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sq">
      <body className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
