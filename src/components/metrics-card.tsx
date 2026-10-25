import { type ReactNode, useId } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EMPTY_VALUE, formatCount, formatMs, formatUsd } from '@/lib/format'
import { summarizeCalls } from '@/lib/session-metrics'
import { useDetectionStore } from '@/stores/detection-store'

function withMs(value: number | null): string {
  return value === null ? EMPTY_VALUE : `${formatMs(value)} ms`
}

interface KpiCardProps {
  label: ReactNode
  value: ReactNode
  unit?: string
  children?: ReactNode
}

function KpiCard({ label, value, unit, children }: KpiCardProps) {
  return (
    <Card size="sm">
      <CardContent className="flex min-w-0 flex-col gap-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
        <p className="truncate text-2xl font-semibold tracking-tight tabular-nums">
          {value}
          {unit && value !== EMPTY_VALUE && (
            <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>
          )}
        </p>
        {children && (
          <div className="flex flex-col text-xs text-muted-foreground tabular-nums">{children}</div>
        )}
      </CardContent>
    </Card>
  )
}

export function MetricsCard() {
  const calls = useDetectionStore((state) => state.calls)
  const okCount = useDetectionStore((state) => state.okCount)
  const errorCount = useDetectionStore((state) => state.errorCount)
  const totalCostUsd = useDetectionStore((state) => state.totalCostUsd)
  const runStartedAt = useDetectionStore((state) => state.runStartedAt)
  const titleId = useId()

  const { lastOk, avgTotalMs, p99TotalMs, costPerHourUsd } = summarizeCalls(calls, runStartedAt)
  const hasCalls = okCount + errorCount > 0

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <h2 id={titleId} className="font-heading text-base leading-snug font-medium">
            Status
          </h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="max-sm:h-11"
          disabled={!hasCalls}
          onClick={() => useDetectionStore.getState().resetStats()}
        >
          Reset stats
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* End-to-end latency of the most recent successful call. */}
        <KpiCard label="Latency (last)" value={formatMs(lastOk?.totalMs ?? null)} unit="ms">
          <span>
            enc {withMs(lastOk?.encodeMs ?? null)} · net {withMs(lastOk?.networkMs ?? null)}
          </span>
        </KpiCard>

        <KpiCard
          label="Latency avg / p99"
          value={
            avgTotalMs === null || p99TotalMs === null ? (
              EMPTY_VALUE
            ) : (
              <>
                {formatMs(avgTotalMs)}
                <span className="mx-1 font-normal text-muted-foreground">/</span>
                {formatMs(p99TotalMs)}
              </>
            )
          }
          unit="ms"
        />

        <KpiCard label="Cost (last)" value={formatUsd(lastOk?.costUsd ?? null)}>
          {lastOk ? (
            <span>
              {formatCount(lastOk.inputTokens)} tok · img {formatCount(lastOk.imageBytes / 1024)} KB
            </span>
          ) : (
            <span>{EMPTY_VALUE}</span>
          )}
        </KpiCard>

        <KpiCard label="Cost (total)" value={hasCalls ? formatUsd(totalCostUsd) : EMPTY_VALUE}>
          <span>
            {costPerHourUsd === null ? EMPTY_VALUE : `≈ ${formatUsd(costPerHourUsd)} / hr`}
          </span>
        </KpiCard>

        <KpiCard
          label="Calls OK / ERR"
          value={
            <>
              {okCount}
              <span className="mx-1 font-normal text-muted-foreground">/</span>
              <span className={errorCount > 0 ? 'text-destructive' : undefined}>{errorCount}</span>
            </>
          }
        />

        <KpiCard
          label="Faces (last)"
          value={lastOk ? String(lastOk.boxCount) : EMPTY_VALUE}
        ></KpiCard>
      </div>
    </section>
  )
}
