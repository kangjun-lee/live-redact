import { useEffect, useRef } from 'react'

import { AppHeader } from '@/components/app-header'
import { DetectionControls } from '@/components/detection-controls'
import { DetectionView } from '@/components/detection-view'
import { LatencyChart } from '@/components/latency-chart'
import { MetricsCard } from '@/components/metrics-card'
import { ModelResponseCard } from '@/components/model-response-card'
import { MosaicView } from '@/components/mosaic-view'
import { ParametersCard } from '@/components/parameters-card'
import { useCameraBootstrap } from '@/hooks/use-camera-bootstrap'
import { useDetectionLoop } from '@/hooks/use-detection-loop'
import { useSettingsStore } from '@/stores/settings-store'

export function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const theme = useSettingsStore((state) => state.theme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useCameraBootstrap()
  useDetectionLoop(videoRef)

  return (
    <div className="min-h-svh">
      <AppHeader />
      <main className="mx-auto grid max-w-[1600px] gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <DetectionView videoRef={videoRef} />
            <MosaicView videoRef={videoRef} />
          </div>
          <DetectionControls />
        </div>
        <aside aria-label="Status and parameters" className="flex min-w-0 flex-col gap-4">
          <MetricsCard />
          <ModelResponseCard />
          <LatencyChart />
          <ParametersCard />
        </aside>
      </main>
    </div>
  )
}
