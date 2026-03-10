"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BarChart2, CreditCard, History, Home } from "lucide-react";

const navLinks = [
  { href: "/", label: "Overview", icon: Home },
  { href: "/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/api-pricing", label: "API Pricing", icon: BarChart2 },
  { href: "/history", label: "Price History", icon: History },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-gray-900 text-lg">
          <span className="text-2xl">💡</span>
          <span>AI Pricing Tracker</span>
        </Link>
        <nav className="flex items-center gap-1">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                pathname === href
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
