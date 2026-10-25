import type { CallRecord } from '@/stores/detection-store'

export interface SessionMetrics {
  lastOk: CallRecord | null
  avgTotalMs: number | null
  p99TotalMs: number | null
  /** Projected spend at the latest run's call cadence and average cost per call. */
  costPerHourUsd: number | null
}

export function summarizeCalls(
  calls: readonly CallRecord[],
  runStartedAt: number | null,
): SessionMetrics {
  const okTotals = calls.filter((call) => call.ok).map((call) => call.totalMs)
  const sorted = okTotals.toSorted((a, b) => a - b)
  const n = sorted.length

  // Gaps between runs are not part of the cadence, so only the latest run counts.
  const run = runStartedAt === null ? [] : calls.filter((call) => call.startedAt >= runStartedAt)
  let costPerHourUsd: number | null = null
  if (run.length >= 2) {
    const periodMs = (run[run.length - 1].startedAt - run[0].startedAt) / (run.length - 1)
    const avgCost = run.reduce((sum, call) => sum + call.costUsd, 0) / run.length
    if (periodMs > 0) costPerHourUsd = (avgCost * 3_600_000) / periodMs
  }

  return {
    lastOk: calls.findLast((call) => call.ok) ?? null,
    avgTotalMs: n ? okTotals.reduce((sum, value) => sum + value, 0) / n : null,
    // Nearest-rank percentile.
    p99TotalMs: n ? sorted[Math.ceil(0.99 * n) - 1] : null,
    costPerHourUsd,
  }
}
