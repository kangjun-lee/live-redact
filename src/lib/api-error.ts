import type { ZodMiniType } from 'zod/mini'

export class ApiError extends Error {
  /** Fails the same way on every retry (bad key, missing model), so the loop stops instead. */
  readonly fatal: boolean
  readonly retryAfterMs: number | null

  constructor(
    message: string,
    options: { fatal?: boolean; retryAfterMs?: number | null; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause })
    this.name = 'ApiError'
    this.fatal = options.fatal ?? false
    this.retryAfterMs = options.retryAfterMs ?? null
  }
}

export function isAuthStatus(status: number): boolean {
  return status === 401 || status === 403
}

/** Client errors repeat unchanged, except request timeouts (408) and rate limits (429). */
export function isFatalStatus(status: number): boolean {
  return status >= 400 && status < 500 && status !== 408 && status !== 429
}

export function retryAfterMs(headers: Headers): number | null {
  const ms = Number(headers.get('retry-after-ms'))
  if (Number.isFinite(ms) && ms > 0) return ms
  const value = headers.get('retry-after')
  if (!value) return null
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const date = Date.parse(value)
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now())
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  const message = error instanceof Error ? error.message : String(error)
  return new ApiError(message, { cause: error })
}

interface SendOptions<T> {
  init: RequestInit & { signal: AbortSignal }
  timeoutMs: number
  /** Shown when the request never got an HTTP response (offline, DNS, CORS). */
  networkMessage: string
  describeError: (response: Response, body: unknown) => ApiError
  schema: ZodMiniType<T>
}

/**
 * Sends a request and returns the validated JSON body as `data`, plus the unvalidated `body` for
 * display. Aborts from the caller's signal propagate as the original AbortError so the caller can
 * tell "stopped" apart from a failure.
 */
export async function sendJsonRequest<T>(
  url: string,
  options: SendOptions<T>,
): Promise<{ data: T; body: unknown }> {
  const { init, timeoutMs } = options
  const timeout = AbortSignal.timeout(timeoutMs)
  let response: Response
  let text: string
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.any([init.signal, timeout]) })
    text = await response.text()
  } catch (error) {
    if (init.signal.aborted) throw error
    if (timeout.aborted) {
      throw new ApiError(`No response within ${timeoutMs / 1000} s.`, { cause: error })
    }
    throw new ApiError(options.networkMessage, { cause: error })
  }

  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }
  if (!response.ok) throw options.describeError(response, body)
  const parsed = options.schema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError('The API returned a response in an unexpected shape.', {
      cause: parsed.error,
    })
  }
  return { data: parsed.data, body }
}
