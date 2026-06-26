import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import ForcePasswordGuard from "@/components/ForcePasswordGuard";
import AIAssistant from "@/components/AIAssistant";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "CourtUp - Gestión Inteligente de Clubes Deportivos",
  description: "Plataforma premium para gestión de canchas, clases y torneos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-[var(--background)] text-[var(--foreground)]`}
      >
        <ForcePasswordGuard>
          <Sidebar />
          <div className="main-content-layout min-h-screen">
            {children}
          </div>
          <AIAssistant />
        </ForcePasswordGuard>
      </body>
    </html>
  );
}
