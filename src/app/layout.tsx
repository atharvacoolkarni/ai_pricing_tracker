import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar, { ThemeProvider } from "@/components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Pricing Tracker",
  description:
    "Compare AI chatbot subscription plans and API token pricing in one place. Track price changes over time.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100`}>
        <ThemeProvider>
          <Navbar />
          <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
          <footer className="mt-16 border-t border-gray-200 dark:border-gray-700 py-6 text-center text-xs text-gray-400 dark:text-gray-500">
            AI Pricing Tracker — Data updated daily. Prices may not be 100% accurate; always verify with the provider.
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
