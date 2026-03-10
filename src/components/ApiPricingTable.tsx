"use client";

import { useState, useMemo } from "react";
import type { ApiModel } from "@/lib/types";
import { formatPrice, calcMonthlyCost } from "@/lib/utils";
import { Calculator, ChevronDown, ChevronUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

type SortKey = "name" | "provider" | "input_price_per_1m" | "output_price_per_1m" | "blended_price_per_1m" | "context_window_k" | "speed_tok_per_s" | "intelligence_score";
type SortDir = "asc" | "desc";

interface Props {
  models: ApiModel[];
  dataSource?: string;
  fetchedAt?: string;
}

const SOURCE_META: Record<string, { label: string; url: string; color: string; bg: string; border: string; dot: string }> = {
  "artificial-analysis": {
    label: "Artificial Analysis",
    url: "https://artificialanalysis.ai",
    color: "text-emerald-800",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  "openrouter": {
    label: "OpenRouter (fallback)",
    url: "https://openrouter.ai",
    color: "text-amber-800",
    bg: "bg-amber-50",
    border: "border-amber-200",
    dot: "bg-amber-400",
  },
  "manual": {
    label: "Manual / seed data",
    url: "#",
    color: "text-gray-700",
    bg: "bg-gray-50",
    border: "border-gray-200",
    dot: "bg-gray-400",
  },
};

const PROVIDER_COLORS: Record<string, string> = {
  openai: "bg-green-100 text-green-800",
  anthropic: "bg-orange-100 text-orange-800",
  google: "bg-blue-100 text-blue-800",
  meta: "bg-indigo-100 text-indigo-800",
  deepseek: "bg-cyan-100 text-cyan-800",
  mistral: "bg-purple-100 text-purple-800",
  xai: "bg-gray-100 text-gray-800",
  perplexity: "bg-teal-100 text-teal-800",
};

function providerBadge(slug: string) {
  return PROVIDER_COLORS[slug] ?? "bg-gray-100 text-gray-800";
}

export default function ApiPricingTable({ models, dataSource, fetchedAt }: Props) {
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("blended_price_per_1m");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Detect if any model has blended/speed/intelligence data
  const hasBlended = useMemo(() => models.some((m) => m.blended_price_per_1m != null), [models]);
  const hasSpeed = useMemo(() => models.some((m) => m.speed_tok_per_s != null), [models]);
  const hasIntelligence = useMemo(() => models.some((m) => m.intelligence_score != null), [models]);
  const maxSpeed = useMemo(() => Math.max(...models.map((m) => m.speed_tok_per_s ?? 0)), [models]);
  const maxIntelligence = useMemo(() => Math.max(...models.map((m) => m.intelligence_score ?? 0)), [models]);

  // Calculator state
  const [inputTokens, setInputTokens] = useState(1_000_000);
  const [outputTokens, setOutputTokens] = useState(500_000);
  const [showCalc, setShowCalc] = useState(false);

  const providers = useMemo(() => {
    const set = new Set(models.map((m) => m.provider_slug));
    return Array.from(set).sort();
  }, [models]);

  const filtered = useMemo(() => {
    return models
      .filter((m) => {
        const matchSearch =
          m.name.toLowerCase().includes(search.toLowerCase()) ||
          m.provider.toLowerCase().includes(search.toLowerCase());
        const matchProvider = providerFilter === "all" || m.provider_slug === providerFilter;
        return matchSearch && matchProvider;
      })
      .sort((a, b) => {
        const av = a[sortKey] ?? Infinity;
        const bv = b[sortKey] ?? Infinity;
        if (typeof av === "string" && typeof bv === "string")
          return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
        const an = typeof av === "number" ? av : Infinity;
        const bn = typeof bv === "number" ? bv : Infinity;
        return sortDir === "asc" ? an - bn : bn - an;
      });
  }, [models, search, providerFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-40 inline" />;
    return sortDir === "asc"
      ? <ChevronUp className="ml-1 h-3 w-3 inline" />
      : <ChevronDown className="ml-1 h-3 w-3 inline" />;
  }

  return (
    <div className="space-y-4">
      {/* Data source banner */}
      {dataSource && (() => {
        const meta = SOURCE_META[dataSource] ?? SOURCE_META["manual"];
        const fetchedDate = fetchedAt
          ? new Date(fetchedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
          : null;
        return (
          <div className={cn(
            "flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm",
            meta.bg, meta.border
          )}>
            <div className={cn("flex items-center gap-2.5", meta.color)}>
              <span className={cn("inline-block h-2 w-2 rounded-full flex-shrink-0", meta.dot)} />
              <span>
                Data sourced from{" "}
                <a
                  href={meta.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline underline-offset-2 hover:opacity-80"
                >
                  {meta.label}
                </a>
                {dataSource === "openrouter" && (
                  <span className="ml-1 opacity-70">— set AA_API_KEY for richer data (speed, intelligence, blended pricing)</span>
                )}
              </span>
            </div>
            {fetchedDate && (
              <span className={cn("text-xs opacity-60 ml-4 flex-shrink-0", meta.color)}>
                Updated {fetchedDate}
              </span>
            )}
          </div>
        );
      })()}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search models…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 w-56"
        />
        <select
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          <option value="all">All providers</option>
          {providers.map((p) => (
            <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
          ))}
        </select>
        <span className="ml-auto text-sm text-gray-500">{filtered.length} models</span>
        <button
          onClick={() => setShowCalc(!showCalc)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors"
        >
          <Calculator className="h-4 w-4" />
          Cost Calculator
        </button>
      </div>

      {/* Calculator panel */}
      {showCalc && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <Calculator className="h-4 w-4" /> Estimate Monthly API Cost
          </h3>
          <div className="flex flex-wrap gap-4 mb-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600">Input tokens / month</span>
              <input
                type="number"
                value={inputTokens}
                onChange={(e) => setInputTokens(Number(e.target.value))}
                className="w-40 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600">Output tokens / month</span>
              <input
                type="number"
                value={outputTokens}
                onChange={(e) => setOutputTokens(Number(e.target.value))}
                className="w-40 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {filtered.slice(0, 12).map((m) => {
              const cost = calcMonthlyCost(inputTokens, outputTokens, m.input_price_per_1m, m.output_price_per_1m);
              return (
                <div key={m.id} className="rounded-lg bg-white border border-blue-100 p-3">
                  <div className="text-xs text-gray-500 mb-0.5">{m.provider}</div>
                  <div className="font-medium text-sm text-gray-900 truncate">{m.name}</div>
                  <div className="text-lg font-bold text-blue-700 mt-1">
                    {cost !== null ? `$${cost.toFixed(2)}` : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left cursor-pointer" onClick={() => toggleSort("name")}>
                Model <SortIcon k="name" />
              </th>
              <th className="px-4 py-3 text-left cursor-pointer" onClick={() => toggleSort("provider")}>
                Provider <SortIcon k="provider" />
              </th>
              <th className="px-4 py-3 text-right cursor-pointer" onClick={() => toggleSort("input_price_per_1m")}>
                Input / 1M <SortIcon k="input_price_per_1m" />
              </th>
              <th className="px-4 py-3 text-right cursor-pointer" onClick={() => toggleSort("output_price_per_1m")}>
                Output / 1M <SortIcon k="output_price_per_1m" />
              </th>
              {hasBlended && (
                <th className="px-4 py-3 text-right cursor-pointer whitespace-nowrap" onClick={() => toggleSort("blended_price_per_1m")}>
                  Blended / 1M <SortIcon k="blended_price_per_1m" />
                </th>
              )}
              <th className="px-4 py-3 text-right cursor-pointer" onClick={() => toggleSort("context_window_k")}>
                Context <SortIcon k="context_window_k" />
              </th>
              {hasSpeed && (
                <th className="px-4 py-3 text-right cursor-pointer whitespace-nowrap" onClick={() => toggleSort("speed_tok_per_s")}>
                  Speed (tok/s) <SortIcon k="speed_tok_per_s" />
                </th>
              )}
              {hasIntelligence && (
                <th className="px-4 py-3 text-right cursor-pointer whitespace-nowrap" onClick={() => toggleSort("intelligence_score")}>
                  Intelligence <SortIcon k="intelligence_score" />
                </th>
              )}
              <th className="px-4 py-3 text-center">Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{m.name}</td>
                <td className="px-4 py-3">
                  <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-medium", providerBadge(m.provider_slug))}>
                    {m.provider}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-700">
                  {m.is_free ? <span className="text-green-600 font-semibold">Free</span> : formatPrice(m.input_price_per_1m)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-700">
                  {m.is_free ? <span className="text-green-600 font-semibold">Free</span> : formatPrice(m.output_price_per_1m)}
                </td>
                {hasBlended && (
                  <td className="px-4 py-3 text-right font-mono text-gray-700">
                    {m.is_free ? <span className="text-green-600 font-semibold">Free</span>
                      : m.blended_price_per_1m != null ? formatPrice(m.blended_price_per_1m)
                      : <span className="text-gray-300">—</span>}
                  </td>
                )}
                <td className="px-4 py-3 text-right text-gray-600">
                  {m.context_window_k ? `${m.context_window_k}k` : "—"}
                </td>
                {hasSpeed && (
                  <td className="px-4 py-3 text-right">
                    {m.speed_tok_per_s != null ? (
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{ width: `${Math.round((m.speed_tok_per_s / maxSpeed) * 100)}%` }}
                          />
                        </div>
                        <span className="font-mono text-gray-700 text-xs w-10 text-right">{Math.round(m.speed_tok_per_s)}</span>
                      </div>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                )}
                {hasIntelligence && (
                  <td className="px-4 py-3 text-right">
                    {m.intelligence_score != null ? (
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-400 to-violet-500"
                            style={{ width: `${Math.round((m.intelligence_score / maxIntelligence) * 100)}%` }}
                          />
                        </div>
                        <span className="font-mono text-gray-700 text-xs w-10 text-right">{m.intelligence_score}</span>
                      </div>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                )}
                <td className="px-4 py-3 text-center">
                  <span className={cn(
                    "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                    m.modality === "multimodal" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"
                  )}>
                    {m.modality}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={hasBlended || hasSpeed || hasIntelligence ? 8 : 6} className="px-4 py-8 text-center text-gray-400">No models match your filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
