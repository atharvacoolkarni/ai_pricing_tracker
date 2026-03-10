"use client";

import type { PriceChange } from "@/lib/types";
import { changePctColor, changePctLabel, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp } from "lucide-react";

interface Props {
  changes: PriceChange[];
}

export default function PriceHistoryTable({ changes }: Props) {
  if (changes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center text-gray-400">
        <p className="text-lg font-medium">No price changes recorded yet.</p>
        <p className="mt-1 text-sm">Changes are auto-detected when the daily pipeline runs.</p>
      </div>
    );
  }

  const sorted = [...changes].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
          <tr>
            <th className="px-4 py-3 text-left">Date</th>
            <th className="px-4 py-3 text-left">Provider</th>
            <th className="px-4 py-3 text-left">Model / Plan</th>
            <th className="px-4 py-3 text-left">Type</th>
            <th className="px-4 py-3 text-right">Old Price</th>
            <th className="px-4 py-3 text-right">New Price</th>
            <th className="px-4 py-3 text-right">Change</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.map((c, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-500">{formatDate(c.date)}</td>
              <td className="px-4 py-3 font-medium text-gray-900">{c.provider}</td>
              <td className="px-4 py-3 text-gray-700">{c.model_or_plan}</td>
              <td className="px-4 py-3">
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  c.type === "api" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                )}>
                  {c.type === "api" ? "API" : "Subscription"}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-mono text-gray-500">${c.old_value}</td>
              <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">${c.new_value}</td>
              <td className={cn("px-4 py-3 text-right font-semibold flex items-center justify-end gap-1", changePctColor(c.change_pct))}>
                {c.change_pct !== null && c.change_pct < 0
                  ? <TrendingDown className="h-3.5 w-3.5" />
                  : <TrendingUp className="h-3.5 w-3.5" />}
                {changePctLabel(c.change_pct)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
