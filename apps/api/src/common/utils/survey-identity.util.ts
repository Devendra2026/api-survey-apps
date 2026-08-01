import { ConflictException } from "@nestjs/common"
import type { AssessmentYear, Prisma } from "@workspace/database"
import { randomUUID } from "node:crypto"

export type SurveyIdentityKey = {
  ulbId: string
  propertyId: string
  assessmentYear: AssessmentYear
  excludeId?: string
}

export type SurveyIdentityConflict = {
  id: string
  propertyId: string
  ulbId: string
  assessmentYear: AssessmentYear
  parcelNumber: string | null
  unitSubNo: string | null
  propertyUse: string | null
  wardId: string
  stateId: string
  districtId: string
  ulbCode: string | null
  wardNumber: string | null
}

export type SurveyIdentityDb = {
  survey: {
    findFirst: (args: {
      where: Prisma.SurveyWhereInput
      select?: Prisma.SurveySelect
    }) => Promise<SurveyIdentityConflict | null>
  }
}

export function surveyIdentityConflictMessage(propertyId: string, otherId: string): string {
  return `Property ID ${propertyId} already exists for this ULB and assessment year (survey ${otherId}).`
}

export function isPrismaUniqueConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002"
}

export function allocateTempPropertyId(prefix: "TEMP-SWAP" | "TEMP-RESTORE"): string {
  return `${prefix}-${randomUUID()}`
}

export async function findActiveSurveyIdentityConflict(
  db: SurveyIdentityDb,
  key: SurveyIdentityKey
): Promise<SurveyIdentityConflict | null> {
  return db.survey.findFirst({
    where: {
      ulbId: key.ulbId,
      propertyId: key.propertyId,
      assessmentYear: key.assessmentYear,
      deletedAt: null,
      ...(key.excludeId ? { NOT: { id: key.excludeId } } : {}),
    },
    select: {
      id: true,
      propertyId: true,
      ulbId: true,
      assessmentYear: true,
      parcelNumber: true,
      unitSubNo: true,
      propertyUse: true,
      wardId: true,
      stateId: true,
      districtId: true,
      ulbCode: true,
      wardNumber: true,
    },
  })
}

export async function assertActiveSurveyIdentityAvailable(db: SurveyIdentityDb, key: SurveyIdentityKey): Promise<void> {
  const conflict = await findActiveSurveyIdentityConflict(db, key)
  if (conflict) {
    throw new ConflictException(surveyIdentityConflictMessage(key.propertyId, conflict.id))
  }
}
