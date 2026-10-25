const usdSmall = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumSignificantDigits: 3,
})
const usdLarge = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** Placeholder for metrics that have no data yet. */
export const EMPTY_VALUE = '–'

export function formatMs(value: number | null): string {
  return value === null ? EMPTY_VALUE : integer.format(value)
}

export function formatCount(value: number): string {
  return integer.format(value)
}

export function formatUsd(value: number | null): string {
  if (value === null) return EMPTY_VALUE
  if (value === 0) return '$0'
  return value < 1 ? usdSmall.format(value) : usdLarge.format(value)
}
