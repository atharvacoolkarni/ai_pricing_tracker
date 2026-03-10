/**
 * validate_data.ts — run with `npx tsx scripts/validate_data.ts`
 * Validates both data files against Zod schemas.
 */
import { readFileSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";
import { SubscriptionsFileSchema, ApiPricingFileSchema } from "../src/lib/types";

const ROOT = join(__dirname, "..");
let errors = 0;

function validate(label: string, schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: unknown[] } } }, data: unknown) {
  const result = schema.safeParse(data);
  if (result.success) {
    console.log(`✅ ${label} is valid`);
  } else {
    console.error(`❌ ${label} has errors:`);
    console.error(JSON.stringify(result.error?.issues, null, 2));
    errors++;
  }
}

// Validate subscriptions.yml
const subRaw = readFileSync(join(ROOT, "data", "subscriptions.yml"), "utf-8");
const subData = yaml.load(subRaw);
validate("data/subscriptions.yml", SubscriptionsFileSchema, subData);

// Validate api_pricing.json
const apiRaw = readFileSync(join(ROOT, "data", "api_pricing.json"), "utf-8");
const apiData = JSON.parse(apiRaw);
validate("data/api_pricing.json", ApiPricingFileSchema, apiData);

if (errors > 0) {
  console.error(`\n${errors} file(s) failed validation.`);
  process.exit(1);
} else {
  console.log("\nAll data files are valid! ✨");
}
