"use client";

import { useEffect } from "react";
import type { ProviderSubscription, Plan } from "@/lib/types";
import { cn } from "@/lib/utils";
import { X, ExternalLink, Check } from "lucide-react";

interface Props {
  provider: ProviderSubscription | null;
  onClose: () => void;
}

const TIER_BADGE: Record<string, string> = {
  consumer: "bg-blue-100 text-blue-700",
  team: "bg-violet-100 text-violet-700",
  enterprise: "bg-amber-100 text-amber-700",
};

const TIER_LABELS: Record<string, string> = {
  consumer: "Consumer",
  team: "Team",
  enterprise: "Enterprise",
};

export default function ProviderDrawer({ provider, onClose }: Props) {
  // Close on Escape key
  useEffect(() => {
    if (!provider) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [provider, onClose]);

  // Prevent body + html scroll when open
  useEffect(() => {
    if (provider) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [provider]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-300",
          provider ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal
        aria-label={provider ? `${provider.provider} plan details` : undefined}
        className={cn(
          "fixed top-0 bottom-0 right-0 z-50 flex flex-col w-full max-w-2xl h-full bg-white shadow-2xl",
          "transition-transform duration-300 ease-in-out",
          provider ? "translate-x-0" : "translate-x-full"
        )}
      >
        {provider && (
          <>
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-5 border-b border-gray-100"
              style={{ borderLeft: `4px solid ${provider.color ?? "#6b7280"}` }}
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{provider.logo_emoji}</span>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{provider.provider}</h2>
                  <p className="text-sm text-gray-500">{provider.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={provider.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
                >
                  Pricing page <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <button
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-8">
              {/* Plans section */}
              <section>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                  All Plans ({provider.plans.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {provider.plans.map((plan) => (
                    <PlanCard
                      key={plan.name}
                      plan={plan}
                      color={provider.color ?? "#6b7280"}
                    />
                  ))}
                </div>
              </section>

              {/* Price History section */}
              {provider.history && provider.history.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                    Price History
                  </h3>
                  <ol className="relative border-l border-gray-200 space-y-6 ml-3">
                    {provider.history.map((item, i) => (
                      <li key={i} className="ml-4">
                        <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-gray-400" />
                        <time className="text-xs font-medium text-gray-400 uppercase tracking-wide">{item.date}</time>
                        <p className="mt-0.5 text-sm text-gray-700">{item.event}</p>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-100 text-xs text-gray-400 flex items-center justify-between">
              <span>Last updated: {provider.last_updated}</span>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-900 transition-colors underline"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function PlanCard({ plan, color }: { plan: Plan; color: string }) {
  return (
    <div className={cn(
      "rounded-xl border p-4 flex flex-col gap-3 relative overflow-hidden",
      plan.highlighted ? "border-blue-300 bg-blue-50/50" : "border-gray-200 bg-white"
    )}>
      {plan.highlighted && (
        <div className="absolute top-0 right-0 rounded-bl-lg bg-blue-600 text-white text-xs font-semibold px-2 py-0.5">
          Popular
        </div>
      )}

      {/* Plan name + tier */}
      <div className="flex items-start justify-between gap-2 pr-12">
        <div>
          <span className="font-semibold text-gray-900">{plan.name}</span>
          {plan.per_seat && (
            <span className="ml-1 text-xs text-gray-400">/seat</span>
          )}
        </div>
        <span className={cn(
          "rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0",
          TIER_BADGE[plan.tier ?? "consumer"] ?? "bg-gray-100 text-gray-600"
        )}>
          {TIER_LABELS[plan.tier ?? "consumer"] ?? plan.tier}
        </span>
      </div>

      {/* Price */}
      <div>
        {plan.is_free ? (
          <span className="text-2xl font-bold text-green-600">Free</span>
        ) : plan.price_monthly === null ? (
          <span className="text-base font-semibold text-gray-400">Contact sales</span>
        ) : (
          <>
            <span className="text-2xl font-bold text-gray-900">${plan.price_monthly}</span>
            <span className="text-sm text-gray-400">/mo</span>
            {plan.price_annual_monthly && plan.price_annual_monthly < plan.price_monthly && (
              <div className="text-xs text-green-600 font-medium mt-0.5">
                ${plan.price_annual_monthly}/mo billed annually
              </div>
            )}
          </>
        )}
      </div>

      {/* Model Access & Limits */}
      {(plan.model_access || plan.usage_limits) && (
        <div className="space-y-1 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
          {plan.model_access && (
            <div><span className="font-medium text-gray-500">Models: </span>{plan.model_access}</div>
          )}
          {plan.usage_limits && (
            <div><span className="font-medium text-gray-500">Limits: </span>{plan.usage_limits}</div>
          )}
        </div>
      )}

      {/* Features */}
      {plan.key_features.length > 0 && (
        <ul className="space-y-1 flex-1">
          {plan.key_features.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
              <Check className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
              {f}
            </li>
          ))}
        </ul>
      )}

      {/* Best for / Notes */}
      {plan.best_for && (
        <div className="text-xs text-gray-400 pt-1 border-t border-gray-100">
          Best for: {plan.best_for}
        </div>
      )}
      {plan.notes && (
        <div className="text-xs text-amber-600 italic">{plan.notes}</div>
      )}
    </div>
  );
}
