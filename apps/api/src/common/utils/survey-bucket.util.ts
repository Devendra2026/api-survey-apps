import type { QcStatus, SurveyStatus } from "@workspace/database"

/**
 * Mutually exclusive lifecycle buckets used by the Field and QC Command Centers.
 * Keeping them disjoint is what lets totals be summed without double counting.
 */
export type SurveyBucket = "fieldDraft" | "pendingQc" | "approved" | "returned" | "rework"

export type SurveyStatusRow = {
  surveyStatus: SurveyStatus
  qcStatus: QcStatus
  _count: { _all: number }
}

export type SurveyBucketTotals = Record<SurveyBucket, number> & { total: number }

/**
 * `qcStatus` is an independent axis (legacy Convex imports can carry a QC decision
 * while `surveyStatus` is still SUBMITTED), so it only breaks the SUBMITTED tie.
 */
export function classifySurveyBucket(row: { surveyStatus: SurveyStatus; qcStatus: QcStatus }): SurveyBucket {
  switch (row.surveyStatus) {
    case "DRAFT":
    case "IN_PROGRESS":
      return "fieldDraft"
    case "REOPENED":
      return "rework"
    case "REJECTED":
      return "returned"
    case "APPROVED":
      return "approved"
    case "SUBMITTED":
      if (row.qcStatus === "APPROVED") return "approved"
      if (row.qcStatus === "REJECTED") return "returned"
      return "pendingQc"
    default: {
      const exhaustive: never = row.surveyStatus
      return exhaustive
    }
  }
}

export function emptyBucketTotals(): SurveyBucketTotals {
  return { fieldDraft: 0, pendingQc: 0, approved: 0, returned: 0, rework: 0, total: 0 }
}

export function addSurveyRowToBuckets(totals: SurveyBucketTotals, row: SurveyStatusRow): void {
  const count = row._count._all
  totals[classifySurveyBucket(row)] += count
  totals.total += count
}

export function tallySurveyBuckets(rows: Iterable<SurveyStatusRow>): SurveyBucketTotals {
  const totals = emptyBucketTotals()
  for (const row of rows) {
    addSurveyRowToBuckets(totals, row)
  }
  return totals
}

export function percentOf(part: number, whole: number): number {
  if (whole <= 0) return 0
  return Math.round((part / whole) * 100)
}
