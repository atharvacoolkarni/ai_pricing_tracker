"use client";

import { useState, useMemo } from "react";
import type { ProviderSubscription, Plan } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, ArrowUpDown } from "lucide-react";
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
  consumer: "bg-blue-100 text-blue-700",
  team: "bg-violet-100 text-violet-700",
  enterprise: "bg-amber-100 text-amber-700",
};

export default function SubscriptionsTable({ providers }: Props) {
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("price_monthly");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [drawerProvider, setDrawerProvider] = useState<ProviderSubscription | null>(null);

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
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
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
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 w-72"
          />
          <span className="ml-auto text-sm text-gray-500">
            {filtered.length} plan{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Tier filter chips */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mr-1">Tier</span>
          {["all", "consumer", "team", "enterprise"].map((t) => (
            <button
              key={t}
              onClick={() => setTierFilter(t)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                tierFilter === t
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"
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
            onClick={() => setProviderFilter("all")}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
              providerFilter === "all"
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"
            )}
          >
            All
          </button>
          {providers.map((p) => (
            <button
              key={p.slug}
              onClick={() => setProviderFilter(p.slug)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium border transition-colors flex items-center gap-1.5",
                providerFilter === p.slug
                  ? "text-white border-transparent"
                  : "bg-white text-gray-700 border-gray-300 hover:border-gray-500"
              )}
              style={providerFilter === p.slug ? { backgroundColor: p.color, borderColor: p.color } : undefined}
            >
              <span>{p.logo_emoji}</span>
              {p.provider}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
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
            <tbody className="divide-y divide-gray-100">
              {filtered.map((plan, i) => (
                <tr key={`${plan.providerSlug}-${plan.name}-${i}`} className="hover:bg-gray-50 transition-colors">
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
                  <td className="px-4 py-3 text-gray-600 max-w-[200px]">
                    <span className="text-xs leading-relaxed">{plan.model_access ?? "—"}</span>
                  </td>

                  {/* Usage Limits */}
                  <td className="px-4 py-3 text-gray-600 max-w-[180px]">
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
        <span key={i} className="rounded-md bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 whitespace-nowrap">
          {f}
        </span>
      ))}
      {overflow > 0 && (
        <span className="text-xs text-gray-400 ml-0.5">+{overflow}</span>
      )}
    </div>
  );
}