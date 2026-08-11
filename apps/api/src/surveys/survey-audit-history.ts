import type { AuditHistoryDto } from "./dto/survey-view.dto.js"

export type PersistedSurveyAudit = {
  action: string
  changedAt: Date
  changer?: { fullName: string } | null
  actorDisplayName?: string | null
  actorRole?: string | null
  details?: string | null
  sourceEventId?: string | null
}

export type LegacyAuditEventRow = {
  eventId: string
  action: string
  occurredAt: Date
  createdAt?: Date
  actorId: string | null
  resourceId: string | null
  metadata: unknown
}

export type SurveyLifecycleTimestamps = {
  /** Nest row insert time — last resort only for Created. */
  rowCreatedAt: Date
  capturedAt?: Date | null
  clientUpdatedAt?: Date | null
  submittedAt?: Date | null
  approvedAt?: Date | null
  rejectedAt?: Date | null
  creatorName?: string | null
  surveyorName?: string | null
}

function formatWhen(value: Date): string {
  return value.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readMetaString(meta: unknown, keys: string[]): string | null {
  if (!isPlainObject(meta)) return null
  for (const key of keys) {
    const v = meta[key]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return null
}

/** Map Convex / Nest audit action codes to stable UI labels. */
export function formatAuditActionLabel(action: string): string {
  const normalized = action.trim()
  const known: Record<string, string> = {
    "survey.created": "Created",
    CREATED: "Created",
    IMPORTED: "Imported",
    "survey.submitted": "Submitted",
    SUBMITTED: "Submitted",
    "qc.approve": "QC Approved",
    APPROVED: "QC Approved",
    "qc.reject": "QC Rejected",
    REJECTED: "QC Rejected",
    "qc.reopened": "Reopened",
    REOPENED: "Reopened",
    "qc.remark_added": "QC Remark Added",
    "qc.remark_resolved": "QC Remark Resolved",
    "survey.deleted": "Deleted",
    DELETED: "Deleted",
    SURVEY_ASSIGNED: "Assigned",
    "survey.draft_reassigned": "Reassigned",
    "survey.qc_corrected": "QC Corrected",
    "survey.qc_identity_swapped": "Identity Swapped",
  }
  if (known[normalized]) return known[normalized]
  const upper = known[normalized.toUpperCase()]
  if (upper) return upper

  return normalized
    .replace(/^SURVEY_/i, "")
    .replace(/^survey\./i, "")
    .replace(/^qc\./i, "QC ")
    .split(/[._]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
}

function formatDetails(meta: unknown): string | null {
  return readMetaString(meta, ["comment", "reason", "message", "details", "body"])
}

export function mapLegacyAuditEventsToHistory(propertyId: string, events: LegacyAuditEventRow[]): AuditHistoryDto[] {
  const rows = events.map((event) => {
    const actor = readMetaString(event.metadata, ["actorName", "actor_name", "userName", "fullName"]) || "—"
    const role = readMetaString(event.metadata, ["actorRole", "role", "userRole"]) || "—"
    const details = formatDetails(event.metadata)
    return {
      propertyId,
      when: formatWhen(event.occurredAt),
      action: formatAuditActionLabel(event.action),
      actor,
      role,
      details: details ?? "—",
      sortAt: event.occurredAt.getTime(),
    }
  })
  rows.sort((a, b) => b.sortAt - a.sortAt)
  return rows.map(({ propertyId: pid, when, action, actor, role, details }) => ({
    propertyId: pid,
    when,
    action,
    actor,
    role,
    details,
  }))
}

export function mapPersistedAuditsToHistory(propertyId: string, audits: PersistedSurveyAudit[]): AuditHistoryDto[] {
  const rows = audits.map((audit) => ({
    propertyId,
    when: formatWhen(audit.changedAt),
    action: formatAuditActionLabel(audit.action),
    actor: audit.actorDisplayName?.trim() || audit.changer?.fullName?.trim() || "—",
    role: audit.actorRole?.trim() || "—",
    details: audit.details?.trim() || "—",
    sortAt: audit.changedAt.getTime(),
  }))
  rows.sort((a, b) => b.sortAt - a.sortAt)
  return rows.map(({ propertyId: pid, when, action, actor, role, details }) => ({
    propertyId: pid,
    when,
    action,
    actor,
    role,
    details,
  }))
}

function buildLifecycleFallback(propertyId: string, lifecycle: SurveyLifecycleTimestamps): AuditHistoryDto[] {
  const creator = lifecycle.creatorName?.trim() || "—"
  const surveyor = lifecycle.surveyorName?.trim() || creator
  const createdAt = lifecycle.capturedAt ?? lifecycle.clientUpdatedAt ?? lifecycle.rowCreatedAt

  type Row = AuditHistoryDto & { sortAt: number }
  const rows: Row[] = [
    {
      propertyId,
      when: formatWhen(createdAt),
      action: "Created",
      actor: creator,
      role: "Surveyor",
      details: "—",
      sortAt: createdAt.getTime(),
    },
  ]

  if (lifecycle.submittedAt) {
    rows.push({
      propertyId,
      when: formatWhen(lifecycle.submittedAt),
      action: "Submitted",
      actor: surveyor,
      role: "Surveyor",
      details: "—",
      sortAt: lifecycle.submittedAt.getTime(),
    })
  }
  if (lifecycle.approvedAt) {
    rows.push({
      propertyId,
      when: formatWhen(lifecycle.approvedAt),
      action: "QC Approved",
      actor: "—",
      role: "QC",
      details: "—",
      sortAt: lifecycle.approvedAt.getTime(),
    })
  }
  if (lifecycle.rejectedAt) {
    rows.push({
      propertyId,
      when: formatWhen(lifecycle.rejectedAt),
      action: "QC Rejected",
      actor: "—",
      role: "QC",
      details: "—",
      sortAt: lifecycle.rejectedAt.getTime(),
    })
  }

  rows.sort((a, b) => b.sortAt - a.sortAt)
  return rows.map(({ propertyId: pid, when, action, actor, role, details }) => ({
    propertyId: pid,
    when,
    action,
    actor,
    role,
    details,
  }))
}

/**
 * Source priority:
 * 1) Convex-migrated audit_events (occurredAt + actorName)
 * 2) Persisted survey_audits (all rows — do not drop to empty)
 * 3) Survey lifecycle timestamps preserved from Convex (submittedAt/approvedAt/capturedAt)
 */
export function buildSurveyAuditHistoryFromSources(args: {
  propertyId: string
  legacyEvents: LegacyAuditEventRow[]
  audits: PersistedSurveyAudit[]
  lifecycle?: SurveyLifecycleTimestamps
}): AuditHistoryDto[] {
  if (args.legacyEvents.length > 0) {
    return mapLegacyAuditEventsToHistory(args.propertyId, args.legacyEvents)
  }

  if (args.audits.length > 0) {
    return mapPersistedAuditsToHistory(args.propertyId, args.audits)
  }

  if (args.lifecycle) {
    return buildLifecycleFallback(args.propertyId, args.lifecycle)
  }

  return []
}
