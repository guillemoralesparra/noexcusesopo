import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk } from "next/font/google";
import { LangProvider } from "@/components/LangProvider";
import { getLang } from "@/lib/lang";
import "./globals.css";

const hanken = Hanken_Grotesk({ variable: "--font-hanken", subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "NoExcusesOpo",
  description: "Preparació de l'oposició d'infermeria de l'ICS. Plataforma no oficial.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#14695f" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1816" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const lang = await getLang();
  return (
    <html lang={lang}>
      <body className={`${hanken.variable} font-sans antialiased`}>
        <LangProvider lang={lang}>{children}</LangProvider>
      </body>
    </html>
  );
}
