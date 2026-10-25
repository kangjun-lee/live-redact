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

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const DETECT_TIMEOUT_MS = 20_000
const TEST_TIMEOUT_MS = 10_000
const NETWORK_MESSAGE =
  'Could not reach the Gemini API. Check your connection, VPN, or content blockers.'

const errorBodySchema = z.object({
  error: z.object({
    message: z.optional(z.string()),
    details: z.optional(
      z.array(
        z.looseObject({ reason: z.optional(z.string()), retryDelay: z.optional(z.string()) }),
      ),
    ),
  }),
})

const generateResponseSchema = z.object({
  candidates: z.optional(
    z.array(
      z.object({
        content: z.optional(
          z.object({
            parts: z.optional(
              z.array(z.object({ text: z.optional(z.string()), thought: z.optional(z.boolean()) })),
            ),
          }),
        ),
        finishReason: z.optional(z.string()),
      }),
    ),
  ),
  promptFeedback: z.optional(z.object({ blockReason: z.optional(z.string()) })),
  usageMetadata: z.optional(
    z.object({
      promptTokenCount: z.optional(z.number()),
      candidatesTokenCount: z.optional(z.number()),
      thoughtsTokenCount: z.optional(z.number()),
    }),
  ),
  modelVersion: z.optional(z.string()),
})

/** Shape requested through `responseFormat`; items that do not match are dropped individually. */
const detectionItemSchema = z.object({
  box_2d: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  label: z.optional(z.string()),
})
const detectionPayloadSchema = z.object({ items: z.array(z.unknown()) })

function describeGeminiError(response: Response, body: unknown): ApiError {
  const parsed = errorBodySchema.safeParse(body)
  const error = parsed.success ? parsed.data.error : undefined
  const details = error?.details ?? []
  const retryDelay = details.find((detail) => detail.retryDelay)?.retryDelay
  // Gemini answers an invalid key with 400 INVALID_ARGUMENT, so the reason decides auth.
  const auth =
    isAuthStatus(response.status) || details.some((detail) => detail.reason === 'API_KEY_INVALID')
  const message = auth
    ? `Gemini rejected the API key (HTTP ${response.status}).`
    : (error?.message ?? `Gemini returned HTTP ${response.status}.`)
  return new ApiError(message, {
    fatal: auth || isFatalStatus(response.status),
    retryAfterMs: retryDelay
      ? Number.parseFloat(retryDelay) * 1000
      : retryAfterMs(response.headers),
  })
}

function parseBoxes(text: string, maxObjects: number): NormalizedBox[] {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new ApiError('Gemini returned boxes that are not valid JSON.')
  }
  const payload = detectionPayloadSchema.safeParse(json)
  if (!payload.success) {
    throw new ApiError('Gemini returned JSON without an items list.')
  }

  const boxes: NormalizedBox[] = []
  for (const raw of payload.data.items) {
    const item = detectionItemSchema.safeParse(raw)
    if (!item.success) continue
    const [y0, x0, y1, x1] = item.data.box_2d.map((value) => Math.min(1000, Math.max(0, value)))
    if (y0 === y1 || x0 === x1) continue
    boxes.push({
      top: Math.min(y0, y1) / 1000,
      bottom: Math.max(y0, y1) / 1000,
      left: Math.min(x0, x1) / 1000,
      right: Math.max(x0, x1) / 1000,
      confidence: null,
      label: item.data.label || null,
    })
    if (boxes.length === maxObjects) break
  }
  return boxes
}

/** Option values index this list; append new levels so saved values keep their meaning. */
const MEDIA_RESOLUTIONS = ['low', 'medium', 'high'] as const
type GeminiMediaResolution = (typeof MEDIA_RESOLUTIONS)[number]

/**
 * Gemini 3 bills a fixed token budget per image set by `mediaResolution`, whatever the pixel
 * size, so a smaller frame only shortens the upload.
 */
const FRAME_MAX_SIDE = 768

interface GeminiModelConfig {
  label: string
  apiModel: string
  pricing: ModelPricing
  /** Default for the Media resolution option. */
  mediaResolution: GeminiMediaResolution
}

