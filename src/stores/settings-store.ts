import * as z from 'zod/mini'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { DEFAULT_MODEL_ID, models, type ModelOptionValues, type ProviderId } from '@/lib/models'

export interface DetectionParams {
  intervalMs: number
  /** Mosaic cell size in source pixels. */
  mosaicBlock: number
  /** Extra mosaic area around each box, as a percent of the box size per side. */
  mosaicPadding: number
  /** Extra area drawn around each box in the raw view, as a percent of the box size per side. */
  boxPadding: number
  maxFaces: number
  /**
   * Redraw the mosaic output at display rate. When off, the output only changes when a call
   * returns and shows the exact frame that call analyzed, so boxes never lag behind the image.
   */
  liveVideo: boolean
  /** What to detect and mosaic, in natural language. */
  target: string
  deviceId: string | null
}

type NumericParam = 'intervalMs' | 'mosaicBlock' | 'mosaicPadding' | 'boxPadding' | 'maxFaces'

export const PARAM_LIMITS: Record<NumericParam, { min: number; max: number; step: number }> = {
  intervalMs: { min: 250, max: 5000, step: 250 },
  mosaicBlock: { min: 4, max: 48, step: 2 },
  mosaicPadding: { min: 0, max: 50, step: 5 },
  boxPadding: { min: 0, max: 50, step: 5 },
  maxFaces: { min: 1, max: 8, step: 1 },
}

export type Theme = 'light' | 'dark'

interface SettingsState {
  modelId: string
  apiKeys: Record<ProviderId, string>
  /** Model-specific option values by model id; read through `resolveModelOptions`. */
  modelOptions: Record<string, ModelOptionValues>
  params: DetectionParams
  theme: Theme
  setModelId: (modelId: string) => void
  setApiKey: (provider: ProviderId, apiKey: string) => void
  setModelOptions: (modelId: string, values: ModelOptionValues) => void
  setParam: <K extends keyof DetectionParams>(key: K, value: DetectionParams[K]) => void
  setTheme: (theme: Theme) => void
}

const DEFAULT_PARAMS: DetectionParams = {
  intervalMs: 1000,
  mosaicBlock: 16,
  mosaicPadding: 15,
  boxPadding: 0,
  maxFaces: 4,
  liveVideo: true,
  target: 'human faces',
  deviceId: null,
}

const limited = (key: NumericParam) =>
  z.number().check(z.minimum(PARAM_LIMITS[key].min), z.maximum(PARAM_LIMITS[key].max))

/** localStorage is outside our control; anything that fails validation falls back to defaults. */
const persistedSchema = z.object({
  modelId: z.optional(z.string()),
  apiKeys: z.optional(z.partial(z.object({ typesafe: z.string(), gemini: z.string() }))),
  modelOptions: z.optional(z.record(z.string(), z.record(z.string(), z.number()))),
  params: z.optional(
    z.partial(
      z.object({
        intervalMs: limited('intervalMs'),
        mosaicBlock: limited('mosaicBlock'),
        mosaicPadding: limited('mosaicPadding'),
        boxPadding: limited('boxPadding'),
        maxFaces: limited('maxFaces'),
        liveVideo: z.boolean(),
        target: z.string(),
        deviceId: z.nullable(z.string()),
      }),
    ),
  ),
  theme: z.optional(z.enum(['light', 'dark'])),
})

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      modelId: DEFAULT_MODEL_ID,
      apiKeys: { typesafe: '', gemini: '' },
      modelOptions: {},
      params: DEFAULT_PARAMS,
      theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      setModelId: (modelId) => set({ modelId }),
      setApiKey: (provider, apiKey) =>
        set((state) => ({ apiKeys: { ...state.apiKeys, [provider]: apiKey } })),
      setModelOptions: (modelId, values) =>
        set((state) => ({ modelOptions: { ...state.modelOptions, [modelId]: values } })),
      setParam: (key, value) => set((state) => ({ params: { ...state.params, [key]: value } })),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'live-redact:settings',
      version: 1,
      partialize: ({ modelId, apiKeys, modelOptions, params, theme }) => ({
        modelId,
        apiKeys,
        modelOptions,
        params,
        theme,
      }),
      merge: (persisted, current) => {
        const parsed = persistedSchema.safeParse(persisted)
        const saved: z.infer<typeof persistedSchema> = parsed.success ? parsed.data : {}
        return {
          ...current,
          theme: saved.theme ?? current.theme,
          // A model removed from the registry falls back to the default instead of crashing.
          modelId: saved.modelId && saved.modelId in models ? saved.modelId : current.modelId,
          apiKeys: { ...current.apiKeys, ...saved.apiKeys },
          modelOptions: saved.modelOptions ?? current.modelOptions,
          params: { ...current.params, ...saved.params },
        }
      },
    },
  ),
)
