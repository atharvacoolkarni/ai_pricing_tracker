import { getSubscriptions, getApiPricing, getPriceHistory } from "@/lib/data";
import Link from "next/link";
import { CreditCard, BarChart2, History, ArrowRight, TrendingDown } from "lucide-react";

export default function HomePage() {
  const subs = getSubscriptions();
  const api = getApiPricing();
  const history = getPriceHistory();

  const totalPlans = subs.providers.reduce((acc, p) => acc + p.plans.length, 0);
  const totalModels = api.models.length;
  const totalProviders = subs.providers.length;

  const cheapestModel = [...api.models]
    .filter((m) => !m.is_free && m.input_price_per_1m !== null && m.input_price_per_1m! > 0)
    .sort((a, b) => (a.input_price_per_1m ?? Infinity) - (b.input_price_per_1m ?? Infinity))[0];

  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="text-center space-y-4 py-8">
        <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl">
          💡 AI Pricing Tracker
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-gray-600">
          One place to compare subscription plans and API token costs across all major AI providers.
          Updated daily — never overpay again.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link
            href="/subscriptions"
            className="flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 transition-colors"
          >
            <CreditCard className="h-4 w-4" /> Compare Subscriptions
          </Link>
          <Link
            href="/api-pricing"
            className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <BarChart2 className="h-4 w-4" /> Browse API Pricing
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Providers tracked", value: totalProviders, emoji: "🏢" },
          { label: "Subscription plans", value: totalPlans, emoji: "📋" },
          { label: "API models", value: totalModels, emoji: "🤖" },
          { label: "Price changes logged", value: history.length, emoji: "📈" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-white border border-gray-200 p-5 text-center">
            <div className="text-3xl mb-1">{s.emoji}</div>
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-sm text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Link href="/subscriptions" className="group rounded-xl bg-white border border-gray-200 p-6 hover:border-gray-400 hover:shadow-sm transition-all">
          <CreditCard className="h-8 w-8 text-purple-600 mb-3" />
          <h2 className="text-lg font-semibold text-gray-900">Subscription Plans</h2>
          <p className="mt-1 text-sm text-gray-500">
            Compare Free, Plus, Pro, and Enterprise tiers from {totalProviders} AI providers. Filter by price, features, and rate limits.
          </p>
          <div className="mt-3 flex items-center gap-1 text-sm font-medium text-purple-600 group-hover:gap-2 transition-all">
            View plans <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </Link>

        <Link href="/api-pricing" className="group rounded-xl bg-white border border-gray-200 p-6 hover:border-gray-400 hover:shadow-sm transition-all">
          <BarChart2 className="h-8 w-8 text-blue-600 mb-3" />
          <h2 className="text-lg font-semibold text-gray-900">API Token Pricing</h2>
          <p className="mt-1 text-sm text-gray-500">
            Sort and filter {totalModels} models by input/output cost per 1M tokens. Built-in cost calculator for your usage.
          </p>
          <div className="mt-3 flex items-center gap-1 text-sm font-medium text-blue-600 group-hover:gap-2 transition-all">
            Browse models <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </Link>

        <Link href="/history" className="group rounded-xl bg-white border border-gray-200 p-6 hover:border-gray-400 hover:shadow-sm transition-all">
          <History className="h-8 w-8 text-green-600 mb-3" />
          <h2 className="text-lg font-semibold text-gray-900">Price History</h2>
          <p className="mt-1 text-sm text-gray-500">
            Track how AI pricing has changed over time. {history.length > 0 ? `${history.length} changes logged so far.` : "New changes logged daily."}
          </p>
          <div className="mt-3 flex items-center gap-1 text-sm font-medium text-green-600 group-hover:gap-2 transition-all">
            View history <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </Link>
      </div>

      {/* Highlights */}
      <div className="grid sm:grid-cols-2 gap-6">
        {cheapestModel && (
          <div className="rounded-xl bg-green-50 border border-green-200 p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-green-600" />
              <span className="text-sm font-semibold text-green-700">Cheapest API Model (Input)</span>
            </div>
            <div className="text-xl font-bold text-gray-900">{cheapestModel.name}</div>
            <div className="text-sm text-gray-600">{cheapestModel.provider}</div>
            <div className="mt-1 text-2xl font-bold text-green-700">
              ${cheapestModel.input_price_per_1m}/1M tokens
            </div>
          </div>
        )}

        <div className="rounded-xl bg-blue-50 border border-blue-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-blue-700">🆓 Free Plans Available</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {subs.providers
              .filter((p) => p.plans.some((pl) => pl.is_free))
              .map((p) => (
                <span key={p.slug} className="inline-flex items-center gap-1 rounded-full bg-white border border-blue-200 px-3 py-1 text-sm font-medium text-gray-700">
                  {p.logo_emoji} {p.provider}
                </span>
              ))}
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-gray-400">
        Subscription data last updated: {subs.providers[0]?.last_updated ?? "—"} &nbsp;·&nbsp;
        API pricing fetched: {new Date(api.fetched_at).toLocaleDateString()}
      </p>
    </div>
  );
}
