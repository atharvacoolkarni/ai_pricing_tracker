import { readFileSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";
import type { SubscriptionsFile, ApiPricingFile, PriceChange } from "./types";

const DATA_DIR = join(process.cwd(), "data");

export function getSubscriptions(): SubscriptionsFile {
  const raw = readFileSync(join(DATA_DIR, "subscriptions.yml"), "utf-8");
  return yaml.load(raw) as SubscriptionsFile;
}

export function getApiPricing(): ApiPricingFile {
  const raw = readFileSync(join(DATA_DIR, "api_pricing.json"), "utf-8");
  return JSON.parse(raw) as ApiPricingFile;
}

export function getPriceHistory(): PriceChange[] {
  try {
    const raw = readFileSync(join(DATA_DIR, "history", "changes.json"), "utf-8");
    return JSON.parse(raw) as PriceChange[];
  } catch {
    return [];
  }
}
