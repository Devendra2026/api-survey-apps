import { isZeroWardName, ZERO_WARD_NAME, ZERO_WARD_NUMBER } from "@workspace/validation"
import { isPrismaUniqueConflict } from "../utils/survey-identity.util.js"

type WardRow = {
  id: string
  ulbId: string
  wardNumber: string
  wardName: string
  kind: "GEOGRAPHIC" | "ZERO"
}

type ZeroWardDb = {
  ward: {
    findFirst: (args: { where: Record<string, unknown>; select?: Record<string, boolean> }) => Promise<WardRow | null>
    findMany: (args: { where: Record<string, unknown>; select?: Record<string, boolean> }) => Promise<WardRow[]>
    update: (args: { where: { id: string }; data: { kind: "ZERO" } }) => Promise<WardRow>
    create: (args: { data: { ulbId: string; wardNumber: string; wardName: string; kind: "ZERO" } }) => Promise<WardRow>
  }
}

const wardSelect = {
  id: true,
  ulbId: true,
  wardNumber: true,
  wardName: true,
  kind: true,
} as const

/**
 * Idempotent: one active Zero Ward per ULB.
 * Adopts an existing uniquely named "zero ward" without changing its number or surveys.
 * Otherwise creates wardNumber "0". Never updates survey rows.
 */
export async function ensureZeroWard(db: ZeroWardDb, ulbId: string): Promise<WardRow> {
  const existing = await db.ward.findFirst({
    where: { ulbId, kind: "ZERO", deletedAt: null },
    select: wardSelect,
  })
  if (existing) return existing

  const active = await db.ward.findMany({
    where: { ulbId, deletedAt: null, status: "ACTIVE" },
    select: wardSelect,
  })
  const named = active.filter((ward) => isZeroWardName(ward.wardName))
  if (named.length === 1 && named[0]) {
    return db.ward.update({
      where: { id: named[0].id },
      data: { kind: "ZERO" },
    })
  }

  try {
    return await db.ward.create({
      data: {
        ulbId,
        wardNumber: ZERO_WARD_NUMBER,
        wardName: ZERO_WARD_NAME,
        kind: "ZERO",
      },
    })
  } catch (error) {
    if (!isPrismaUniqueConflict(error)) throw error
    const raced = await db.ward.findFirst({
      where: { ulbId, kind: "ZERO", deletedAt: null },
      select: wardSelect,
    })
    if (raced) return raced
    throw error
  }
}

export type UnresolvedQuarantineSurvey = {
  id: string
  propertyId: string
  parcelNumber: string | null
  unitSubNo: string | null
  surveyStatus: string
  currentWardId: string
  storedWardNumber: string | null
}

type UnresolvedDb = {
  survey: {
    findMany: (args: { where: Record<string, unknown>; select: Record<string, boolean> }) => Promise<
      Array<{
        id: string
        propertyId: string
        parcelNumber: string | null
        unitSubNo: string | null
        surveyStatus: string
        wardId: string
        wardNumber: string | null
      }>
    >
  }
}

/**
 * Read-only. Surveys sitting in a Zero Ward with no original ward.
 * Does not guess identity from parcel or Property ID. Not invoked on startup.
 */
export async function listUnresolvedQuarantineSurveys(
  db: UnresolvedDb,
  ulbId?: string
): Promise<UnresolvedQuarantineSurvey[]> {
  const rows = await db.survey.findMany({
    where: {
      deletedAt: null,
      originalWardId: null,
      ward: { kind: "ZERO", deletedAt: null },
      ...(ulbId ? { ulbId } : {}),
    },
    select: {
      id: true,
      propertyId: true,
      parcelNumber: true,
      unitSubNo: true,
      surveyStatus: true,
      wardId: true,
      wardNumber: true,
    },
  })
  return rows.map((row) => ({
    id: row.id,
    propertyId: row.propertyId,
    parcelNumber: row.parcelNumber,
    unitSubNo: row.unitSubNo,
    surveyStatus: row.surveyStatus,
    currentWardId: row.wardId,
    storedWardNumber: row.wardNumber,
  }))
}
