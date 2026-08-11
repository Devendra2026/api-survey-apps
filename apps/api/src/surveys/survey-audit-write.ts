import type { Prisma } from "@workspace/database"
import { randomBytes } from "node:crypto"

type SurveyAuditWriteClient = {
  $executeRawUnsafe: (query: string, ...values: unknown[]) => Promise<number>
}

export type SurveyAuditWriteInput = {
  surveyId: string
  action: string
  changedBy: string
  oldValue?: Prisma.InputJsonValue | null
  newValue?: Prisma.InputJsonValue | null
  changedAt?: Date
}

function newSurveyAuditId(): string {
  // Nest-native id (Prisma uses cuid(); hex token is unique and FK-safe).
  return `c${randomBytes(12).toString("hex")}`
}

/**
 * Insert into survey_audits using only columns that exist before
 * migration `20260811120000_survey_audit_legacy_fields`.
 *
 * Avoids Prisma Client `create()` which SELECTs/INSERTs newer columns
 * (`createdAt`, `sourceEventId`, …) and breaks QC save/approve in production
 * when the API is deployed ahead of migrate.
 */
export async function createSurveyAuditRow(db: SurveyAuditWriteClient, data: SurveyAuditWriteInput) {
  const id = newSurveyAuditId()
  const changedAt = data.changedAt ?? new Date()
  const oldValueJson = data.oldValue === undefined ? null : JSON.stringify(data.oldValue)
  const newValueJson = data.newValue === undefined ? null : JSON.stringify(data.newValue)

  await db.$executeRawUnsafe(
    `INSERT INTO "survey_audits" ("id", "surveyId", "action", "oldValue", "newValue", "changedBy", "changedAt")
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7)`,
    id,
    data.surveyId,
    data.action,
    oldValueJson,
    newValueJson,
    data.changedBy,
    changedAt
  )

  return { id }
}
