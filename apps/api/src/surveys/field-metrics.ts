import type { QcStatus, SurveyStatus } from "@workspace/database"
import {
  addSurveyRowToBuckets,
  emptyBucketTotals,
  type SurveyBucketTotals,
} from "../common/utils/survey-bucket.util.js"

export type FieldMetricsScope = "self" | "team"

export type FieldMetricsTotals = SurveyBucketTotals & {
  createdToday: number
  submittedToday: number
  /** Pending QC surveys that were returned and reopened at least once (same survey id). */
  resubmitted: number
}

export type FieldMetricsWard = {
  wardId: string
  wardNumber: string | null
  wardName: string | null
  ulbName: string | null
  totals: SurveyBucketTotals
}

export type FieldMetricsSurveyor = {
  userId: string
  fullName: string
  wards: string[]
  totals: SurveyBucketTotals
  createdToday: number
  submittedToday: number
  lastActivityAt: string | null
}

export type FieldMetricsResult = {
  scope: FieldMetricsScope
  todayStart: string
  totals: FieldMetricsTotals
  wards: FieldMetricsWard[]
  surveyors: FieldMetricsSurveyor[]
  assignedSurveyorCount: number | null
  activeSurveyorCount: number | null
}

export type StatusGroupRow = {
  wardId: string
  assignedToId: string | null
  surveyStatus: SurveyStatus
  qcStatus: QcStatus
  _count: { _all: number }
}

export type TodayGroupRow = {
  assignedToId: string | null
  _count: { _all: number }
}

export type WardInfo = { id: string; wardNumber: string | null; wardName: string | null; ulbName: string | null }

export type SurveyorInfo = { userId: string; fullName: string; wards: string[] }

export type BuildFieldMetricsInput = {
  scope: FieldMetricsScope
  todayStart: Date
  statusRows: StatusGroupRow[]
  createdTodayRows: TodayGroupRow[]
  submittedTodayRows: TodayGroupRow[]
  resubmitted: number
  wards: WardInfo[]
  /** Team scope only: surveyors assigned in scope (from UserTenantRole) plus any assignee with surveys in scope. */
  surveyors: SurveyorInfo[]
  lastActivityByUser: Map<string, Date>
  assignedSurveyorCount: number | null
}

function sumToday(rows: TodayGroupRow[]): number {
  return rows.reduce((sum, row) => sum + row._count._all, 0)
}

function todayByUser(rows: TodayGroupRow[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of rows) {
    if (!row.assignedToId) continue
    map.set(row.assignedToId, (map.get(row.assignedToId) ?? 0) + row._count._all)
  }
  return map
}

/**
 * Folds grouped survey counts into the mobile Field dashboard shape.
 * Buckets reuse `classifySurveyBucket`, so these numbers match the web Command Center.
 */
export function buildFieldMetrics(input: BuildFieldMetricsInput): FieldMetricsResult {
  const totals = emptyBucketTotals()
  const byWard = new Map<string, SurveyBucketTotals>()
  const byUser = new Map<string, SurveyBucketTotals>()

  for (const row of input.statusRows) {
    addSurveyRowToBuckets(totals, row)

    const wardTotals = byWard.get(row.wardId) ?? emptyBucketTotals()
    addSurveyRowToBuckets(wardTotals, row)
    byWard.set(row.wardId, wardTotals)

    if (row.assignedToId) {
      const userTotals = byUser.get(row.assignedToId) ?? emptyBucketTotals()
      addSurveyRowToBuckets(userTotals, row)
      byUser.set(row.assignedToId, userTotals)
    }
  }

  const wardInfo = new Map(input.wards.map((w) => [w.id, w]))
  const wards: FieldMetricsWard[] = [...byWard.entries()]
    .map(([wardId, wardTotals]) => {
      const info = wardInfo.get(wardId)
      return {
        wardId,
        wardNumber: info?.wardNumber ?? null,
        wardName: info?.wardName ?? null,
        ulbName: info?.ulbName ?? null,
        totals: wardTotals,
      }
    })
    .sort((a, b) => b.totals.total - a.totals.total)

  const createdTodayByUser = todayByUser(input.createdTodayRows)
  const submittedTodayByUser = todayByUser(input.submittedTodayRows)

  const surveyors: FieldMetricsSurveyor[] =
    input.scope === "team"
      ? input.surveyors
          .map((s) => ({
            userId: s.userId,
            fullName: s.fullName,
            wards: s.wards,
            totals: byUser.get(s.userId) ?? emptyBucketTotals(),
            createdToday: createdTodayByUser.get(s.userId) ?? 0,
            submittedToday: submittedTodayByUser.get(s.userId) ?? 0,
            lastActivityAt: input.lastActivityByUser.get(s.userId)?.toISOString() ?? null,
          }))
          .sort((a, b) => b.totals.total - a.totals.total || a.fullName.localeCompare(b.fullName))
      : []

  const activeSurveyorCount =
    input.scope === "team"
      ? surveyors.filter((s) => {
          const last = input.lastActivityByUser.get(s.userId)
          return Boolean(last && last >= input.todayStart)
        }).length
      : null

  return {
    scope: input.scope,
    todayStart: input.todayStart.toISOString(),
    totals: {
      ...totals,
      createdToday: sumToday(input.createdTodayRows),
      submittedToday: sumToday(input.submittedTodayRows),
      resubmitted: input.resubmitted,
    },
    wards,
    surveyors,
    assignedSurveyorCount: input.assignedSurveyorCount,
    activeSurveyorCount,
  }
}

/** Client may pass its local midnight; anything invalid or in the future falls back to UTC midnight. */
export function resolveTodayStart(raw: string | undefined, now: Date = new Date()): Date {
  const utcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  if (!raw) return utcMidnight
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return utcMidnight
  const dayMs = 24 * 60 * 60 * 1000
  if (parsed > now || now.getTime() - parsed.getTime() > dayMs + 60 * 60 * 1000) return utcMidnight
  return parsed
}
