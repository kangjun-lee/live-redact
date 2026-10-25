import { Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

const chartConfig = {
  total: { label: 'Total', color: 'var(--signal)' },
} satisfies ChartConfig

export interface LatencyPoint {
  call: string
  total: number
}

/** Kept in its own module so Recharts loads only once there is a line to draw. */
export default function LatencyChartPlot({
  data,
  intervalMs,
}: {
  data: LatencyPoint[]
  intervalMs: number
}) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-20 w-full">
      <LineChart data={data} margin={{ left: 0, right: 4, top: 4, bottom: 4 }}>
        {/* Latency above this line means calls can't keep up with the interval. */}
        <ReferenceLine
          y={intervalMs}
          ifOverflow="extendDomain"
          stroke="var(--muted-foreground)"
          strokeDasharray="4 3"
        />
        <XAxis dataKey="call" hide />
        <YAxis hide />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        {/* Not animated: animating on every new call would only add noise. */}
        <Line
          dataKey="total"
          stroke="var(--color-total)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  )
}
