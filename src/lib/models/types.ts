export type ProviderId = 'gemini' | 'typesafe'

/** Rectangle edges as fractions (0..1) of the frame, measured from the top-left corner. */
export interface NormalizedRect {
  top: number
  left: number
  bottom: number
  right: number
}

export interface NormalizedBox extends NormalizedRect {
  confidence: number | null
  label: string | null
}

export type FrameEncoding = 'binary' | 'base64'

/** Range, in pixels, a provider accepts for each side of an image. */
export interface FrameSideLimits {
  min: number
  max: number
}

interface FrameBase {
  mimeType: 'image/jpeg'
  width: number
  height: number
  /** Size of the encoded JPEG, before any base64 wrapping. */
  bytes: number
}

export type EncodedFrame =
  | (FrameBase & { encoding: 'binary'; blob: Blob })
  | (FrameBase & { encoding: 'base64'; base64: string })

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
}

export interface DetectRequest {
  frame: EncodedFrame
  /** What to find, in natural language (for example "human faces"). */
  target: string
  maxObjects: number
  /** Values for every entry in the model's `options`, already clamped to their limits. */
  options: ModelOptionValues
  apiKey: string
  signal: AbortSignal
}

export interface DetectResult {
  boxes: NormalizedBox[]
  usage: TokenUsage
  /** Versioned model name reported by the API, when it reports one. */
  servedModel: string | null
  /** The JSON body exactly as the API returned it, for inspection. */
  response: unknown
}

export interface PriceTier {
  /** Exclusive end date (YYYY-MM-DD, UTC). Omit on the last tier. */
  until?: string
  inputPerMTok: number
  outputPerMTok: number
}

export interface ModelPricing {
  /** Standard paid-tier list prices in USD, ordered by `until`. */
  tiers: PriceTier[]
  sourceUrl: string
  checkedOn: string
}

export interface ProviderConfig {
  label: string
  keyPlaceholder: string
  keyConsoleUrl: string
}

interface ModelOptionBase {
  key: string
  label: string
  description?: string
  default: number
}

/** A numeric setting shown as a slider. */
export interface RangeOptionSpec extends ModelOptionBase {
  kind: 'range'
  min: number
  max: number
  step: number
  unit?: string
}

/** A setting picked from a fixed list; the stored value is the chosen entry's `value`. */
export interface ChoiceOptionSpec extends ModelOptionBase {
  kind: 'choice'
  choices: { value: number; label: string }[]
}

/** A setting one model exposes in Model settings, passed to `detect` as `options[key]`. */
export type ModelOptionSpec = RangeOptionSpec | ChoiceOptionSpec

export type ModelOptionValues = Record<string, number>

export interface ModelConfig {
  label: string
  provider: ProviderId
  /** Model name sent to the provider API. */
  apiModel: string
  /** How the detection loop should encode frames before calling `detect`. */
  frameEncoding: FrameEncoding
  /** Longest side, in pixels, the detection loop scales frames down to before `detect`. */
  frameMaxSide(options: ModelOptionValues): number
  /** Side range the provider accepts; the detection loop scales frames into it, overriding `frameMaxSide`. */
  frameSideLimits?: FrameSideLimits
  pricing: ModelPricing
  /** Model-specific settings; empty when the model has none. */
  options: ModelOptionSpec[]
  detect(request: DetectRequest): Promise<DetectResult>
  /** Resolves when the key can call this model; rejects with an `ApiError` otherwise. */
  testApiKey(apiKey: string, signal: AbortSignal): Promise<void>
}
