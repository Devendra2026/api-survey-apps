import { useState } from "react"
import {
  areaPairFromSource,
  formatAreaMeasure,
  parseAreaDraft,
  type AreaPair,
  type AreaUnit,
} from "../lib/area-summary"

type Draft = { unit: AreaUnit; text: string }

/**
 * Keeps the field being typed as entered, and commits a canonical pair so the
 * other unit can update on each parseable number.
 */
export function useAreaMeasureDraft(input: {
  sqFt: number | null
  sqMeter: number | null
  editable: boolean
  onCommit?: (pair: AreaPair) => void
}) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const apply = (unit: AreaUnit, text: string) => {
    if (!input.editable || !input.onCommit) return
    setDraft({ unit, text })
    const parsed = parseAreaDraft(text)
    if (parsed.kind === "invalid") {
      setError("Enter a valid number")
      return
    }
    setError(null)
    if (parsed.kind === "empty") {
      input.onCommit({ sqFt: null, sqMeter: null })
      return
    }
    if (parsed.value === null) return
    input.onCommit(areaPairFromSource(unit, parsed.value))
  }
  const blur = (unit: AreaUnit) => {
    setDraft((current) => (current?.unit === unit ? null : current))
  }
  const sqFtText = draft?.unit === "sqFt" ? draft.text : formatAreaMeasure(input.sqFt)
  const sqMeterText = draft?.unit === "sqMeter" ? draft.text : formatAreaMeasure(input.sqMeter)
  return { sqFtText, sqMeterText, error, apply, blur }
}
