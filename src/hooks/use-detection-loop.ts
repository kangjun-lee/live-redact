import { type RefObject, useEffect } from 'react'

import { toApiError } from '@/lib/api-error'
import { encodeFrame } from '@/lib/frame-capture'
import { callCostUsd, models, resolveModelOptions } from '@/lib/models'
import { useDetectionStore } from '@/stores/detection-store'
import { useSettingsStore } from '@/stores/settings-store'

/** Consecutive retryable failures before the loop stops itself instead of burning calls. */
const MAX_CONSECUTIVE_FAILURES = 5
const MAX_BACKOFF_MS = 30_000

/**
 * Calls never overlap, so a slow API lowers the call rate instead of queueing requests.
 * Settings are read on every tick, so edits apply to the next call.
 */
export function useDetectionLoop(videoRef: RefObject<HTMLVideoElement | null>): void {
  const running = useDetectionStore((state) => state.running)

  useEffect(() => {
    if (!running) return
    const controller = new AbortController()
    const canvas = document.createElement('canvas')
    let timer: number | undefined
    let consecutiveFailures = 0

    const schedule = (delayMs: number) => {
      if (!controller.signal.aborted) timer = window.setTimeout(tick, Math.max(0, delayMs))
    }

    async function tick() {
      const { modelId, apiKeys, modelOptions, params } = useSettingsStore.getState()
      const detection = useDetectionStore.getState()
      const model = models[modelId]
      const apiKey = apiKeys[model.provider].trim()
      const target = params.target.trim()
      if (!apiKey) return detection.stop(`Add a ${model.label} API key in Model settings.`)
      if (!target) return detection.stop('Enter a mosaic target before starting detection.')

      const video = videoRef.current
      if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) {
        return schedule(params.intervalMs)
      }

      const options = resolveModelOptions(model, modelOptions[modelId])
      const startedAt = Date.now()
      const t0 = performance.now()
      let t1 = t0
      // Kept only while live video is off; the mosaic view then shows this exact frame.
      let snapshot: ImageBitmap | null = null
      try {
        if (!params.liveVideo) snapshot = await createImageBitmap(video)
        const frame = await encodeFrame(
          snapshot ?? video,
          canvas,
          model.frameEncoding,
          model.frameMaxSide(options),
          model.frameSideLimits,
        )
        t1 = performance.now()
        const result = await model.detect({
          frame,
          target,
          maxObjects: params.maxFaces,
          options,
          apiKey,
          signal: controller.signal,
        })
        const t2 = performance.now()
        if (controller.signal.aborted) return snapshot?.close()
        consecutiveFailures = 0
        useDetectionStore.getState().recordSuccess(
          {
            startedAt,
            encodeMs: t1 - t0,
            networkMs: t2 - t1,
            totalMs: performance.now() - t0,
            costUsd: callCostUsd(model.pricing, result.usage, new Date(startedAt)),
            boxCount: result.boxes.length,
            inputTokens: result.usage.inputTokens,
            imageBytes: frame.bytes,
          },
          result.boxes,
          snapshot,
          result.servedModel,
          result.response,
        )
        schedule(params.intervalMs - (performance.now() - t0))
      } catch (thrown) {
        snapshot?.close()
        if (controller.signal.aborted) return
        const error = toApiError(thrown)
        const now = performance.now()
        consecutiveFailures++
        useDetectionStore.getState().recordFailure(
          {
            startedAt,
            encodeMs: t1 - t0,
            networkMs: t1 === t0 ? 0 : now - t1,
            totalMs: now - t0,
          },
          { fatal: error.fatal, message: error.message, at: Date.now() },
        )
        if (error.fatal) return useDetectionStore.getState().stop(error.message)
        if (error.retryAfterMs !== null && error.retryAfterMs > MAX_BACKOFF_MS) {
          const seconds = Math.ceil(error.retryAfterMs / 1000)
          return useDetectionStore
            .getState()
            .stop(`The API asked to wait ${seconds} s before the next call: ${error.message}`)
        }
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          return useDetectionStore
            .getState()
            .stop(
              `Stopped after ${MAX_CONSECUTIVE_FAILURES} failed calls in a row: ${error.message}`,
            )
        }
        const backoff = Math.min(MAX_BACKOFF_MS, params.intervalMs * 2 ** consecutiveFailures)
        schedule(Math.max(error.retryAfterMs ?? 0, backoff))
      }
    }

    void tick()
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [running, videoRef])
}
