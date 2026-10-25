import { type RefObject, useEffect, useRef } from 'react'

import { CameraPanel } from '@/components/camera-panel'
import { drawMosaicFrame } from '@/lib/mosaic'
import { useCameraStore } from '@/stores/camera-store'
import { useDetectionStore } from '@/stores/detection-store'
import { useSettingsStore } from '@/stores/settings-store'

/** Widest canvas we redraw every animation frame; larger feeds are scaled down to save GPU time. */
const MAX_CANVAS_WIDTH = 1280

/**
 * The camera re-rendered with the latest boxes mosaicked. With live video off, a running loop
 * shows only analyzed frames, so the output updates once per call instead of every display frame.
 */
export function MosaicView({ videoRef }: { videoRef: RefObject<HTMLVideoElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const live = useCameraStore((state) => state.status === 'live')
  const frameSize = useCameraStore((state) => state.frameSize)
  const running = useDetectionStore((state) => state.running)
  const boxCount = useDetectionStore((state) => state.boxes.length)
  const hasSnapshot = useDetectionStore((state) => state.frame !== null)
  const liveVideo = useSettingsStore((state) => state.params.liveVideo)
  const snapshotOnly = running && !liveVideo

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!live || !frameSize || !canvas || !context) return

    const scale = Math.min(1, MAX_CANVAS_WIDTH / frameSize.width)
    canvas.width = Math.round(frameSize.width * scale)
    canvas.height = Math.round(frameSize.height * scale)
    const scratch = document.createElement('canvas')
    let frame = 0
    // What the canvas shows now; a snapshot is redrawn only when it or the mosaic settings change.
    let drawn: { source: ImageBitmap | null; block: number; padding: number } | null = null

    const draw = () => {
      // Read stores directly: redrawing at display rate must not re-render React.
      const { mosaicBlock, mosaicPadding, liveVideo } = useSettingsStore.getState().params
      const { running, boxes, frame: snapshot } = useDetectionStore.getState()
      const options = {
        boxes,
        blockSize: Math.max(1, mosaicBlock * scale),
        paddingPercent: mosaicPadding,
      }
      const video = videoRef.current
      if (!running || liveVideo) {
        if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          drawMosaicFrame(context, scratch, video, options)
          drawn = null
        }
      } else if (
        drawn?.source !== snapshot ||
        drawn.block !== mosaicBlock ||
        drawn.padding !== mosaicPadding
      ) {
        // Before the first call returns there is no analyzed frame; blank beats unmasked.
        if (snapshot) drawMosaicFrame(context, scratch, snapshot, options)
        else context.clearRect(0, 0, canvas.width, canvas.height)
        drawn = { source: snapshot, block: mosaicBlock, padding: mosaicPadding }
      }
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [live, frameSize, videoRef])

  const caption = !live
    ? 'No camera feed'
    : snapshotOnly && !hasSnapshot
      ? 'Waiting for the first detection'
      : running
        ? `${boxCount} ${boxCount === 1 ? 'region' : 'regions'} mosaicked${snapshotOnly ? ' on the last analyzed frame' : ''}`
        : 'Unmasked until detection starts'

  return (
    <CameraPanel title="Mosaic output" caption={caption}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Camera feed with detected regions mosaicked"
        className={live ? 'absolute inset-0 size-full' : 'hidden'}
      />
      {!live && (
        <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-neutral-300">
          Output appears here once the camera is on.
        </p>
      )}
    </CameraPanel>
  )
}
