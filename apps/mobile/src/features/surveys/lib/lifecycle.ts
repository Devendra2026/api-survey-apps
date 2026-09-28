import type { QcStatus, SurveyStatus } from "../types.ts"

/**
 * Field-facing view of the two-axis lifecycle (`surveyStatus` + `qcStatus`).
 * Same partition as the API `classifySurveyBucket`, with REJECTED and REOPENED shown to surveyors
 * as "needs correction" (both are corrected on the same survey id).
 */
export type FieldBucket = "draft" | "pendingQc" | "needsCorrection" | "approved"

export function fieldBucket(surveyStatus: SurveyStatus, qcStatus: QcStatus): FieldBucket {
  switch (surveyStatus) {
    case "DRAFT":
    case "IN_PROGRESS":
      return "draft"
    case "REOPENED":
    case "REJECTED":
      return "needsCorrection"
    case "APPROVED":
      return "approved"
    case "SUBMITTED":
      if (qcStatus === "APPROVED") return "approved"
      if (qcStatus === "REJECTED") return "needsCorrection"
      return "pendingQc"
    default: {
      const exhaustive: never = surveyStatus
      return exhaustive
    }
  }
}

export const FIELD_BUCKET_LABELS: Record<FieldBucket, string> = {
  draft: "Draft",
  pendingQc: "Under QC",
  needsCorrection: "Needs correction",
  approved: "Approved",
}

/** Statuses the API lets the creator/assignee edit (`EDITABLE` in SurveysService). */
export function isFieldEditable(surveyStatus: SurveyStatus): boolean {
  return surveyStatus === "DRAFT" || surveyStatus === "IN_PROGRESS" || surveyStatus === "REOPENED"
}

/** REJECTED must go through `POST /surveys/:id/reopen` before edits are accepted. */
export function needsReopenBeforeEdit(surveyStatus: SurveyStatus): boolean {
  return surveyStatus === "REJECTED"
}

export function canSubmit(surveyStatus: SurveyStatus): boolean {
  return isFieldEditable(surveyStatus)
}

/** Server message for a second submit of the same survey (`transitionStatus` conditional update). */
export function isAlreadySubmittedError(message: string): boolean {
  return /not in status|cannot submit survey in status submitted/i.test(message)
}
