import type { EncodedFrame, FrameEncoding, FrameSideLimits } from '@/lib/models'

export const JPEG_QUALITY = 0.8

/**
 * Draws `source` into `canvas`, scaled down so its longest side is at most `maxSide`, and
 * encodes it as JPEG. With `sideLimits`, the scale is then pushed into that range, upscaling
 * the source if its shortest side would otherwise fall under `sideLimits.min`.
 */
export async function encodeFrame(
  source: HTMLVideoElement | ImageBitmap,
  canvas: HTMLCanvasElement,
  encoding: FrameEncoding,
  maxSide: number,
  sideLimits?: FrameSideLimits,
): Promise<EncodedFrame> {
  const [sourceWidth, sourceHeight] =
    source instanceof HTMLVideoElement
      ? [source.videoWidth, source.videoHeight]
      : [source.width, source.height]
  const longSide = Math.max(sourceWidth, sourceHeight)
  let scale = Math.min(1, maxSide / longSide)
  if (sideLimits) {
    scale = Math.max(scale, sideLimits.min / Math.min(sourceWidth, sourceHeight))
    scale = Math.min(scale, sideLimits.max / longSide)
  }
  const width = Math.round(sourceWidth * scale)
  const height = Math.round(sourceHeight * scale)
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser could not create a 2D canvas to capture frames.')
  context.drawImage(source, 0, 0, width, height)

  if (encoding === 'base64') {
    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
    const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
    return {
      encoding,
      base64,
      bytes: (base64.length * 3) / 4 - padding,
      mimeType: 'image/jpeg',
      width,
      height,
    }
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) =>
        result ? resolve(result) : reject(new Error('The browser could not encode the frame.')),
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
  return { encoding, blob, bytes: blob.size, mimeType: 'image/jpeg', width, height }
}
