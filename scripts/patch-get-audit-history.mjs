import { readFileSync, writeFileSync } from "node:fs"

const path = "apps/api/src/surveys/surveys.service.ts"
let src = readFileSync(path, "utf8")
const start = src.indexOf("  async getAuditHistory(idOrPropertyId: string, user: AuthenticatedUser) {")
const end = src.indexOf("  async create(dto: CreateSurveyDto, user: AuthenticatedUser) {")
if (start < 0 || end < 0) {
  console.error("markers not found", start, end)
  process.exit(1)
}

const replacement = `  async getAuditHistory(idOrPropertyId: string, user: AuthenticatedUser) {
    if (isDemoSurveyPropertyId(idOrPropertyId)) {
      return getDemoAuditHistory()
    }
    const survey = await this.surveysRepository.findById(idOrPropertyId, user)
    const audits = await this.surveysRepository.listAudits(survey.id)
    const legacySurveyId =
      "legacySurveyId" in survey && typeof survey.legacySurveyId === "string" ? survey.legacySurveyId : null

    let legacyEvents: Array<{
      eventId: string
      action: string
      occurredAt: Date
      createdAt: Date
      actorId: string | null
      resourceId: string | null
      metadata: unknown
    }> = []
    try {
      if (legacySurveyId) {
        legacyEvents = await this.prisma.db.auditEvent.findMany({
          where: { resourceId: legacySurveyId },
          orderBy: { occurredAt: "desc" },
          take: 500,
          select: {
            eventId: true,
            action: true,
            occurredAt: true,
            createdAt: true,
            actorId: true,
            resourceId: true,
            metadata: true,
          },
        })
      }
    } catch {
      legacyEvents = []
    }

    const history = buildSurveyAuditHistoryFromSources({
      propertyId: survey.propertyId,
      legacyEvents,
      audits: audits.map((a) => ({
        action: a.action,
        changedAt: a.changedAt,
        changer: a.changer,
        actorDisplayName:
          "actorDisplayName" in a ? ((a as { actorDisplayName?: string | null }).actorDisplayName ?? null) : null,
        actorRole: "actorRole" in a ? ((a as { actorRole?: string | null }).actorRole ?? null) : null,
        details: "details" in a ? ((a as { details?: string | null }).details ?? null) : null,
        sourceEventId: "sourceEventId" in a ? ((a as { sourceEventId?: string | null }).sourceEventId ?? null) : null,
      })),
    })

    // #region agent log
    {
      const payload = {
        sessionId: "10c5b7",
        runId: "post-fix",
        hypothesisId: "A,C,D,E",
        location: "surveys.service.ts:getAuditHistory",
        message: "Audit history sources compared",
        data: {
          requestId: idOrPropertyId,
          surveyId: survey.id,
          propertyId: survey.propertyId,
          legacySurveyId,
          surveyCreatedAt: survey.createdAt?.toISOString?.() ?? null,
          surveySubmittedAt: survey.submittedAt?.toISOString?.() ?? null,
          surveyApprovedAt: survey.approvedAt?.toISOString?.() ?? null,
          surveyAuditsCount: audits.length,
          legacyEventsCount: legacyEvents.length,
          legacyEventActions: legacyEvents.slice(0, 20).map((e) => ({
            action: e.action,
            occurredAt: e.occurredAt.toISOString(),
            createdAt: e.createdAt.toISOString(),
            actorName:
              e.metadata && typeof e.metadata === "object" && e.metadata !== null && "actorName" in e.metadata
                ? (e.metadata as { actorName?: unknown }).actorName
                : null,
          })),
          historyRows: history,
          source: legacyEvents.length > 0 ? "audit_events" : "survey_audits",
        },
        timestamp: Date.now(),
      }
      fetch("http://127.0.0.1:7548/ingest/d4e91970-7ad5-429b-8326-a482939a5101", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "10c5b7" },
        body: JSON.stringify(payload),
      }).catch(() => {})
      try {
        const { appendFileSync } = await import("node:fs")
        appendFileSync("C:/sdv-books/projects/sdv-edutech-app/debug-10c5b7.log", JSON.stringify(payload) + "\n")
        appendFileSync("C:/sdv-books/projects/sdv-edutech-app/.cursor/debug-10c5b7.log", JSON.stringify(payload) + "\n")
      } catch {
        /* ignore */
      }
    }
    // #endregion

    return history
  }

`

src = src.slice(0, start) + replacement + src.slice(end)
writeFileSync(path, src)
console.log("ok", { start, end })
