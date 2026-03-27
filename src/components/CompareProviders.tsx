"use client";

import { useState, useMemo } from "react";
import type { ProviderSubscription, Plan } from "@/lib/types";
import { cn } from "@/lib/utils";
import { X, Check, Minus, ArrowLeftRight } from "lucide-react";

interface Props {
  providers: ProviderSubscription[];
  onClose: () => void;
}

const MAX_COMPARE = 3;

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

// Comparison row labels and extractors
interface ComparisonRow {
  label: string;
  getValue: (plan: Plan) => React.ReactNode;
  highlight?: boolean;
}

function getComparisonRows(): ComparisonRow[] {
  return [
    {
      label: "Price/month",
      highlight: true,
      getValue: (plan) => {
        if (plan.is_free) return <span className="font-semibold text-green-600 dark:text-green-400">Free</span>;
        if (plan.price_monthly === null) return <span className="text-gray-400 dark:text-gray-500 text-sm">Contact sales</span>;
        return (
          <div>
            <span className="font-semibold text-gray-900 dark:text-gray-100">${plan.price_monthly}</span>
            {plan.per_seat && <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">/seat</span>}
            {plan.price_annual_monthly && plan.price_annual_monthly < (plan.price_monthly ?? Infinity) && (
              <div className="text-xs text-green-600 dark:text-green-400">${plan.price_annual_monthly} annual</div>
            )}
          </div>
        );
      },
    },
    {
      label: "Tier",
      getValue: (plan) => (
        <span className={cn(
          "rounded-full px-2 py-0.5 text-xs font-medium",
          TIER_BADGE[plan.tier ?? "consumer"]
        )}>
          {TIER_LABELS[plan.tier ?? "consumer"]}
        </span>
      ),
    },
    {
      label: "Model Access",
      getValue: (plan) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">{plan.model_access ?? "—"}</span>
      ),
    },
    {
      label: "Usage Limits",
      getValue: (plan) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">{plan.usage_limits ?? "—"}</span>
      ),
    },
    {
      label: "Best For",
      getValue: (plan) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">{plan.best_for ?? "—"}</span>
      ),
    },
    {
      label: "Key Features",
      getValue: (plan) => (
        <div className="flex flex-wrap gap-1">
          {plan.key_features.length > 0 ? (
            plan.key_features.map((f, i) => (
              <span key={i} className="rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs px-1.5 py-0.5">
                {f}
              </span>
            ))
          ) : (
            <span className="text-gray-400 dark:text-gray-500">—</span>
          )}
        </div>
      ),
    },
  ];
}

// Extract all unique features from selected providers' plans
function extractFeatureMatrix(
  selectedProviders: ProviderSubscription[]
): { feature: string; planHasFeature: Map<string, boolean> }[] {
  const allFeatures = new Set<string>();
  const planFeatureMap = new Map<string, Set<string>>();

  selectedProviders.forEach((provider) => {
    provider.plans.forEach((plan) => {
      const planKey = `${provider.slug}-${plan.name}`;
      const features = new Set(plan.key_features);
      planFeatureMap.set(planKey, features);
      plan.key_features.forEach((f) => allFeatures.add(f));
    });
  });

  return Array.from(allFeatures)
    .sort()
    .map((feature) => {
      const planHasFeature = new Map<string, boolean>();
      selectedProviders.forEach((provider) => {
        provider.plans.forEach((plan) => {
          const planKey = `${provider.slug}-${plan.name}`;
          const features = planFeatureMap.get(planKey) ?? new Set();
          planHasFeature.set(planKey, features.has(feature));
        });
      });
      return { feature, planHasFeature };
    });
}

// Get price difference indicator
function getPriceDiff(
  prices: (number | null)[],
  currentIdx: number
): { diff: "lowest" | "highest" | "middle" | "equal" | "na" } {
  const validPrices = prices.filter((p): p is number => p !== null && p !== 0);
  if (validPrices.length <= 1) return { diff: "equal" };
  
  const current = prices[currentIdx];
  if (current === null || current === 0) return { diff: "na" };
  
  const min = Math.min(...validPrices);
  const max = Math.max(...validPrices);
  
  if (min === max) return { diff: "equal" };
  if (current === min) return { diff: "lowest" };
  if (current === max) return { diff: "highest" };
  return { diff: "middle" };
}

