import { type RefObject, useEffect } from 'react'

import { CameraPanel } from '@/components/camera-panel'
import { CameraStateOverlay } from '@/components/camera-state-overlay'
import { padBox } from '@/lib/box-geometry'
import { useCameraStore } from '@/stores/camera-store'
import { useDetectionStore } from '@/stores/detection-store'
import { useSettingsStore } from '@/stores/settings-store'

/** The live camera with the latest detected boxes drawn on top. */
export function DetectionView({ videoRef }: { videoRef: RefObject<HTMLVideoElement | null> }) {
  const stream = useCameraStore((state) => state.stream)
  const live = useCameraStore((state) => state.status === 'live')
  const running = useDetectionStore((state) => state.running)
  const boxes = useDetectionStore((state) => state.boxes)
  const boxPadding = useSettingsStore((state) => state.params.boxPadding)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.srcObject = stream
    const { setFrameSize } = useCameraStore.getState()
    const syncSize = () =>
      setFrameSize(video.videoWidth ? { width: video.videoWidth, height: video.videoHeight } : null)
    video.addEventListener('loadedmetadata', syncSize)
    // Fires when a camera switch or device rotation changes the frame size.
    video.addEventListener('resize', syncSize)
    return () => {
      video.removeEventListener('loadedmetadata', syncSize)
      video.removeEventListener('resize', syncSize)
    }
  }, [stream, videoRef])

  const caption = !live
    ? 'No camera feed'
    : running
      ? `${boxes.length} ${boxes.length === 1 ? 'box' : 'boxes'} from the last call`
      : 'Detection is off'

  return (
    <CameraPanel title="Raw camera + boxes" caption={caption}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        aria-label="Live camera feed"
        className={live ? 'absolute inset-0 size-full object-cover' : 'hidden'}
      />
      {live && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {boxes.map((box, index) => {
            const padded = padBox(box, boxPadding)
            const confidence =
              box.confidence === null ? '' : ` ${Math.round(box.confidence * 100)}%`
            return (
              <div
                key={index}
                className="absolute rounded-sm border-2 border-signal-video"
                style={{
                  left: `${padded.left * 100}%`,
                  top: `${padded.top * 100}%`,
                  width: `${(padded.right - padded.left) * 100}%`,
                  height: `${(padded.bottom - padded.top) * 100}%`,
                }}
              >
                <span
                  className={
                    // Labels sit above the box unless that would push them out of the frame.
                    padded.top < 0.08
                      ? 'absolute top-0 left-0 bg-signal-video px-1 text-[11px] leading-4 font-medium whitespace-nowrap text-neutral-950 tabular-nums'
                      : 'absolute top-0 left-0 -translate-y-full rounded-t-sm bg-signal-video px-1 text-[11px] leading-4 font-medium whitespace-nowrap text-neutral-950 tabular-nums'
                  }
                >
                  {box.label ?? `#${index + 1}`}
                  {confidence}
                </span>
              </div>
            )
          })}
        </div>
      )}
      <CameraStateOverlay />
    </CameraPanel>
  )
}
