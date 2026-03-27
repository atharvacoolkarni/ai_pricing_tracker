"use client";

import { useState, useMemo } from "react";
import type { ProviderSubscription, Plan } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Calculator, Check } from "lucide-react";

interface Props {
  providers: ProviderSubscription[];
}

interface FlatPlan extends Plan {
  providerName: string;
  providerSlug: string;
  providerEmoji: string;
  providerColor: string;
}

type UseCase = "coding" | "writing" | "research" | "general";

interface Feature {
  id: string;
  label: string;
  keywords: string[];
}

const USE_CASES: { value: UseCase; label: string }[] = [
  { value: "coding", label: "Coding & Development" },
  { value: "writing", label: "Writing & Content" },
  { value: "research", label: "Research & Analysis" },
  { value: "general", label: "General Assistant" },
];

const FEATURES: Feature[] = [
  { id: "advanced_reasoning", label: "Advanced reasoning", keywords: ["thinking", "reasoning", "pro", "opus", "deep"] },
  { id: "code_gen", label: "Code generation", keywords: ["code", "codex", "developer", "coding", "dev"] },
  { id: "image_gen", label: "Image generation", keywords: ["dall-e", "image", "sora", "video", "midjourney", "imagen"] },
  { id: "web_search", label: "Web search", keywords: ["web", "browse", "browsing", "search", "internet"] },
  { id: "plugins", label: "Plugins/Extensions", keywords: ["plugin", "extension", "integration", "api", "tool"] },
  { id: "api_access", label: "API access", keywords: ["api", "developer", "programmatic"] },
];

const USE_CASE_FEATURE_WEIGHTS: Record<UseCase, Record<string, number>> = {
  coding: { code_gen: 2, advanced_reasoning: 1.5, api_access: 1.2, plugins: 1 },
  writing: { advanced_reasoning: 1.5, web_search: 1.2, image_gen: 1 },
  research: { web_search: 2, advanced_reasoning: 1.5, plugins: 1 },
  general: { advanced_reasoning: 1, web_search: 1, image_gen: 0.8 },
};

function planMatchesFeature(plan: FlatPlan, feature: Feature): boolean {
  const searchText = [
    plan.name,
    plan.model_access ?? "",
    plan.usage_limits ?? "",
    ...plan.key_features,
    plan.best_for ?? "",
  ].join(" ").toLowerCase();

  return feature.keywords.some((kw) => searchText.includes(kw.toLowerCase()));
}