export function createGeminiModel(config: GeminiModelConfig): ModelConfig {
  const { apiModel } = config
  const options: ModelOptionSpec[] = [
    {
      kind: 'choice',
      key: 'mediaResolution',
      label: 'Media resolution',
      default: MEDIA_RESOLUTIONS.indexOf(config.mediaResolution),
      choices: [
        { value: 0, label: 'Low, about 280 tokens' },
        { value: 1, label: 'Medium, about 560 tokens' },
        { value: 2, label: 'High, about 1,120 tokens' },
      ],
    },
  ]

  async function detect(request: DetectRequest): Promise<DetectResult> {
    const { frame, target, maxObjects, options: values, apiKey, signal } = request
    if (frame.encoding !== 'base64') throw new Error('Gemini expects base64-encoded frames.')

    const prompt = [
      `Detect ${target} in the image.`,
      `Return at most ${maxObjects} items, largest first.`,
      'Each box_2d is [ymin, xmin, ymax, xmax] normalized to 0-1000.',
      'Return an empty items list when nothing matches.',
    ].join(' ')

    const body = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: { mimeType: frame.mimeType, data: frame.base64 },
              mediaResolution: {
                level: `media_resolution_${MEDIA_RESOLUTIONS[values.mediaResolution]}`,
              },
            },
          ],
        },
      ],
      generationConfig: {
        // Google's detection guide recommends minimal thinking for box output; it also cuts latency.
        thinkingConfig: { thinkingLevel: 'MINIMAL' },
        responseFormat: {
          text: {
            mimeType: 'APPLICATION_JSON',
            schema: {
              type: 'object',
              properties: {
                items: {
                  type: 'array',
                  maxItems: maxObjects,
                  items: {
                    type: 'object',
                    properties: {
                      box_2d: {
                        type: 'array',
                        items: { type: 'integer' },
                        minItems: 4,
                        maxItems: 4,
                        description: '[ymin, xmin, ymax, xmax] normalized to 0-1000',
                      },
                      label: { type: 'string' },
                    },
                    required: ['box_2d', 'label'],
                  },
                },
              },
              required: ['items'],
            },
          },
        },
      },
    }

    const { data: response, body: rawResponse } = await sendJsonRequest(
      `${API_BASE}/models/${apiModel}:generateContent`,
      {
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(body),
          signal,
        },
        timeoutMs: DETECT_TIMEOUT_MS,
        networkMessage: NETWORK_MESSAGE,
        describeError: describeGeminiError,
        schema: generateResponseSchema,
      },
    )

    const blockReason = response.promptFeedback?.blockReason
    if (blockReason) throw new ApiError(`Gemini blocked the frame (${blockReason}).`)
    const candidate = response.candidates?.[0]
    const text = candidate?.content?.parts
      ?.filter((part) => !part.thought && part.text)
      .map((part) => part.text)
      .join('')
    if (!text) {
      const reason = candidate?.finishReason ?? 'no candidate'
      throw new ApiError(`Gemini returned no boxes (${reason}).`)
    }

    const usage = response.usageMetadata
    return {
      boxes: parseBoxes(text, maxObjects),
      usage: {
        inputTokens: usage?.promptTokenCount ?? 0,
        // Thinking tokens bill at the output rate.
        outputTokens: (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0),
      },
      servedModel: response.modelVersion ?? null,
      response: rawResponse,
    }
  }

  async function testApiKey(apiKey: string, signal: AbortSignal): Promise<void> {
    await sendJsonRequest(`${API_BASE}/models/${apiModel}`, {
      init: { headers: { 'x-goog-api-key': apiKey }, signal },
      timeoutMs: TEST_TIMEOUT_MS,
      networkMessage: NETWORK_MESSAGE,
      describeError: (response, body) =>
        response.status === 404
          ? new ApiError(`The key works, but ${apiModel} is not available to it.`, { fatal: true })
          : describeGeminiError(response, body),
      schema: z.object({ name: z.string() }),
    })
  }

  return {
    ...config,
    provider: 'gemini',
    frameEncoding: 'base64',
    frameMaxSide: () => FRAME_MAX_SIDE,
    options,
    detect,
    testApiKey,
  }
}
