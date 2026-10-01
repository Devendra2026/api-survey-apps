import { ConflictException } from "@nestjs/common"
import { isZeroWardName, normalizeWardNumber, ZERO_WARD_NAME, ZERO_WARD_NUMBER } from "@workspace/validation"
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

/** Active Zero Ward for a ULB. Does not create one. */
export async function findActiveZeroWard(db: ZeroWardDb, ulbId: string): Promise<WardRow | null> {
  return db.ward.findFirst({
    where: { ulbId, kind: "ZERO", deletedAt: null },
    select: wardSelect,
  })
}

/**
 * Admin-only insert: number "0", name "Zero Ward", kind ZERO.
 * Does not adopt or relabel an existing geographic ward. Does not update surveys.
 */
export async function createZeroWard(db: ZeroWardDb, ulbId: string): Promise<WardRow> {
  const existing = await findActiveZeroWard(db, ulbId)
  if (existing) {
    throw new ConflictException("This ULB already has an active Zero Ward.")
  }

  const active = await db.ward.findMany({
    where: { ulbId, deletedAt: null },
    select: wardSelect,
  })
  if (active.some((ward) => normalizeWardNumber(ward.wardNumber) === ZERO_WARD_NUMBER)) {
    throw new ConflictException("Cannot create Zero Ward — ward number 0 is already used by another ward.")
  }
  if (active.some((ward) => isZeroWardName(ward.wardName))) {
    throw new ConflictException("Cannot create Zero Ward — the name Zero Ward is already used by another ward.")
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
    const raced = await findActiveZeroWard(db, ulbId)
    if (raced) throw new ConflictException("This ULB already has an active Zero Ward.")
    throw new ConflictException("Cannot create Zero Ward — ward number 0 is already used by another ward.")
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
