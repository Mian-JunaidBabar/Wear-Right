import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, JetBrains_Mono, Playfair_Display, Plus_Jakarta_Sans, Poppins } from "next/font/google";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--nf-inter", display: "swap" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--nf-jakarta", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--nf-playfair", display: "swap" });
const poppins = Poppins({ subsets: ["latin"], weight: ["500", "700"], variable: "--nf-poppins", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--nf-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: "Wear Right",
  description: "Right style. Right you.",
  icons: { icon: "/brand/wr-icon.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jakarta.variable} ${playfair.variable} ${poppins.variable} ${jetbrains.variable}`}
    >
      <body>
        <Providers>
          <div className="min-h-screen bg-slate-50 flex flex-col justify-between text-slate-900 font-sans">
            {/* usePathname() is runtime data, so the navbar streams in behind a same-height placeholder. */}
            <Suspense fallback={<div className="sticky top-0 z-50 h-20 w-full border-b border-slate-200 bg-white" />}>
              <Navbar />
            </Suspense>
            <main className="flex-1 w-full">{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
