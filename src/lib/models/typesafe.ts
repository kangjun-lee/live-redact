import * as z from 'zod/mini'

import {
  ApiError,
  isAuthStatus,
  isFatalStatus,
  retryAfterMs,
  sendJsonRequest,
} from '@/lib/api-error'

import type {
  DetectRequest,
  DetectResult,
  ModelConfig,
  ModelOptionSpec,
  ModelPricing,
  NormalizedBox,
} from './types'

/** Vite's proxy (dev/preview) and vercel.json's rewrite serve `/api/typesafe`; set VITE_TYPESAFE_BASE_URL elsewhere. */
const API_BASE = import.meta.env.VITE_TYPESAFE_BASE_URL || '/api/typesafe'
const DETECT_TIMEOUT_MS = 20_000
const TEST_TIMEOUT_MS = 10_000
/** The API rejects images with a side outside this range. */
const IMAGE_SIDE = { min: 280, max: 1568 }
const NETWORK_MESSAGE =
  'Could not reach the TypeSafe API. api.typesafe.ai rejects browser requests from other origins (CORS), so run the app through `pnpm dev`, `pnpm preview` or Vercel, or set VITE_TYPESAFE_BASE_URL to a forwarding URL.'

function frameSizeOption(defaultMaxSide: number): ModelOptionSpec {
  return {
    kind: 'range',
    key: 'maxSide',
    label: 'Frame size',
    min: 320,
    max: 1536,
    step: 64,
    default: defaultMaxSide,
    unit: 'px',
  }
}

const errorBodySchema = z.object({
  detail: z.union([
    z.string(),
    z.looseObject({ message: z.optional(z.string()) }),
    z.array(z.looseObject({ msg: z.string(), loc: z.array(z.union([z.string(), z.number()])) })),
  ]),
})

const systemOneResponseSchema = z.object({
  model: z.string(),
  answers: z.record(z.string(), z.unknown()),
  usage: z.object({ input_tokens: z.number(), output_tokens: z.number() }),
})

const choiceAnswerSchema = z.object({ type: z.literal('choice'), choice: z.string() })

const boxAnswerSchema = z.object({
  type: z.literal('box'),
  box: z.object({ top: z.number(), bottom: z.number(), left: z.number(), right: z.number() }),
  confidence: z.nullable(z.number()),
})

function describeTypesafeError(response: Response, body: unknown): ApiError {
  const parsed = errorBodySchema.safeParse(body)
  let message = `TypeSafe returned HTTP ${response.status}.`
  if (isAuthStatus(response.status)) {
    message = `TypeSafe rejected the API key (HTTP ${response.status}).`
  } else if (parsed.success) {
    const { detail } = parsed.data
    if (typeof detail === 'string') message = detail
    else if (Array.isArray(detail)) {
      message = detail.map((entry) => `${entry.loc.join('.')}: ${entry.msg}`).join('; ')
    } else if (detail.message) message = detail.message
  }
  return new ApiError(message, {
    fatal: isFatalStatus(response.status),
    retryAfterMs: retryAfterMs(response.headers),
  })
}

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth']

function ordinal(n: number): string {
  if (n <= ORDINALS.length) return ORDINALS[n - 1]
  const suffix = n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : 'th'
  return `${n}${suffix}`
}

/**
 * A Box question always returns exactly one box, even when nothing matches. To find up to N
 * targets, ask one Box per slot plus a Choice that counts them, then keep only the counted slots.
 */
function buildQuestions(target: string, maxObjects: number): Record<string, object> {
  const slots = Array.from({ length: maxObjects }, (_, i) => i + 1)
  return {
    count: {
      type: 'choice',
      instructions: `How many ${target} are visible in \`photo\`?`,
      criteria: {
        0: `No ${target} are visible`,
        ...Object.fromEntries(slots.slice(0, -1).map((n) => [n, `Exactly ${n}`])),
        [maxObjects]: maxObjects === 1 ? 'At least one' : `${maxObjects} or more`,
      },
    },
    ...Object.fromEntries(
      slots.map((n) => [
        `box_${n}`,
        {
          type: 'box',
          instructions:
            maxObjects === 1
              ? `the most prominent of the ${target} in \`photo\``
              : `the ${ordinal(n)} of the ${target} in \`photo\`, counting from the left`,
        },
      ]),
    ),
  }
}

/** Keeps the box slots the count answer says are filled. */
function countedBoxes(answers: Record<string, unknown>, maxObjects: number): NormalizedBox[] {
  const count = choiceAnswerSchema.safeParse(answers.count)
  if (!count.success) throw new ApiError('TypeSafe returned no count.')
  const found = Math.min(maxObjects, Number.parseInt(count.data.choice, 10) || 0)

  const boxes: NormalizedBox[] = []
  for (let n = 1; n <= found; n++) {
    const answer = boxAnswerSchema.safeParse(answers[`box_${n}`])
    if (!answer.success) continue
    boxes.push({ ...answer.data.box, confidence: answer.data.confidence, label: null })
  }
  return boxes
}

interface TypesafeModelConfig {
  label: string
  apiModel: string
  pricing: ModelPricing
  /**
   * Default for the Frame size option, in pixels. Input tokens grow with pixel count (about 1 per
   * 393 px), and frames whose short side would fall under the API minimum are scaled up to it.
   */
  maxSide: number
}

export function createTypesafeModel(config: TypesafeModelConfig): ModelConfig {
  const { apiModel } = config
  const options = [frameSizeOption(config.maxSide)]

  async function detect(request: DetectRequest): Promise<DetectResult> {
    const { frame, target, maxObjects, apiKey, signal } = request
    if (frame.encoding !== 'binary') throw new Error('TypeSafe expects binary frames.')

    const assetId = crypto.randomUUID()
    const body = new FormData()
    body.append(
      'request',
      JSON.stringify({
        model: apiModel,
        state: { photo: assetId },
        assets: { [assetId]: { type: 'image', part: 'frame' } },
        questions: buildQuestions(target, maxObjects),
      }),
    )
    body.append('frame', frame.blob, 'frame.jpg')

    const { data: response, body: rawResponse } = await sendJsonRequest(
      `${API_BASE}/v1/systemone`,
      {
        init: {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'TypeSafe-Danger-Zone-Images': 'true',
          },
          body,
          signal,
        },
        timeoutMs: DETECT_TIMEOUT_MS,
        networkMessage: NETWORK_MESSAGE,
        describeError: describeTypesafeError,
        schema: systemOneResponseSchema,
      },
    )

    return {
      boxes: countedBoxes(response.answers, maxObjects),
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      servedModel: response.model,
      response: rawResponse,
    }
  }

  async function testApiKey(apiKey: string, signal: AbortSignal): Promise<void> {
    const {
      data: { models },
    } = await sendJsonRequest(`${API_BASE}/v1/models`, {
      init: { headers: { Authorization: `Bearer ${apiKey}` }, signal },
      timeoutMs: TEST_TIMEOUT_MS,
      networkMessage: NETWORK_MESSAGE,
      describeError: describeTypesafeError,
      schema: z.object({ models: z.array(z.object({ name: z.string() })) }),
    })
    if (!models.some((model) => model.name === apiModel)) {
      throw new ApiError(`The key works, but ${apiModel} is not available to it.`, {
        fatal: true,
      })
    }
  }

  return {
    ...config,
    provider: 'typesafe',
    frameEncoding: 'binary',
    frameMaxSide: (values) => values.maxSide,
    frameSideLimits: IMAGE_SIDE,
    options,
    detect,
    testApiKey,
  }
}
