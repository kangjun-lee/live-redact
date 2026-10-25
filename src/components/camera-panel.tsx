import { type ReactNode, useId } from 'react'

import { useCameraStore } from '@/stores/camera-store'

interface CameraPanelProps {
  title: string
  caption: ReactNode
  children: ReactNode
}

/** Frame that matches the live video's aspect ratio, so overlays line up with the picture. */
export function CameraPanel({ title, caption, children }: CameraPanelProps) {
  const frameSize = useCameraStore((state) => state.frameSize)
  const titleId = useId()

  return (
    <section aria-labelledby={titleId} className="flex min-w-0 flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={titleId} className="shrink-0 text-sm font-medium">
          {title}
        </h2>
        <p className="min-w-0 truncate text-xs text-muted-foreground tabular-nums">{caption}</p>
      </div>
      <div
        className="relative overflow-hidden rounded-lg bg-neutral-900"
        style={{ aspectRatio: frameSize ? `${frameSize.width} / ${frameSize.height}` : '16 / 9' }}
      >
        {children}
      </div>
    </section>
  )
}
