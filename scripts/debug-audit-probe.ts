import { createPrismaClient } from "@workspace/database"
import { appendFileSync, existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const envCandidates = [
  resolve(process.cwd(), "packages/database/.env"),
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../../packages/database/.env"),
]
for (const envPath of envCandidates) {
  if (!existsSync(envPath)) continue
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!m) continue
    const key = m[1]!
    let val = m[2]!.trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = val
  }
  break
}

const logPath = "C:/sdv-books/projects/sdv-edutech-app/debug-10c5b7.log"
console.error("DATABASE_URL set?", Boolean(process.env.DATABASE_URL))
console.error("logPath", logPath)

const prisma = createPrismaClient()

function slog(message: string, data: unknown, hypothesisId = "DB") {
  const row = JSON.stringify({
    sessionId: "10c5b7",
    runId: "db-probe",
    hypothesisId,
    location: "scripts/debug-audit-probe.ts",
    message,
    data,
    timestamp: Date.now(),
  })
  appendFileSync(logPath, row + "\n")
  console.log(message)
}

async function main() {
  const surveys = await prisma.survey.findMany({
    where: {
      OR: [{ parcelNumber: "00595" }, { propertyId: { contains: "00595" } }],
      deletedAt: null,
    },
    take: 10,
    select: {
      id: true,
      propertyId: true,
      parcelNumber: true,
      legacySurveyId: true,
      createdAt: true,
      submittedAt: true,
      approvedAt: true,
      rejectedAt: true,
      surveyStatus: true,
      qcStatus: true,
      wardNumber: true,
      createdBy: { select: { fullName: true } },
      assignedTo: { select: { fullName: true } },
      ward: { select: { wardNumber: true, wardName: true } },
      ulb: { select: { name: true } },
      district: { select: { name: true } },
    },
  })

  slog(
    "surveys matching 00595",
    {
      count: surveys.length,
      surveys: surveys.map((s) => ({
        id: s.id,
        propertyId: s.propertyId,
        parcelNumber: s.parcelNumber,
        legacySurveyId: s.legacySurveyId,
        createdAt: s.createdAt,
        submittedAt: s.submittedAt,
        approvedAt: s.approvedAt,
        surveyStatus: s.surveyStatus,
        qcStatus: s.qcStatus,
        district: s.district?.name,
        ulb: s.ulb?.name,
        ward: s.ward?.wardNumber,
        createdBy: s.createdBy?.fullName,
        assignedTo: s.assignedTo?.fullName,
      })),
    },
    "A,B,D,E"
  )

  for (const s of surveys) {
    const audits = await prisma.surveyAudit.findMany({
      where: { surveyId: s.id },
      orderBy: { changedAt: "asc" },
      include: { changer: { select: { fullName: true } } },
    })
    slog(
      "survey_audits for survey",
      {
        surveyId: s.id,
        propertyId: s.propertyId,
        count: audits.length,
        rows: audits.map((a) => ({
          action: a.action,
          changedAt: a.changedAt,
          actor: a.changer?.fullName,
        })),
      },
      "A,B"
    )

    const legacy = s.legacySurveyId
    const eventWhere = legacy ? { OR: [{ resourceId: legacy }, { resourceId: s.id }] } : { resourceId: s.id }

    let events: Array<{
      eventId: string
      action: string
      occurredAt: Date
      actorId: string | null
      resourceId: string | null
      metadata: unknown
      createdAt: Date
    }> = []
    try {
      events = await prisma.auditEvent.findMany({
        where: eventWhere,
        orderBy: { occurredAt: "asc" },
        take: 50,
        select: {
          eventId: true,
          action: true,
          occurredAt: true,
          actorId: true,
          resourceId: true,
          metadata: true,
          createdAt: true,
        },
      })
    } catch (e) {
      slog("auditEvent query failed", { error: String(e) }, "C")
    }

    slog(
      "audit_events for survey",
      {
        surveyId: s.id,
        legacySurveyId: legacy,
        count: events.length,
        rows: events.map((e) => {
          const meta = e.metadata
          const actorName =
            meta && typeof meta === "object" && meta !== null && "actorName" in meta
              ? (meta as { actorName?: unknown }).actorName
              : null
          return {
            eventId: e.eventId,
            action: e.action,
            occurredAt: e.occurredAt,
            createdAt: e.createdAt,
            actorId: e.actorId,
            resourceId: e.resourceId,
            actorName,
          }
        }),
      },
      "C,E"
    )
  }

  const totalEvents = await prisma.auditEvent.count().catch((e: unknown) => ({ error: String(e) }))
  const sampleActions = await prisma.auditEvent
    .groupBy({ by: ["action"], _count: true })
    .catch((e: unknown) => ({ error: String(e) }))
  slog("audit_events table summary", { totalEvents, sampleActions }, "C")
}

main()
  .catch((err) => {
    const error =
      err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : { value: String(err) }
    console.error("FULL_ERROR", error)
    slog("probe failed", { error }, "ERR")
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
