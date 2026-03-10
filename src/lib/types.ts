import { z } from "zod";

// ─── Consumer Subscription Plans ─────────────────────────────────────────────

export const PlanSchema = z.object({
  name: z.string(),
  price_monthly: z.number().nullable(), // null = contact sales
  price_annual_monthly: z.number().nullable().optional(),
  billing_period: z.string().default("month"),
  tier: z.enum(["consumer", "team", "enterprise"]).default("consumer"),
  is_free: z.boolean().default(false),
  highlighted: z.boolean().default(false),
  model_access: z.string().optional(),
  usage_limits: z.string().optional(),
  key_features: z.array(z.string()).default([]),
  best_for: z.string().optional(),
  per_seat: z.boolean().default(false),
  min_seats: z.number().optional(),
  notes: z.string().optional(),
});

export const ProviderHistorySchema = z.object({
  date: z.string(),
  event: z.string(),
});

export const ProviderSubscriptionSchema = z.object({
  id: z.string(),
  provider: z.string(),
  slug: z.string(),
  website: z.string().url(),
  logo_emoji: z.string(),
  color: z.string().optional(),
  description: z.string(),
  last_updated: z.string(),
  plans: z.array(PlanSchema),
  history: z.array(ProviderHistorySchema).default([]),
});

export const SubscriptionsFileSchema = z.object({
  version: z.string(),
  last_updated: z.string().optional(),
  providers: z.array(ProviderSubscriptionSchema),
});

export type Plan = z.infer<typeof PlanSchema>;
export type ProviderHistory = z.infer<typeof ProviderHistorySchema>;
export type ProviderSubscription = z.infer<typeof ProviderSubscriptionSchema>;
export type SubscriptionsFile = z.infer<typeof SubscriptionsFileSchema>;

// ─── API Token Pricing ────────────────────────────────────────────────────────

export const ApiModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  provider_slug: z.string(),
  input_price_per_1m: z.number().nullable(),
  output_price_per_1m: z.number().nullable(),
  blended_price_per_1m: z.number().nullable().optional(), // 3:1 output:input blended rate
  context_window_k: z.number().nullable().optional(),
  speed_tok_per_s: z.number().nullable().optional(),     // median output tokens/second
  intelligence_score: z.number().nullable().optional(),  // Artificial Analysis intelligence index
  modality: z.enum(["text", "multimodal", "image", "audio", "code"]).default("text"),
  is_free: z.boolean().default(false),
  source: z.string().optional(),
  last_updated: z.string(),
});

export const ApiPricingFileSchema = z.object({
  version: z.string(),
  fetched_at: z.string(),
  data_source: z.string().optional(), // "artificial-analysis" | "openrouter" | "manual"
  models: z.array(ApiModelSchema),
});

export type ApiModel = z.infer<typeof ApiModelSchema>;
export type ApiPricingFile = z.infer<typeof ApiPricingFileSchema>;

// ─── Price History ────────────────────────────────────────────────────────────

export const PriceChangeSchema = z.object({
  date: z.string(),
  provider: z.string(),
  model_or_plan: z.string(),
  type: z.enum(["subscription", "api"]),
  field: z.string(),
  old_value: z.number().nullable(),
  new_value: z.number().nullable(),
  change_pct: z.number().nullable(),
  source_url: z.string().optional(),
});

export type PriceChange = z.infer<typeof PriceChangeSchema>;
