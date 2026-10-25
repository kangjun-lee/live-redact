import type { NormalizedBox } from '@/lib/models'

/** Grows each edge by `percent` of the box's own width or height, clamped to the frame. */
export function padBox(box: NormalizedBox, percent: number): NormalizedBox {
  const padX = ((box.right - box.left) * percent) / 100
  const padY = ((box.bottom - box.top) * percent) / 100
  return {
    ...box,
    top: Math.max(0, box.top - padY),
    bottom: Math.min(1, box.bottom + padY),
    left: Math.max(0, box.left - padX),
    right: Math.min(1, box.right + padX),
  }
}
