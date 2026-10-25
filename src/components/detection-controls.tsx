import { CircleAlertIcon } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { formatMs } from '@/lib/format'
import { models, providers } from '@/lib/models'
import { useCameraStore } from '@/stores/camera-store'
import { useDetectionStore } from '@/stores/detection-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useUiStore } from '@/stores/ui-store'

/** The one primary action (start or stop detection), its preconditions, and loop errors. */
export function DetectionControls() {
  const live = useCameraStore((state) => state.status === 'live')
  const running = useDetectionStore((state) => state.running)
  const stopReason = useDetectionStore((state) => state.stopReason)
  const lastError = useDetectionStore((state) => state.lastError)
  const model = models[useSettingsStore((state) => state.modelId)]
  const hasKey = useSettingsStore((state) => state.apiKeys[model.provider].trim() !== '')
  const hasTarget = useSettingsStore((state) => state.params.target.trim() !== '')
  const intervalMs = useSettingsStore((state) => state.params.intervalMs)

  let blocker: string | null = null
  if (!live) blocker = 'Turn on the camera to start detection.'
  else if (!hasTarget) blocker = 'Enter a mosaic target in Parameters.'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {running ? (
          <Button
            variant="outline"
            size="lg"
            className="min-w-40 max-sm:h-11 max-sm:flex-1"
            onClick={() => useDetectionStore.getState().stop()}
          >
            Stop detection
          </Button>
        ) : hasKey ? (
          <Button
            size="lg"
            className="min-w-40 max-sm:h-11 max-sm:flex-1"
            disabled={blocker !== null}
            onClick={() => useDetectionStore.getState().start()}
          >
            Start detection
          </Button>
        ) : (
          <Button
            size="lg"
            className="min-w-40 max-sm:h-11 max-sm:flex-1"
            onClick={() => useUiStore.getState().setSettingsOpen(true)}
          >
            Add {providers[model.provider].label} API key
          </Button>
        )}
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          {running ? (
            <>
              {/* Marks an active request loop; deliberately static, no pulse. */}
              <span className="size-2 shrink-0 rounded-full bg-signal" aria-hidden />
              <span>Detecting every {formatMs(intervalMs)} ms or slower if the API lags.</span>
            </>
          ) : (
            (blocker ?? (hasKey ? 'Ready. Each call sends one frame to the model API.' : null))
          )}
        </p>
      </div>

      {!running && stopReason && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>Detection stopped</AlertTitle>
          <AlertDescription>{stopReason}</AlertDescription>
          {/* Key and model errors repeat until settings change, so offer the fix directly. */}
          {lastError?.fatal && (
            <div className="col-start-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                className="max-sm:h-11"
                onClick={() => useUiStore.getState().setSettingsOpen(true)}
              >
                Open Model settings
              </Button>
            </div>
          )}
        </Alert>
      )}
      {running && lastError && (
        <Alert>
          <CircleAlertIcon />
          <AlertTitle>Last call failed, retrying</AlertTitle>
          <AlertDescription>{lastError.message}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
