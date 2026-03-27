"use client";

import { useState, useMemo } from "react";
import type { PriceChange } from "@/lib/types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";

interface Props {
  changes: PriceChange[];
}

type ChartType = "api" | "subscription";

// Provider colors for consistent visualization
const PROVIDER_COLORS: Record<string, string> = {
  OpenAI: "#10a37f",
  Anthropic: "#d4a574",
  Google: "#4285f4",
  Meta: "#0668e1",
  Mistral: "#ff7000",
  Cohere: "#39594d",
  AWS: "#ff9900",
  Azure: "#0078d4",
  "Together AI": "#6366f1",
  Perplexity: "#20b8cd",
  xAI: "#1d1d1f",
};

const DEFAULT_COLORS = [
  "#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#00C49F",
  "#FFBB28", "#FF8042", "#a855f7", "#ec4899", "#06b6d4",
];

function getProviderColor(provider: string, index: number): string {
  return PROVIDER_COLORS[provider] || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
}

interface ChartDataPoint {
  date: string;
  displayDate: string;
  [key: string]: string | number | null;
}

export default function PriceHistoryChart({ changes }: Props) {
  const [chartType, setChartType] = useState<ChartType>("api");
  const [selectedProvider, setSelectedProvider] = useState<string>("all");

  // Get unique providers from changes
  const providers = useMemo(() => {
    const providerSet = new Set(changes.map((c) => c.provider));
    return Array.from(providerSet).sort();
  }, [changes]);

  // Filter changes by type and provider
  const filteredChanges = useMemo(() => {
    return changes.filter((c) => {
      const typeMatch = c.type === chartType;
      const providerMatch = selectedProvider === "all" || c.provider === selectedProvider;
      return typeMatch && providerMatch;
    });
  }, [changes, chartType, selectedProvider]);

  // Transform data for chart - group by date and model/plan
  const chartData = useMemo(() => {
    if (filteredChanges.length === 0) return [];

    // Group changes by date
    const dateMap = new Map<string, ChartDataPoint>();

    // Sort changes by date
    const sorted = [...filteredChanges].sort((a, b) => a.date.localeCompare(b.date));

    sorted.forEach((change) => {
      const dateKey = change.date;
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, {
          date: dateKey,
          displayDate: formatChartDate(dateKey),
        });
      }

      const point = dateMap.get(dateKey)!;
      const modelKey = `${change.provider} - ${change.model_or_plan}`;
      
      // For API pricing, we might have input/output price changes
      if (change.field.includes("input")) {
        point[`${modelKey} (input)`] = change.new_value;
      } else if (change.field.includes("output")) {
        point[`${modelKey} (output)`] = change.new_value;
      } else {
        point[modelKey] = change.new_value;
      }
    });

    return Array.from(dateMap.values());
  }, [filteredChanges]);

  // Get unique series keys for the chart
  const seriesKeys = useMemo(() => {
    const keys = new Set<string>();
    chartData.forEach((point) => {
      Object.keys(point).forEach((key) => {
        if (key !== "date" && key !== "displayDate") {
          keys.add(key);
        }
      });
    });
    return Array.from(keys);
  }, [chartData]);

  // Get provider from series key for color mapping
  const getProviderFromKey = (key: string): string => {
    const provider = key.split(" - ")[0];
    return provider;
  };

  if (changes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 py-12 text-center">
        <div className="mx-auto max-w-md">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-lg font-medium text-gray-600 dark:text-gray-300">No price history data yet</p>
          <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">
            Charts will appear here once price changes are detected by the daily pipeline.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Chart type toggle */}
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 p-1 bg-gray-50 dark:bg-gray-800">
          <button
            onClick={() => setChartType("api")}
            className={cn(
              "px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
              chartType === "api"
                ? "bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-400 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            API Pricing
          </button>
          <button
            onClick={() => setChartType("subscription")}
            className={cn(
              "px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
              chartType === "subscription"
                ? "bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-400 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            Subscriptions
          </button>
        </div>

        {/* Provider filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 dark:text-gray-400">Provider:</label>
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100"
          >
            <option value="all">All Providers</option>
            {providers.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Chart */}
      {filteredChanges.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 py-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            No {chartType === "api" ? "API pricing" : "subscription"} changes
            {selectedProvider !== "all" ? ` for ${selectedProvider}` : ""}.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <h3 className="mb-4 text-sm font-medium text-gray-700 dark:text-gray-300">
            {chartType === "api" ? "API Price Trends" : "Subscription Price Trends"}
            {selectedProvider !== "all" ? ` - ${selectedProvider}` : ""}
          </h3>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" className="dark:opacity-30" />
                <XAxis
                  dataKey="displayDate"
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                  tickLine={{ stroke: "#374151" }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                  tickLine={{ stroke: "#374151" }}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--background)",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value, name) => {
                    const numValue = typeof value === "number" ? value : 0;
                    return [`$${numValue.toFixed(4)}`, name];
                  }}
                  labelStyle={{ fontWeight: "bold", marginBottom: "4px" }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "12px", paddingTop: "16px" }}
                />
                {seriesKeys.map((key, index) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={getProviderColor(getProviderFromKey(key), index)}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Summary stats */}
      {filteredChanges.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Total Changes"
            value={filteredChanges.length}
            color="gray"
          />
          <StatCard
            label="Price Drops"
            value={filteredChanges.filter((c) => (c.change_pct ?? 0) < 0).length}
            color="green"
            icon="↓"
          />
          <StatCard
            label="Price Increases"
            value={filteredChanges.filter((c) => (c.change_pct ?? 0) > 0).length}
            color="red"
            icon="↑"
          />
          <StatCard
            label="Models/Plans"
            value={new Set(filteredChanges.map((c) => c.model_or_plan)).size}
            color="blue"
          />
        </div>
      )}
    </div>
  );
}

function formatChartDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

interface StatCardProps {
  label: string;
  value: number;
  color: "gray" | "green" | "red" | "blue";
  icon?: string;
}

function StatCard({ label, value, color, icon }: StatCardProps) {
  const colorClasses = {
    gray: "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300",
    green: "bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 text-green-700 dark:text-green-400",
    red: "bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700 text-red-700 dark:text-red-400",
    blue: "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-400",
  };

  return (
    <div className={cn("rounded-lg border px-4 py-3", colorClasses[color])}>
      <div className="flex items-center gap-1">
        {icon && <span className="text-lg">{icon}</span>}
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <div className="text-xs opacity-75">{label}</div>
    </div>
  );
}
