import type { PrismaClient } from "@workspace/database"

type AuditEventRow = {
  eventId: string
  action: string
  occurredAt: Date
  actorId: string | null
  resourceId: string | null
  metadata: unknown
}

function readActorName(meta: unknown): string | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null
  const actorName = (meta as { actorName?: unknown }).actorName
  return typeof actorName === "string" && actorName.trim() ? actorName.trim() : null
}

function readActorRole(meta: unknown): string | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null
  const role = (meta as { actorRole?: unknown; role?: unknown }).actorRole ?? (meta as { role?: unknown }).role
  return typeof role === "string" && role.trim() ? role.trim() : null
}

/**
 * Idempotently materialize Convex audit_events into survey_audits for a survey.
 * Uses sourceEventId as the unique key. Preserves occurredAt as changedAt.
 */
export async function materializeSurveyAuditsFromEvents(args: {
  prisma: PrismaClient
  surveyId: string
  changedByFallbackUserId: string
  events: AuditEventRow[]
}): Promise<{ upserted: number }> {
  let upserted = 0
  for (const event of args.events) {
    await args.prisma.surveyAudit.upsert({
      where: { sourceEventId: event.eventId },
      create: {
        surveyId: args.surveyId,
        action: event.action,
        changedBy: args.changedByFallbackUserId,
        changedAt: event.occurredAt,
        sourceEventId: event.eventId,
        actorDisplayName: readActorName(event.metadata),
        actorRole: readActorRole(event.metadata),
        newValue: {
          source: "convex_audit_events",
          resourceId: event.resourceId,
          actorId: event.actorId,
        },
      },
      update: {
        // Immutable: do not overwrite historical timestamp/actor once inserted.
      },
    })
    upserted += 1
  }
  return { upserted }
}
