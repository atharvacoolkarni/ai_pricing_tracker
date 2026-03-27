import { Suspense } from "react";
import { getApiPricing } from "@/lib/data";
import ApiPricingTable from "@/components/ApiPricingTable";

function ApiPricingContent() {
  const { models, fetched_at, data_source } = getApiPricing();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">API Token Pricing</h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          Compare {models.length} models by input/output cost per 1M tokens. Use the cost calculator to estimate your monthly spend.
        </p>
      </div>
      <ApiPricingTable models={models} dataSource={data_source} fetchedAt={fetched_at} />
      <p className="text-xs text-gray-400 dark:text-gray-500">
        Prices in USD per 1M tokens. Prices may not be 100% accurate — always verify with the provider.
      </p>
    </div>
  );
}

export default function ApiPricingPage() {
  return (
    <Suspense fallback={<div className="text-gray-500 dark:text-gray-400">Loading...</div>}>
      <ApiPricingContent />
    </Suspense>
  );
}
