import { STEP_IDS, STEP_TITLES, type StepId, type StepProgress } from "./requirements.ts"

/**
 * Step jump rules for the survey wizard.
 *
 * Chip navigation stays free (existing field workflow: capture GPS outdoors, fill
 * property details later). Forward *Next* is gated separately via `canAdvanceFromStep`
 * using the same submit-blocking messages as `submitRequirements`.
 * Informational incompleteness never blocks navigation.
 */
export function canSelectStep(
  _from: StepId,
  _to: StepId,
  _progress: Record<StepId, StepProgress>,
): { allowed: true } | { allowed: false; reason: string } {
  return { allowed: true }
}

/** Whether the footer Next control may leave the current step. */
export function canAdvanceFromStep(
  from: StepId,
  progress: Record<StepId, StepProgress>,
): { allowed: true } | { allowed: false; reason: string } {
  const blocking = progress[from]?.missing ?? []
  if (blocking.length === 0) return { allowed: true }
  if (from === "property") {
    return {
      allowed: false,
      reason: "Select a ward and enter valid parcel and unit numbers to continue.",
    }
  }
  return {
    allowed: false,
    reason: `Complete required items on ${STEP_TITLES[from]} before continuing: ${blocking.join("; ")}`,
  }
}

/** Overall completion % from per-step filled/total (informational, not submit gates). */
export function overallCompletionPercent(progress: Record<StepId, StepProgress>): number {
  let filled = 0
  let total = 0
  for (const step of STEP_IDS) {
    filled += progress[step].filled
    total += progress[step].total
  }
  if (total === 0) return 0
  return Math.min(100, Math.round((filled / total) * 100))
}

export function nextStepId(current: StepId): StepId | null {
  const index = STEP_IDS.indexOf(current)
  if (index < 0 || index >= STEP_IDS.length - 1) return null
  return STEP_IDS[index + 1]!
}

export function previousStepId(current: StepId): StepId | null {
  const index = STEP_IDS.indexOf(current)
  if (index <= 0) return null
  return STEP_IDS[index - 1]!
}

export function stepOrdinal(step: StepId): { index: number; total: number; label: string } {
  const index = STEP_IDS.indexOf(step)
  return {
    index: index + 1,
    total: STEP_IDS.length,
    label: `Step ${index + 1} of ${STEP_IDS.length}`,
  }
}
