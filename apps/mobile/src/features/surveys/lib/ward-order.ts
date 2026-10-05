const LEADING_NUMBER = /^(\d+)(.*)$/u

type WardNumberParts = {
  number: number
  suffix: string
}

function splitWardNumber(value: string): WardNumberParts {
  const trimmed = value.trim()
  const match = LEADING_NUMBER.exec(trimmed)
  if (!match?.[1]) return { number: Number.POSITIVE_INFINITY, suffix: trimmed }
  return { number: Number(match[1]), suffix: match[2] ?? "" }
}

/** Numeric ward order: `0`, `1`, `2`, `10`, then `10A`. Non-numeric values sort last. */
export function compareWardNumbers(left: string, right: string): number {
  const leftParts = splitWardNumber(left)
  const rightParts = splitWardNumber(right)
  if (leftParts.number !== rightParts.number) return leftParts.number - rightParts.number
  const suffixOrder = leftParts.suffix.localeCompare(rightParts.suffix)
  if (suffixOrder !== 0) return suffixOrder
  return left.localeCompare(right)
}

/** Returns a new array sorted by {@link compareWardNumbers}. */
export function sortWardsByNumber<T extends { wardNumber: string }>(wards: readonly T[]): T[] {
  return [...wards].sort((left, right) => compareWardNumbers(left.wardNumber, right.wardNumber))
}
