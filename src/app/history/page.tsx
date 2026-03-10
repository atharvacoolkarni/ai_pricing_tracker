import { getPriceHistory } from "@/lib/data";
import PriceHistoryTable from "@/components/PriceHistoryTable";

export default function HistoryPage() {
  const changes = getPriceHistory();

  const priceDrops = changes.filter((c) => (c.change_pct ?? 0) < 0).length;
  const priceIncreases = changes.filter((c) => (c.change_pct ?? 0) > 0).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Price History</h1>
        <p className="mt-1 text-gray-500">
          All recorded AI pricing changes, detected automatically by the daily pipeline.
        </p>
      </div>

      {changes.length > 0 && (
        <div className="flex gap-4">
          <div className="rounded-xl bg-green-50 border border-green-200 px-5 py-3">
            <div className="text-2xl font-bold text-green-700">{priceDrops}</div>
            <div className="text-sm text-green-600">Price drops 🟢</div>
          </div>
          <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-3">
            <div className="text-2xl font-bold text-red-700">{priceIncreases}</div>
            <div className="text-sm text-red-600">Price increases 🔴</div>
          </div>
          <div className="rounded-xl bg-gray-50 border border-gray-200 px-5 py-3">
            <div className="text-2xl font-bold text-gray-700">{changes.length}</div>
            <div className="text-sm text-gray-500">Total changes</div>
          </div>
        </div>
      )}

      <PriceHistoryTable changes={changes} />

      <p className="text-xs text-gray-400">
        Changes ≥ 0.5% are automatically flagged. API pricing is polled daily via GitHub Actions.
        Subscription plan changes are logged manually via Pull Requests.
      </p>
    </div>
  );
}
