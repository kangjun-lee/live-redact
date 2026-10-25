import { createGeminiModel } from './gemini'
import type {
  ModelConfig,
  ModelOptionValues,
  ModelPricing,
  PriceTier,
  ProviderConfig,
  ProviderId,
  TokenUsage,
} from './types'
import { createTypesafeModel } from './typesafe'

export type * from './types'

const GEMINI_PRICING_URL = 'https://ai.google.dev/gemini-api/docs/pricing'

export const providers: Record<ProviderId, ProviderConfig> = {
  typesafe: {
    label: 'TypeSafe',
    keyPlaceholder: 'TypeSafe API key',
    keyConsoleUrl: 'https://console.typesafe.ai',
  },
  gemini: {
    label: 'Google Gemini',
    keyPlaceholder: 'Gemini API key',
    keyConsoleUrl: 'https://aistudio.google.com/apikey',
  },
}

/**
 * To add a model, add an entry here. The key is the app-level id persisted in settings; the
 * provider factory owns request building, parsing, and key testing.
 */
export const models: Record<string, ModelConfig> = {
  'typesafe-jev': createTypesafeModel({
    label: 'TypeSafe Jev (Box questions)',
    apiModel: 'jev-latest',
    // 512 px is 35 % fewer input tokens than 768 px; 16:9 frames bottom out near 498 px.
    maxSide: 512,
    pricing: {
      // Output tokens are free of charge.
      tiers: [{ inputPerMTok: 0.042, outputPerMTok: 0 }],
      sourceUrl: 'https://docs.typesafe.ai/models',
      checkedOn: '2026-10-24',
    },
  }),
  'gemini-3.8-flash': createGeminiModel({
    label: 'Gemini 3.8 Flash',
    apiModel: 'gemini-3.8-flash',
    // Measured: 72 % fewer input tokens per call than leaving media resolution unset.
    mediaResolution: 'low',
    pricing: {
      tiers: [
        { until: '2027-01-01', inputPerMTok: 0.75, outputPerMTok: 3.75 },
        { inputPerMTok: 1.5, outputPerMTok: 7.5 },
      ],
      sourceUrl: GEMINI_PRICING_URL,
      checkedOn: '2026-10-24',
    },
  }),
  'gemini-3.5-flash-lite': createGeminiModel({
    label: 'Gemini 3.5 Flash-Lite',
    apiModel: 'gemini-3.5-flash-lite',
    mediaResolution: 'low',
    pricing: {
      tiers: [{ inputPerMTok: 0.3, outputPerMTok: 2.5 }],
      sourceUrl: GEMINI_PRICING_URL,
      checkedOn: '2026-10-24',
    },
  }),
  'gemini-3.1-flash-lite': createGeminiModel({
    label: 'Gemini 3.1 Flash-Lite',
    apiModel: 'gemini-3.1-flash-lite',
    mediaResolution: 'low',
    pricing: {
      tiers: [{ inputPerMTok: 0.25, outputPerMTok: 1.5 }],
      sourceUrl: GEMINI_PRICING_URL,
      checkedOn: '2026-10-24',
    },
  }),
}

export const DEFAULT_MODEL_ID = 'typesafe-jev'

/** Standard paid-tier list price in effect on `at`. */
export function priceTierAt(pricing: ModelPricing, at: Date): PriceTier {
  const day = at.toISOString().slice(0, 10)
  return (
    pricing.tiers.find((candidate) => !candidate.until || day < candidate.until) ??
    pricing.tiers[pricing.tiers.length - 1]
  )
}

/** USD cost of one call at the list price in effect on `at`. */
export function callCostUsd(pricing: ModelPricing, usage: TokenUsage, at: Date): number {
  const tier = priceTierAt(pricing, at)
  return (usage.inputTokens * tier.inputPerMTok + usage.outputTokens * tier.outputPerMTok) / 1e6
}

/**
 * Every option the model declares, from `saved` when present and valid, else its default. Saved
 * values are snapped to the option's step and clamped, since limits can change between releases.
 */
export function resolveModelOptions(
  model: ModelConfig,
  saved: ModelOptionValues | undefined,
): ModelOptionValues {
  return Object.fromEntries(
    model.options.map((option) => {
      const value = saved?.[option.key]
      if (value === undefined || !Number.isFinite(value)) return [option.key, option.default]
      if (option.kind === 'choice') {
        const known = option.choices.some((choice) => choice.value === value)
        return [option.key, known ? value : option.default]
      }
      const snapped = option.min + Math.round((value - option.min) / option.step) * option.step
      return [option.key, Math.min(option.max, Math.max(option.min, snapped))]
    }),
  )
}
