import { getSubscriptions } from "@/lib/data";
import SubscriptionsTable from "@/components/SubscriptionsTable";

export default function SubscriptionsPage() {
  const { providers } = getSubscriptions();

  const totalPlans = providers.reduce((sum, p) => sum + p.plans.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Subscription Plans</h1>
        <p className="mt-1 text-gray-500">
          Compare {totalPlans} consumer, team, and enterprise plans across {providers.length} AI providers.
          Click any <span className="font-medium text-gray-700">Provider</span> name to see the full plan breakdown and price history.
        </p>
      </div>
      <SubscriptionsTable providers={providers} />
      <p className="text-xs text-gray-400">
        Prices in USD/month. Annual billing discounts shown where available.
        Data is manually maintained — please open a PR to suggest corrections.
      </p>
    </div>
  );
}
