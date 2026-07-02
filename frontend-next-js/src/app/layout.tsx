import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ATWORKS",
  description: "ATworks API Tester and Validation Recommender",
};

import Link from "next/link";
import Image from "next/image";
import { Toaster } from "@/components/ui/sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <div className="app-layout">
          <aside className="sidebar">
            <Link href="/" className="sidebar-header" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
              <img src="/favicon.ico" alt="Logo" width="28" height="28" style={{ borderRadius: '4px' }} />
              <h2>ATWORKS</h2>
            </Link>
            <nav className="sidebar-nav">
              <Link href="/" className="nav-link">🏠 홈</Link>
              <Link href="/validation" className="nav-link">✅ 값 검증</Link>
              <Link href="/api-registry" className="nav-link">💾 API 관리</Link>
            </nav>
          </aside>
          <main className="main-area">
            {children}
          </main>
        </div>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
