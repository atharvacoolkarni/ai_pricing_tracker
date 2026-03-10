import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number | null | undefined, compact = false): string {
  if (price === null || price === undefined) return "Contact sales";
  if (price === 0) return "Free";
  if (compact && price >= 1000) {
    return `$${(price / 1000).toFixed(1)}k`;
  }
  return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

export function formatPriceShort(price: number | null | undefined): string {
  if (price === null || price === undefined) return "—";
  if (price === 0) return "Free";
  return `$${price}`;
}

export function calcMonthlyCost(
  inputTokens: number,
  outputTokens: number,
  inputPricePer1M: number | null,
  outputPricePer1M: number | null
): number | null {
  if (inputPricePer1M === null || outputPricePer1M === null) return null;
  return (inputTokens / 1_000_000) * inputPricePer1M + (outputTokens / 1_000_000) * outputPricePer1M;
}

export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function changePctColor(pct: number | null): string {
  if (pct === null) return "text-gray-500";
  if (pct < 0) return "text-green-600"; // price drop = good
  if (pct > 0) return "text-red-600";   // price increase = bad
  return "text-gray-500";
}

export function changePctLabel(pct: number | null): string {
  if (pct === null) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}
