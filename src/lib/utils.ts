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

export function exportToCSV(data: Record<string, unknown>[], filename: string): void {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvRows: string[] = [];

  // Header row
  csvRows.push(headers.map(h => `"${h}"`).join(","));

  // Data rows
  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header];
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    });
    csvRows.push(values.join(","));
  }

  const csvContent = csvRows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `${filename}.csv`);
}

export function exportToJSON(data: Record<string, unknown>[], filename: string): void {
  if (data.length === 0) return;

  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
  triggerDownload(blob, `${filename}.json`);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
