import { getPriceHistory } from "@/lib/data";
import PriceHistoryTable from "@/components/PriceHistoryTable";
import PriceHistoryChart from "@/components/PriceHistoryChart";

export default function HistoryPage() {
  const changes = getPriceHistory();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Price History</h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          All recorded AI pricing changes, detected automatically by the daily pipeline.
        </p>
      </div>

      {/* Price Trends Charts */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">📈 Price Trends</h2>
        <PriceHistoryChart changes={changes} />
      </section>

      {/* Detailed History Table */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">📋 Change Log</h2>
        <PriceHistoryTable changes={changes} />
      </section>

      <p className="text-xs text-gray-400 dark:text-gray-500">
        Changes ≥ 0.5% are automatically flagged. API pricing is polled daily via GitHub Actions.
        Subscription plan changes are logged manually via Pull Requests.
      </p>
    </div>
  );
}
