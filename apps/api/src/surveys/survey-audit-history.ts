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

function formatDetails(meta: unknown, changesBefore: unknown, changesAfter: unknown): string | null {
  const comment = readMetaString(meta, ["comment", "reason", "message", "details"])
  if (comment) return comment
  if (changesBefore == null && changesAfter == null) return null
  try {
    return JSON.stringify({ before: changesBefore ?? null, after: changesAfter ?? null })
  } catch {
    return null
  }
}

export function mapLegacyAuditEventsToHistory(propertyId: string, events: LegacyAuditEventRow[]): AuditHistoryDto[] {
  const rows = events.map((event) => {
    const actor = readMetaString(event.metadata, ["actorName", "actor_name", "userName", "fullName"]) || "—"
    const role = readMetaString(event.metadata, ["actorRole", "role", "userRole"]) || "—"
    const details = formatDetails(event.metadata, null, null)
    return {
      propertyId,
      when: formatWhen(event.occurredAt),
      action: formatAuditActionLabel(event.action),
      actor,
      role,
      details: details ?? "—",
      sortAt: event.occurredAt.getTime(),
      sourceEventId: event.eventId,
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

/**
 * Prefer immutable Convex-migrated audit_events. Never invent rows from survey timestamps.
 * Fall back to persisted survey_audits only when no legacy events exist for the survey.
 * For Convex-migrated surveys, ignore CREATED/SUBMITTED rows that lack sourceEventId
 * (those are Nest import seeds with migration timestamps).
 */
export function buildSurveyAuditHistoryFromSources(args: {
  propertyId: string
  legacyEvents: LegacyAuditEventRow[]
  audits: PersistedSurveyAudit[]
  /** When true, drop import-seed CREATED/SUBMITTED/IMPORTED rows without sourceEventId. */
  isLegacyMigratedSurvey?: boolean
}): AuditHistoryDto[] {
  if (args.legacyEvents.length > 0) {
    return mapLegacyAuditEventsToHistory(args.propertyId, args.legacyEvents)
  }

  const withSource = args.audits.filter((a) => Boolean(a.sourceEventId))
  const usable =
    withSource.length > 0
      ? withSource
      : args.isLegacyMigratedSurvey
        ? args.audits.filter((a) => !isSyntheticImportSeed(a))
        : args.audits
  return mapPersistedAuditsToHistory(args.propertyId, usable)
}

function isSyntheticImportSeed(audit: PersistedSurveyAudit): boolean {
  if (audit.sourceEventId) return false
  const action = audit.action
    .replace(/^SURVEY_/i, "")
    .replace(/^survey\./i, "")
    .toUpperCase()
  return action === "CREATED" || action === "SUBMITTED" || action === "IMPORTED"
}
