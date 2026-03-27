"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { ProviderSubscription, Plan } from "@/lib/types";
import { cn, exportToCSV, exportToJSON } from "@/lib/utils";
import { ChevronDown, ChevronUp, ArrowUpDown, Download } from "lucide-react";
import ProviderDrawer from "./ProviderDrawer";

interface FlatPlan extends Plan {
  providerName: string;
  providerSlug: string;
  providerEmoji: string;
  providerColor: string;
  providerWebsite: string;
}

interface Props {
  providers: ProviderSubscription[];
}

type SortKey = "price_monthly" | "name" | "provider";
type SortDir = "asc" | "desc";

const TIER_LABELS: Record<string, string> = {
  consumer: "Consumer",
  team: "Team",
  enterprise: "Enterprise",
};

const TIER_BADGE: Record<string, string> = {
  consumer: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  team: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
  enterprise: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
};

export default function SubscriptionsTable({ providers }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Initialize state from URL params
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [tierFilter, setTierFilter] = useState<string>(searchParams.get("tier") ?? "all");
  const [providerFilter, setProviderFilter] = useState<string>(searchParams.get("provider") ?? "all");
  const [sortKey, setSortKey] = useState<SortKey>((searchParams.get("sort") as SortKey) || "price_monthly");
  const [sortDir, setSortDir] = useState<SortDir>((searchParams.get("dir") as SortDir) || "asc");
  const [drawerProvider, setDrawerProvider] = useState<ProviderSubscription | null>(null);

  // Update URL params helper
  const updateParams = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value && value !== "all" && value !== "price_monthly" && !(key === "dir" && value === "asc")) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    const queryString = params.toString();
    router.replace(`${pathname}${queryString ? `?${queryString}` : ""}`, { scroll: false });
  }, [searchParams, router, pathname]);

  // Debounced search URL update
  useEffect(() => {
    const timeout = setTimeout(() => {
      updateParams({ q: search });
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, updateParams]);

  const allPlans: FlatPlan[] = useMemo(() =>
    providers.flatMap((p) =>
      p.plans.map((plan) => ({
        ...plan,
        providerName: p.provider,
        providerSlug: p.slug,
        providerEmoji: p.logo_emoji,
        providerColor: p.color ?? "#6b7280",
        providerWebsite: p.website,
      }))
    ),
    [providers]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allPlans
      .filter((p) => {
        const matchSearch =
          !q ||
          p.providerName.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          (p.model_access ?? "").toLowerCase().includes(q);
        const matchTier = tierFilter === "all" || p.tier === tierFilter;
        const matchProvider = providerFilter === "all" || p.providerSlug === providerFilter;
        return matchSearch && matchTier && matchProvider;
      })
      .sort((a, b) => {
        if (sortKey === "price_monthly") {
          const av = a.price_monthly ?? (a.is_free ? -1 : Infinity);
          const bv = b.price_monthly ?? (b.is_free ? -1 : Infinity);
          return sortDir === "asc" ? av - bv : bv - av;
        }
        if (sortKey === "name") {
          return sortDir === "asc"
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name);
        }
        if (sortKey === "provider") {
          return sortDir === "asc"
            ? a.providerName.localeCompare(b.providerName)
            : b.providerName.localeCompare(a.providerName);
        }
        return 0;
      });
  }, [allPlans, search, tierFilter, providerFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      const newDir = sortDir === "asc" ? "desc" : "asc";
      setSortDir(newDir);
      updateParams({ sort: key, dir: newDir });
    } else {
      setSortKey(key);
      setSortDir("asc");
      updateParams({ sort: key, dir: "asc" });
    }
  }

  function handleTierFilter(tier: string) {
    setTierFilter(tier);
    updateParams({ tier });
  }

  function handleProviderFilter(provider: string) {
    setProviderFilter(provider);
    updateParams({ provider });
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-40 inline" />;
    return sortDir === "asc"
      ? <ChevronUp className="ml-1 h-3 w-3 inline" />
      : <ChevronDown className="ml-1 h-3 w-3 inline" />;
  }

  function openDrawer(slug: string) {
    const prov = providers.find((p) => p.slug === slug);
    if (prov) setDrawerProvider(prov);
  }

  function getExportData() {
    return filtered.map((plan) => ({
      Provider: plan.providerName,
      Plan: plan.name,
      Price: plan.is_free ? "Free" : plan.price_monthly === null ? "Contact sales" : `$${plan.price_monthly}`,
      Tier: TIER_LABELS[plan.tier ?? "consumer"] ?? plan.tier,
      "Model Access": plan.model_access ?? "",
      "Usage Limits": plan.usage_limits ?? "",
    }));
  }

  return (
    <>
      <div className="space-y-4">
        {/* Search + count */}
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Search providers, plans, models…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400 w-72"
          />
          <span className="ml-auto text-sm text-gray-500">
            {filtered.length} plan{filtered.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => exportToCSV(getExportData(), "subscriptions")}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
          <button
            onClick={() => exportToJSON(getExportData(), "subscriptions")}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            JSON
          </button>
        </div>

        {/* Tier filter chips */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mr-1">Tier</span>
          {["all", "consumer", "team", "enterprise"].map((t) => (
            <button
              key={t}
              onClick={() => handleTierFilter(t)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                tierFilter === t
                  ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100"
                  : "bg-white text-gray-600 border-gray-300 hover:border-gray-500 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:border-gray-500"
              )}
            >
              {t === "all" ? "All" : TIER_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Provider filter chips */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mr-1">Provider</span>
          <button
            onClick={() => handleProviderFilter("all")}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
              providerFilter === "all"
                ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100"
                : "bg-white text-gray-600 border-gray-300 hover:border-gray-500 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:border-gray-500"
            )}
          >
            All
          </button>
          {providers.map((p) => (
            <button
              key={p.slug}
              onClick={() => handleProviderFilter(p.slug)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium border transition-colors flex items-center gap-1.5",
                providerFilter === p.slug
                  ? "text-white border-transparent"
                  : "bg-white text-gray-700 border-gray-300 hover:border-gray-500 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:border-gray-500"
              )}
              style={providerFilter === p.slug ? { backgroundColor: p.color, borderColor: p.color } : undefined}
            >
              <span>{p.logo_emoji}</span>
              {p.provider}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left cursor-pointer whitespace-nowrap" onClick={() => toggleSort("provider")}>
                  Provider <SortIcon k="provider" />
                </th>
                <th className="px-4 py-3 text-left cursor-pointer whitespace-nowrap" onClick={() => toggleSort("name")}>
                  Plan <SortIcon k="name" />
                </th>
                <th className="px-4 py-3 text-right cursor-pointer whitespace-nowrap" onClick={() => toggleSort("price_monthly")}>
                  Price/mo <SortIcon k="price_monthly" />
                </th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Tier</th>
                <th className="px-4 py-3 text-left">Model Access</th>
                <th className="px-4 py-3 text-left">Usage Limits</th>
                <th className="px-4 py-3 text-left">Features</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.map((plan, i) => (
                <tr key={`${plan.providerSlug}-${plan.name}-${i}`} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  {/* Provider cell — clickable to open drawer */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openDrawer(plan.providerSlug)}
                      className="flex items-center gap-2 group hover:underline underline-offset-2 text-left"
                    >
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: plan.providerColor }}
                      />
                      <span className="text-lg leading-none">{plan.providerEmoji}</span>
                      <span className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors whitespace-nowrap">
                        {plan.providerName}
                      </span>
                    </button>
                  </td>

                  {/* Plan name */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-gray-900">{plan.name}</span>
                      {plan.highlighted && (
                        <span className="rounded-full bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 font-medium">
                          Popular
                        </span>
                      )}
                    </div>
                    {plan.best_for && (
                      <div className="text-xs text-gray-400 mt-0.5">{plan.best_for}</div>
                    )}
                  </td>

                  {/* Price */}
                  <td className="px-4 py-3 text-right">
                    {plan.is_free ? (
                      <span className="font-semibold text-green-600">Free</span>
                    ) : plan.price_monthly === null ? (
                      <span className="text-gray-400 text-xs">Contact sales</span>
                    ) : (
                      <div>
                        <span className="font-semibold text-gray-900">${plan.price_monthly}</span>
                        {plan.per_seat && (
                          <span className="text-xs text-gray-400 block">/seat</span>
                        )}
                        {plan.price_annual_monthly && plan.price_annual_monthly < (plan.price_monthly ?? Infinity) && (
                          <span className="text-xs text-green-600 block">
                            ${plan.price_annual_monthly} annual
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Tier badge */}
                  <td className="px-4 py-3">
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                      TIER_BADGE[plan.tier ?? "consumer"] ?? "bg-gray-100 text-gray-600"
                    )}>
                      {TIER_LABELS[plan.tier ?? "consumer"] ?? plan.tier}
                    </span>
                  </td>

                  {/* Model Access */}
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 max-w-[200px]">
                    <span className="text-xs leading-relaxed">{plan.model_access ?? "—"}</span>
                  </td>

                  {/* Usage Limits */}
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 max-w-[180px]">
                    <span className="text-xs leading-relaxed">{plan.usage_limits ?? "—"}</span>
                  </td>

                  {/* Features tags */}
                  <td className="px-4 py-3">
                    <FeatureTags features={plan.key_features} />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No plans match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provider Drawer */}
      <ProviderDrawer
        provider={drawerProvider}
        onClose={() => setDrawerProvider(null)}
      />
    </>
  );
}

function FeatureTags({ features }: { features: string[] }) {
  const MAX_VISIBLE = 3;
  const visible = features.slice(0, MAX_VISIBLE);
  const overflow = features.length - MAX_VISIBLE;
  return (
    <div className="flex flex-wrap gap-1 items-center">
      {visible.map((f, i) => (
        <span key={i} className="rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs px-1.5 py-0.5 whitespace-nowrap">
          {f}
        </span>
      ))}
      {overflow > 0 && (
        <span className="text-xs text-gray-400 dark:text-gray-500 ml-0.5">+{overflow}</span>
      )}
    </div>
  );
}