function calculatePlanScore(
  plan: FlatPlan,
  messagesPerDay: number,
  useCase: UseCase,
  requiredFeatures: Set<string>,
  maxBudget: number
): { score: number; matchedFeatures: string[]; matchPct: number; reasons: string[] } {
  const price = plan.price_monthly ?? 0;
  const reasons: string[] = [];

  // Filter: plan must be within budget (free plans always pass)
  if (!plan.is_free && price > maxBudget) {
    return { score: -1, matchedFeatures: [], matchPct: 0, reasons: ["Exceeds budget"] };
  }

  // Filter: plan must have all required features
  const matchedFeatures: string[] = [];
  const missingRequired: string[] = [];

  for (const feature of FEATURES) {
    if (planMatchesFeature(plan, feature)) {
      matchedFeatures.push(feature.id);
    } else if (requiredFeatures.has(feature.id)) {
      missingRequired.push(feature.label);
    }
  }

  if (missingRequired.length > 0) {
    return {
      score: -1,
      matchedFeatures,
      matchPct: 0,
      reasons: [`Missing: ${missingRequired.join(", ")}`],
    };
  }

  // Calculate feature score with use-case weighting
  let featureScore = 0;
  const useCaseWeights = USE_CASE_FEATURE_WEIGHTS[useCase];

  for (const fid of matchedFeatures) {
    const weight = useCaseWeights[fid] ?? 0.5;
    featureScore += weight;
  }

  // Bonus for use-case alignment
  const bestFor = (plan.best_for ?? "").toLowerCase();
  if (useCase === "coding" && (bestFor.includes("developer") || bestFor.includes("professional") || bestFor.includes("power"))) {
    featureScore += 1;
    reasons.push("Great for developers");
  }
  if (useCase === "writing" && (bestFor.includes("writer") || bestFor.includes("content") || bestFor.includes("creative"))) {
    featureScore += 1;
    reasons.push("Great for writers");
  }
  if (useCase === "research" && (bestFor.includes("research") || bestFor.includes("analyst"))) {
    featureScore += 1;
    reasons.push("Great for researchers");
  }

  // Usage-based scoring: check if plan limits align with usage
  const usageLimits = (plan.usage_limits ?? "").toLowerCase();
  if (usageLimits.includes("unlimited")) {
    if (messagesPerDay > 50) {
      featureScore += 2;
      reasons.push("Unlimited usage for heavy use");
    } else {
      featureScore += 0.5;
    }
  } else if (messagesPerDay > 100 && !usageLimits.includes("unlimited")) {
    // Heavy user on limited plan - penalize
    featureScore -= 1;
  }

  // Value calculation: features per dollar
  // Free plans get a base "effective price" for comparison
  const effectivePrice = plan.is_free ? 1 : price;
  const valueScore = featureScore / Math.sqrt(effectivePrice);

  // Calculate match percentage based on required + bonus features
  const totalPossibleFeatures = Math.max(requiredFeatures.size, 1) + Object.keys(useCaseWeights).length;
  const matchPct = Math.min(100, Math.round((matchedFeatures.length / totalPossibleFeatures) * 100 + (featureScore * 5)));

  // Pricing reason
  if (plan.is_free) {
    reasons.push("Free tier");
  } else if (price <= 10) {
    reasons.push("Budget-friendly");
  } else if (price <= 25) {
    reasons.push("Mid-range pricing");
  } else if (price <= 50) {
    reasons.push("Premium tier");
  } else {
    reasons.push("Power user pricing");
  }

  return {
    score: valueScore,
    matchedFeatures,
    matchPct: Math.min(99, matchPct), // Cap at 99% - no perfect match
    reasons,
  };
}

