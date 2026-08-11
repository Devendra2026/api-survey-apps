import { appendFileSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const envPath = resolve(root, "packages/database/.env")
const envText = readFileSync(envPath, "utf8")
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^DATABASE_URL=(.*)$/)
  if (!m) continue
  let v = m[1].trim()
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1)
  }
  process.env.DATABASE_URL = v
}

const require = createRequire(resolve(root, "packages/database/package.json"))
const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()
const logPath = resolve(root, "../debug-10c5b7.log")

function slog(message, data, hypothesisId = "DB") {
  const row = JSON.stringify({
    sessionId: "10c5b7",
    runId: "db-probe",
    hypothesisId,
    location: "scripts/debug-audit-probe.mjs",
    message,
    data,
    timestamp: Date.now(),
  })
  appendFileSync(logPath, row + "\n")
  console.log(message)
}

try {
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
    const eventWhere = legacy
      ? { OR: [{ resourceId: legacy }, { resourceId: s.id }] }
      : { resourceId: s.id }

    let events = []
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
        rows: events.map((e) => ({
          eventId: e.eventId,
          action: e.action,
          occurredAt: e.occurredAt,
          createdAt: e.createdAt,
          actorId: e.actorId,
          resourceId: e.resourceId,
          actorName:
            e.metadata && typeof e.metadata === "object" && e.metadata !== null && "actorName" in e.metadata
              ? e.metadata.actorName
              : null,
        })),
      },
      "C,E"
    )
  }

  const totalEvents = await prisma.auditEvent.count().catch((e) => ({ error: String(e) }))
  const sampleActions = await prisma.auditEvent
    .groupBy({ by: ["action"], _count: true })
    .catch((e) => ({ error: String(e) }))
  slog("audit_events table summary", { totalEvents, sampleActions }, "C")
} finally {
  await prisma.$disconnect()
}
