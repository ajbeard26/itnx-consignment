import type { ReactNode } from "react";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata = {
  title: {
    default: "ITNX Consignment",
    template: "%s · ITNX",
  },
  description: "Consignment portal — a service of NXRENT LLC",
};
export const dynamic = "force-dynamic";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${outfit.className} ${outfit.variable}`}>{children}</body>
    </html>
  );
}