export default function CompareProviders({ providers, onClose }: Props) {
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [selectedPlanTier, setSelectedPlanTier] = useState<string>("all");

  const selectedProviders = useMemo(
    () => providers.filter((p) => selectedSlugs.includes(p.slug)),
    [providers, selectedSlugs]
  );

  // Filter plans by tier
  const filteredProviders = useMemo(() => {
    if (selectedPlanTier === "all") return selectedProviders;
    return selectedProviders.map((provider) => ({
      ...provider,
      plans: provider.plans.filter((p) => p.tier === selectedPlanTier),
    }));
  }, [selectedProviders, selectedPlanTier]);

  const comparisonRows = getComparisonRows();

  function toggleProvider(slug: string) {
    setSelectedSlugs((prev) => {
      if (prev.includes(slug)) {
        return prev.filter((s) => s !== slug);
      }
      if (prev.length >= MAX_COMPARE) {
        return prev; // Don't add more than max
      }
      return [...prev, slug];
    });
  }

  // Get all plans across selected providers for comparison
  const allPlansFlat = filteredProviders.flatMap((provider) =>
    provider.plans.map((plan) => ({
      provider,
      plan,
      key: `${provider.slug}-${plan.name}`,
    }))
  );

  // Get prices for highlighting
  const prices = allPlansFlat.map((p) => p.plan.price_monthly);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-6xl mx-4 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <ArrowLeftRight className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Compare Providers</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Select 2-3 providers to compare side by side</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Provider Selection */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mr-1">
              Select Providers ({selectedSlugs.length}/{MAX_COMPARE})
            </span>
            {providers.map((p) => {
              const isSelected = selectedSlugs.includes(p.slug);
              const isDisabled = !isSelected && selectedSlugs.length >= MAX_COMPARE;
              return (
                <button
                  key={p.slug}
                  onClick={() => !isDisabled && toggleProvider(p.slug)}
                  disabled={isDisabled}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm font-medium border transition-colors flex items-center gap-1.5",
                    isSelected
                      ? "text-white border-transparent"
                      : isDisabled
                      ? "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600 cursor-not-allowed"
                      : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-gray-500 dark:hover:border-gray-400"
                  )}
                  style={isSelected ? { backgroundColor: p.color, borderColor: p.color } : undefined}
                >
                  <span>{p.logo_emoji}</span>
                  {p.provider}
                  {isSelected && <Check className="h-3 w-3 ml-0.5" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {selectedSlugs.length < 2 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <ArrowLeftRight className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p className="text-lg font-medium text-gray-600 dark:text-gray-300">Select at least 2 providers to compare</p>
              <p className="text-sm mt-1">Click on the provider chips above</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Tier Filter */}
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mr-1">
                  Filter by Tier
                </span>
                {["all", "consumer", "team", "enterprise"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setSelectedPlanTier(t)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                      selectedPlanTier === t
                        ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100"
                        : "bg-white text-gray-600 border-gray-300 hover:border-gray-500 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:border-gray-400"
                    )}
                  >
                    {t === "all" ? "All Plans" : TIER_LABELS[t]}
                  </button>
                ))}
              </div>

              {/* Comparison Table */}
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-40">
                        Feature
                      </th>
                      {allPlansFlat.map(({ provider, plan, key }) => (
                        <th key={key} className="px-4 py-3 text-center min-w-[160px]">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-lg">{provider.logo_emoji}</span>
                            <span
                              className="text-xs font-semibold"
                              style={{ color: provider.color }}
                            >
                              {provider.provider}
                            </span>
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{plan.name}</span>
                            {plan.highlighted && (
                              <span className="rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs px-1.5 py-0.5 font-medium">
                                Popular
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {comparisonRows.map((row) => (
                      <tr
                        key={row.label}
                        className={cn(
                          "hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors",
                          row.highlight && "bg-blue-50/50 dark:bg-blue-900/20"
                        )}
                      >
                        <td className="px-4 py-3 text-left">
                          <span className={cn(
                            "text-sm",
                            row.highlight ? "font-semibold text-gray-900 dark:text-gray-100" : "font-medium text-gray-600 dark:text-gray-400"
                          )}>
                            {row.label}
                          </span>
                        </td>
                        {allPlansFlat.map(({ plan, key }, idx) => {
                          const priceDiff = row.label === "Price/month" ? getPriceDiff(prices, idx) : null;
                          return (
                            <td
                              key={key}
                              className={cn(
                                "px-4 py-3 text-center",
                                priceDiff?.diff === "lowest" && "bg-green-50 dark:bg-green-900/30",
                                priceDiff?.diff === "highest" && "bg-red-50 dark:bg-red-900/30"
                              )}
                            >
                              <div className="flex flex-col items-center">
                                {row.getValue(plan)}
                                {priceDiff?.diff === "lowest" && (
                                  <span className="text-xs text-green-600 dark:text-green-400 font-medium mt-1">Lowest</span>
                                )}
                                {priceDiff?.diff === "highest" && (
                                  <span className="text-xs text-red-600 dark:text-red-400 font-medium mt-1">Highest</span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Feature Matrix */}
              {allPlansFlat.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Feature Comparison Matrix</h3>
                  <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-56">
                            Feature
                          </th>
                          {allPlansFlat.map(({ provider, plan, key }) => (
                            <th key={key} className="px-4 py-3 text-center min-w-[120px]">
                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                <span style={{ color: provider.color }}>{provider.provider}</span>
                                <br />
                                <span className="font-medium text-gray-900 dark:text-gray-100">{plan.name}</span>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {extractFeatureMatrix(filteredProviders).map(({ feature, planHasFeature }) => (
                          <tr key={feature} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            <td className="px-4 py-2.5 text-left">
                              <span className="text-sm text-gray-700 dark:text-gray-300">{feature}</span>
                            </td>
                            {allPlansFlat.map(({ key }) => {
                              const hasFeature = planHasFeature.get(key);
                              return (
                                <td key={key} className="px-4 py-2.5 text-center">
                                  {hasFeature ? (
                                    <Check className="h-4 w-4 text-green-600 dark:text-green-400 mx-auto" />
                                  ) : (
                                    <Minus className="h-4 w-4 text-gray-300 dark:text-gray-600 mx-auto" />
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                        {extractFeatureMatrix(filteredProviders).length === 0 && (
                          <tr>
                            <td colSpan={allPlansFlat.length + 1} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                              No features to compare for selected tier.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Prices in USD/month. Data is manually maintained — please open a PR to suggest corrections.
          </p>
        </div>
      </div>
    </div>
  );
}
