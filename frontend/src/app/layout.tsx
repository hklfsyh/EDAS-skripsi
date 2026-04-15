import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "PlaylistAI — Temukan Playlist yang Pas",
  description: "Rekomendasi playlist musik berbasis konteks aktivitasmu.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={figtree.variable}>
      <body>{children}</body>
    </html>
  );
}
