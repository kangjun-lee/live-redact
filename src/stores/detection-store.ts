import { create } from 'zustand'

import type { NormalizedBox } from '@/lib/models'

export interface CallRecord {
  id: number
  /** Epoch ms when the frame was captured. */
  startedAt: number
  ok: boolean
  encodeMs: number
  networkMs: number
  totalMs: number
  costUsd: number
  boxCount: number
  inputTokens: number
  /** Size of the encoded JPEG frame. */
  imageBytes: number
}

/** Fields only a successful call can report; failures record them as 0. */
type SuccessOnlyField = 'costUsd' | 'boxCount' | 'inputTokens' | 'imageBytes'

export interface DetectionError {
  /** Retrying cannot help; the user has to change settings. */
  fatal: boolean
  message: string
  at: number
}

/** Calls kept for averages, p99, cadence, and the chart. Counters and totals are not capped. */
const HISTORY_LIMIT = 300

interface DetectionState {
  running: boolean
  boxes: NormalizedBox[]
  /** The frame `boxes` came from; only captured while live video is off. */
  frame: ImageBitmap | null
  calls: CallRecord[]
  okCount: number
  errorCount: number
  totalCostUsd: number
  lastError: DetectionError | null
  /** Why the loop stopped by itself, shown until the next start. */
  stopReason: string | null
  servedModel: string | null
  /** JSON body of the latest successful call, as the API returned it. */
  lastResponse: unknown
  /** Epoch ms of the latest start; the cost projection only uses calls from this run. */
  runStartedAt: number | null
  start: () => void
  stop: (reason?: string) => void
  recordSuccess: (
    call: Omit<CallRecord, 'id' | 'ok'>,
    boxes: NormalizedBox[],
    frame: ImageBitmap | null,
    servedModel: string | null,
    response: unknown,
  ) => void
  recordFailure: (
    call: Omit<CallRecord, 'id' | 'ok' | SuccessOnlyField>,
    error: DetectionError,
  ) => void
  resetStats: () => void
}

let nextCallId = 1

const EMPTY_STATS = {
  boxes: [],
  frame: null,
  calls: [],
  okCount: 0,
  errorCount: 0,
  totalCostUsd: 0,
  lastError: null,
  servedModel: null,
  lastResponse: null,
} satisfies Partial<DetectionState>

export const useDetectionStore = create<DetectionState>()((set, get) => {
  /** Applies `next` and releases the replaced frame's GPU memory. */
  const replaceFrame = (next: Partial<DetectionState>) => {
    const previous = get().frame
    set(next)
    if (previous && previous !== get().frame) previous.close()
  }

  return {
    running: false,
    stopReason: null,
    runStartedAt: null,
    ...EMPTY_STATS,

    start: () =>
      set({ running: true, runStartedAt: Date.now(), stopReason: null, lastError: null }),
    stop: (reason) =>
      replaceFrame({ running: false, boxes: [], frame: null, stopReason: reason ?? null }),

    recordSuccess: (call, boxes, frame, servedModel, response) => {
      const state = get()
      replaceFrame({
        boxes,
        frame,
        servedModel,
        lastResponse: response,
        okCount: state.okCount + 1,
        totalCostUsd: state.totalCostUsd + call.costUsd,
        lastError: null,
        calls: [...state.calls, { ...call, id: nextCallId++, ok: true }].slice(-HISTORY_LIMIT),
      })
    },

    recordFailure: (call, error) =>
      set((state) => ({
        errorCount: state.errorCount + 1,
        lastError: error,
        calls: [
          ...state.calls,
          {
            ...call,
            id: nextCallId++,
            ok: false,
            costUsd: 0,
            boxCount: 0,
            inputTokens: 0,
            imageBytes: 0,
          },
        ].slice(-HISTORY_LIMIT),
      })),

    resetStats: () => replaceFrame(EMPTY_STATS),
  }
})
