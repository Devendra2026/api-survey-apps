import type { AreaPair } from "../lib/area-summary"

export type AreaMeasurePairProps = {
  sqFt: number | null
  sqMeter: number | null
  editable?: boolean
  onCommit?: (pair: AreaPair) => void
}
