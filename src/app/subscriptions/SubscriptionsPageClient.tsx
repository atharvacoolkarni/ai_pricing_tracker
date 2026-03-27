"use client";

import { Suspense, useState } from "react";
import type { ProviderSubscription } from "@/lib/types";
import SubscriptionsTable from "@/components/SubscriptionsTable";
import CompareProviders from "@/components/CompareProviders";
import BestValueCalculator from "@/components/BestValueCalculator";
import { ArrowLeftRight } from "lucide-react";

interface Props {
  providers: ProviderSubscription[];
}

export default function SubscriptionsPageClient({ providers }: Props) {
  const [compareOpen, setCompareOpen] = useState(false);

  const totalPlans = providers.reduce((sum, p) => sum + p.plans.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Subscription Plans</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Compare {totalPlans} consumer, team, and enterprise plans across {providers.length} AI providers.
            Click any <span className="font-medium text-gray-700 dark:text-gray-300">Provider</span> name to see the full plan breakdown and price history.
          </p>
        </div>
        <button
          onClick={() => setCompareOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-gray-900 dark:bg-gray-100 px-4 py-2 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors shadow-sm whitespace-nowrap"
        >
          <ArrowLeftRight className="h-4 w-4" />
          Compare Providers
        </button>
      </div>
      <Suspense fallback={<div className="text-gray-500 dark:text-gray-400">Loading...</div>}>
        <BestValueCalculator providers={providers} />
        <SubscriptionsTable providers={providers} />
      </Suspense>
      <p className="text-xs text-gray-400 dark:text-gray-500">
        Prices in USD/month. Annual billing discounts shown where available.
        Data is manually maintained — please open a PR to suggest corrections.
      </p>

      {compareOpen && (
        <CompareProviders providers={providers} onClose={() => setCompareOpen(false)} />
      )}
    </div>
  );
}
