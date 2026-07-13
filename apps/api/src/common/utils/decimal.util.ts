export function toDecimalInput(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null
  return String(value)
}

export function decimalToNumber(value: { toNumber?: () => number } | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === "number") return value
  if (typeof value.toNumber === "function") return value.toNumber()
  return Number(value)
}

/** Approx sqm from sqft */
export function sqFtToSqMeter(sqFt: number): number {
  return Number((sqFt * 0.092903).toFixed(4))
}