export default function BestValueCalculator({ providers }: Props) {
  const [messagesPerDay, setMessagesPerDay] = useState(25);
  const [useCase, setUseCase] = useState<UseCase>("general");
  const [requiredFeatures, setRequiredFeatures] = useState<Set<string>>(new Set());
  const [maxBudget, setMaxBudget] = useState(50);
  const [isExpanded, setIsExpanded] = useState(true);

  const allPlans: FlatPlan[] = useMemo(
    () =>
      providers.flatMap((p) =>
        p.plans.map((plan) => ({
          ...plan,
          providerName: p.provider,
          providerSlug: p.slug,
          providerEmoji: p.logo_emoji,
          providerColor: p.color ?? "#6b7280",
        }))
      ),
    [providers]
  );

  const recommendations = useMemo(() => {
    const scored = allPlans
      .filter((p) => p.tier === "consumer") // Focus on consumer plans
      .map((plan) => {
        const result = calculatePlanScore(plan, messagesPerDay, useCase, requiredFeatures, maxBudget);
        return { plan, ...result };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    return scored;
  }, [allPlans, messagesPerDay, useCase, requiredFeatures, maxBudget]);

  function toggleFeature(featureId: string) {
    setRequiredFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(featureId)) {
        next.delete(featureId);
      } else {
        next.add(featureId);
      }
      return next;
    });
  }

  const rankEmojis = ["🥇", "🥈", "🥉"];

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between bg-white/50 dark:bg-gray-800/50 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">🧮</span>
          <div className="text-left">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Find Your Best AI Plan</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Answer a few questions to get personalized recommendations</p>
          </div>
        </div>
        <Calculator
          className={cn(
            "h-5 w-5 text-gray-400 transition-transform",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      {isExpanded && (
        <div className="p-6 space-y-6">
          {/* Inputs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Messages per day */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                How many messages per day?
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={1}
                  max={200}
                  value={messagesPerDay}
                  onChange={(e) => setMessagesPerDay(Number(e.target.value))}
                  className="flex-1 h-2 rounded-full appearance-none bg-gray-200 dark:bg-gray-700 accent-blue-600"
                />
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={messagesPerDay}
                  onChange={(e) => setMessagesPerDay(Math.max(1, Number(e.target.value)))}
                  className="w-20 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100"
                />
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {messagesPerDay <= 10
                  ? "Light user"
                  : messagesPerDay <= 50
                  ? "Moderate user"
                  : messagesPerDay <= 100
                  ? "Heavy user"
                  : "Power user"}
              </p>
            </div>

            {/* Primary use case */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Primary use case?
              </label>
              <select
                value={useCase}
                onChange={(e) => setUseCase(e.target.value as UseCase)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100"
              >
                {USE_CASES.map((uc) => (
                  <option key={uc.value} value={uc.value}>
                    {uc.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Max budget */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Maximum budget?
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={0}
                  max={200}
                  step={5}
                  value={maxBudget}
                  onChange={(e) => setMaxBudget(Number(e.target.value))}
                  className="flex-1 h-2 rounded-full appearance-none bg-gray-200 dark:bg-gray-700 accent-blue-600"
                />
                <div className="flex items-center gap-1">
                  <span className="text-gray-500 dark:text-gray-400">$</span>
                  <input
                    type="number"
                    min={0}
                    max={500}
                    value={maxBudget}
                    onChange={(e) => setMaxBudget(Math.max(0, Number(e.target.value)))}
                    className="w-16 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100"
                  />
                  <span className="text-gray-500 dark:text-gray-400 text-sm">/mo</span>
                </div>
              </div>
            </div>

            {/* Required features */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Required features?
              </label>
              <div className="flex flex-wrap gap-2">
                {FEATURES.map((feature) => (
                  <button
                    key={feature.id}
                    onClick={() => toggleFeature(feature.id)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium border transition-all",
                      requiredFeatures.has(feature.id)
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-400"
                    )}
                  >
                    {requiredFeatures.has(feature.id) ? "✓ " : ""}
                    {feature.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 dark:border-gray-700" />

          {/* Recommendations */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Recommendations
            </h3>

            {recommendations.length === 0 ? (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 p-4 text-sm text-amber-800 dark:text-amber-300">
                <p className="font-medium">No plans match your criteria</p>
                <p className="mt-1 text-amber-600 dark:text-amber-400">
                  Try increasing your budget or removing some required features.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {recommendations.map((rec, idx) => (
                  <div
                    key={`${rec.plan.providerSlug}-${rec.plan.name}`}
                    className={cn(
                      "rounded-xl border p-4 space-y-3 transition-shadow hover:shadow-md",
                      idx === 0
                        ? "bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/30 border-amber-200 dark:border-amber-700"
                        : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                    )}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{rankEmojis[idx]}</span>
                        <span className="text-lg">{rec.plan.providerEmoji}</span>
                      </div>
                      <div
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-bold",
                          idx === 0
                            ? "bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                        )}
                      >
                        {rec.matchPct}% match
                      </div>
                    </div>

                    {/* Plan info */}
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                        {rec.plan.providerName} {rec.plan.name}
                      </h4>
                      <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        {rec.plan.is_free ? (
                          <span className="text-green-600 dark:text-green-400">Free</span>
                        ) : (
                          <>
                            ${rec.plan.price_monthly}
                            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">/mo</span>
                          </>
                        )}
                      </p>
                    </div>

                    {/* Matched features */}
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Why this plan?
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {rec.matchedFeatures.slice(0, 4).map((fid) => {
                          const feature = FEATURES.find((f) => f.id === fid);
                          return feature ? (
                            <span
                              key={fid}
                              className="inline-flex items-center gap-1 rounded-md bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs px-1.5 py-0.5"
                            >
                              <Check className="h-3 w-3" />
                              {feature.label}
                            </span>
                          ) : null;
                        })}
                      </div>
                      {rec.reasons.length > 0 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {rec.reasons.slice(0, 2).join(" • ")}
                        </p>
                      )}
                    </div>

                    {/* Key features preview */}
                    {rec.plan.key_features.length > 0 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700">
                        {rec.plan.key_features.slice(0, 3).join(", ")}
                        {rec.plan.key_features.length > 3 && (
                          <span className="text-gray-400 dark:text-gray-500">
                            {" "}+{rec.plan.key_features.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Comparison note */}
            {recommendations.length > 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                Match percentages are based on your specified requirements and use case.
                Scroll down to compare all plans in detail.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
