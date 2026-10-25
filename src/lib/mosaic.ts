import { padBox } from '@/lib/box-geometry'
import type { NormalizedBox } from '@/lib/models'

interface MosaicOptions {
  boxes: readonly NormalizedBox[]
  /** Mosaic cell size in source pixels. */
  blockSize: number
  paddingPercent: number
}

/**
 * Draws `source` onto `context`, then mosaics each box region by downscaling it into `scratch`
 * and scaling it back up without smoothing.
 */
export function drawMosaicFrame(
  context: CanvasRenderingContext2D,
  scratch: HTMLCanvasElement,
  source: CanvasImageSource,
  { boxes, blockSize, paddingPercent }: MosaicOptions,
): void {
  const { width, height } = context.canvas
  context.imageSmoothingEnabled = true
  context.drawImage(source, 0, 0, width, height)
  if (boxes.length === 0) return

  const scratchContext = scratch.getContext('2d')
  if (!scratchContext) return
  context.imageSmoothingEnabled = false

  for (const box of boxes) {
    const padded = padBox(box, paddingPercent)
    const x = Math.floor(padded.left * width)
    const y = Math.floor(padded.top * height)
    const w = Math.ceil((padded.right - padded.left) * width)
    const h = Math.ceil((padded.bottom - padded.top) * height)
    if (w <= 0 || h <= 0) continue
    const cellsX = Math.max(1, Math.ceil(w / blockSize))
    const cellsY = Math.max(1, Math.ceil(h / blockSize))
    if (scratch.width < cellsX) scratch.width = cellsX
    if (scratch.height < cellsY) scratch.height = cellsY
    // Sample from the canvas itself so earlier regions stay mosaicked where boxes overlap.
    scratchContext.drawImage(context.canvas, x, y, w, h, 0, 0, cellsX, cellsY)
    context.drawImage(scratch, 0, 0, cellsX, cellsY, x, y, w, h)
  }
}
