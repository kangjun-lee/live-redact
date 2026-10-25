import { CameraIcon, CameraOffIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useCameraStore } from '@/stores/camera-store'
import { useSettingsStore } from '@/stores/settings-store'

/** Covers the raw camera area until the stream is live: off, asking for permission, or failed. */
export function CameraStateOverlay() {
  const status = useCameraStore((state) => state.status)
  const error = useCameraStore((state) => state.error)
  if (status === 'live') return null

  const start = () =>
    void useCameraStore.getState().start(useSettingsStore.getState().params.deviceId)

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-y-auto p-4 text-center text-neutral-100"
      role={status === 'error' ? 'alert' : 'status'}
    >
      {status === 'requesting' && (
        <>
          <CameraIcon className="size-6 text-neutral-400" aria-hidden />
          <p className="max-w-xs text-sm">
            Waiting for camera permission. Check the browser prompt.
          </p>
        </>
      )}

      {status === 'idle' && (
        <>
          <CameraIcon className="size-6 text-neutral-400" aria-hidden />
          <p className="max-w-xs text-sm text-neutral-300">
            The camera is off. Frames leave this browser only while detection is running.
          </p>
          <Button variant="secondary" size="lg" className="max-sm:h-11" onClick={start}>
            Turn on camera
          </Button>
        </>
      )}

      {status === 'error' && error && (
        <>
          <CameraOffIcon className="size-6 text-neutral-400" aria-hidden />
          <p className="max-w-sm text-sm">{error.message}</p>
          {error.kind !== 'unsupported' && (
            <Button variant="secondary" size="lg" className="max-sm:h-11" onClick={start}>
              Try camera again
            </Button>
          )}
        </>
      )}
    </div>
  )
}
