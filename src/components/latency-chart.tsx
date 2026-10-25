import { lazy, Suspense } from 'react'

import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useDetectionStore } from '@/stores/detection-store'
import { useSettingsStore } from '@/stores/settings-store'

const CHART_POINTS = 60

const LatencyChartPlot = lazy(() => import('@/components/latency-chart-plot'))

export function LatencyChart() {
  const calls = useDetectionStore((state) => state.calls)
  const intervalMs = useSettingsStore((state) => state.params.intervalMs)
  const data = calls
    .filter((call) => call.ok)
    .slice(-CHART_POINTS)
    .map((call) => ({ call: `#${call.id}`, total: Math.round(call.totalMs) }))

  // Fetch the chart after the first call so it is ready when the second one draws the line.
  if (data.length === 1) void import('@/components/latency-chart-plot')

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Latency per call (ms)</CardTitle>
        {data.length >= 2 && (
          <CardAction className="row-span-1 flex items-center gap-1.5 self-center text-xs leading-none text-muted-foreground">
            <svg width="16" height="2" aria-hidden="true">
              <line x1="0" y1="1" x2="16" y2="1" stroke="currentColor" strokeDasharray="4 3" />
            </svg>
            Interval
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {data.length < 2 ? (
          <p className="flex h-20 items-center justify-center rounded-lg border border-dashed px-4 text-center text-sm text-muted-foreground">
            {data.length === 0
              ? 'No successful calls yet'
              : 'One call so far. The line appears after the second.'}
          </p>
        ) : (
          <Suspense fallback={<div className="h-20" />}>
            <LatencyChartPlot data={data} intervalMs={intervalMs} />
          </Suspense>
        )}
      </CardContent>
    </Card>
  )
}
