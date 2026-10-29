/**
 * Architectural floor ordering for Excel / report narratives.
 * Sort complete floor objects by rank; never alphabetize labels.
 */

/** Rank for terrace / roof / mumty / barsati (after every numbered storey). */
export const EXPORT_FLOOR_RANK_TERRACE = 100_000

/** Rank for open land (after terrace among recognized values). */
export const EXPORT_FLOOR_RANK_OPEN_LAND = 110_000

/** Rank for unrecognized floor labels (kept; stable relative order). */
export const EXPORT_FLOOR_RANK_UNKNOWN = 200_000

const ORDINAL_STOREY: Readonly<Record<string, number>> = {
  FIRST: 1,
  SECOND: 2,
  THIRD: 3,
  FOURTH: 4,
  FIFTH: 5,
  SIXTH: 6,
  SEVENTH: 7,
  EIGHTH: 8,
  NINTH: 9,
  TENTH: 10,
  ELEVENTH: 11,
  TWELFTH: 12,
  THIRTEENTH: 13,
  FOURTEENTH: 14,
  FIFTEENTH: 15,
  SIXTEENTH: 16,
  SEVENTEENTH: 17,
  EIGHTEENTH: 18,
  NINETEENTH: 19,
  TWENTIETH: 20,
}

export type ExportFloorOrderInput = {
  floorPosition?: string | null
}

/**
 * Normalize enum codes and display labels to UPPER_SNAKE for ranking.
 */
export function normalizeExportFloorKey(raw: string | null | undefined): string {
  if (raw == null) return ""
  return raw
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
}

/**
 * Numeric rank for ascending architectural order.
 * Basements use negative depth (deeper first). Ground = 0. Storeys = 1..n.
 */
export function getExportFloorRank(floorPosition: string | null | undefined): number {
  const key = normalizeExportFloorKey(floorPosition)
  if (!key) return EXPORT_FLOOR_RANK_UNKNOWN
  if (key === "GROUND" || key === "GROUND_FLOOR" || key === "GF" || key === "G") {
    return 0
  }
  if (key === "OPEN_LAND" || key === "OPEN_LAND_PLOT") {
    return EXPORT_FLOOR_RANK_OPEN_LAND
  }
  if (key === "TERRACE" || key === "ROOF" || key === "MUMTY" || key === "BARSATI") {
    return EXPORT_FLOOR_RANK_TERRACE
  }
  const basementDepth = parseBasementDepth(key)
  if (basementDepth != null) {
    return -basementDepth
  }
  if (key === "FIFTH_FLOOR_PLUS") {
    return 5
  }
  const storey = parseStoreyNumber(key)
  if (storey != null) {
    return storey
  }
  return EXPORT_FLOOR_RANK_UNKNOWN
}

function parseBasementDepth(key: string): number | null {
  if (key === "BASEMENT" || key === "B" || key === "BASEMENT_1" || key === "B1") {
    return 1
  }
  const numbered = /^BASEMENT_(\d+)$/.exec(key)
  if (numbered?.[1]) {
    return Number(numbered[1])
  }
  const short = /^B(\d+)$/.exec(key)
  if (short?.[1]) {
    return Number(short[1])
  }
  return null
}

function parseStoreyNumber(key: string): number | null {
  const ordinalFloor = /^([A-Z]+)_FLOOR$/.exec(key)
  if (ordinalFloor?.[1]) {
    const fromOrdinal = ORDINAL_STOREY[ordinalFloor[1]]
    if (fromOrdinal != null) return fromOrdinal
  }
  const fromBareOrdinal = ORDINAL_STOREY[key]
  if (fromBareOrdinal != null) {
    return fromBareOrdinal
  }
  const numericSuffix = /^(\d+)(ST|ND|RD|TH)_FLOOR$/.exec(key)
  if (numericSuffix?.[1]) {
    return Number(numericSuffix[1])
  }
  const floorPrefix = /^FLOOR_(\d+)$/.exec(key)
  if (floorPrefix?.[1]) {
    return Number(floorPrefix[1])
  }
  const bareNumeric = /^(\d+)$/.exec(key)
  if (bareNumeric?.[1]) {
    const n = Number(bareNumeric[1])
    if (n >= 1) return n
  }
  return null
}

/**
 * Compare two floor position labels by architectural rank.
 * Equal ranks return 0 (callers use a stable sort for ties).
 */
export function compareExportFloorOrder(left: string | null | undefined, right: string | null | undefined): number {
  return getExportFloorRank(left) - getExportFloorRank(right)
}

/**
 * Return a new array sorted by architectural floor order.
 * Does not mutate the input. Preserves relative order for equal ranks.
 */
export function sortExportFloors<T extends ExportFloorOrderInput>(floors: readonly T[]): T[] {
  return floors
    .map((floor, index) => ({ floor, index }))
    .sort((a, b) => {
      const rankDiff = compareExportFloorOrder(a.floor.floorPosition, b.floor.floorPosition)
      if (rankDiff !== 0) return rankDiff
      return a.index - b.index
    })
    .map(({ floor }) => floor)
}
