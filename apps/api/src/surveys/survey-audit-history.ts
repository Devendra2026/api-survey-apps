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

/** Lookup keys extracted from audit_events metadata for Nest User join. */
export type AuditActorLookupKeys = {
  clerkIds: string[]
  emails: string[]
}

export type ResolveAuditActorName = (event: LegacyAuditEventRow) => string | null

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

/** Infer Role column when Convex/Nest metadata has no actorRole. */
export function inferAuditRoleFromAction(action: string): string {
  const normalized = action.trim()
  const upper = normalized.toUpperCase()
  if (
    normalized === "survey.created" ||
    normalized === "survey.submitted" ||
    upper === "CREATED" ||
    upper === "SUBMITTED"
  ) {
    return "Surveyor"
  }
  if (
    normalized === "qc.approve" ||
    normalized === "qc.reject" ||
    upper === "APPROVED" ||
    upper === "REJECTED" ||
    normalized.startsWith("qc.")
  ) {
    return "QC"
  }
  return "—"
}

function formatDetails(meta: unknown): string | null {
  return readMetaString(meta, ["comment", "reason", "message", "details", "body"])
}

export function readLegacyActorNameFromMetadata(metadata: unknown): string | null {
  return readMetaString(metadata, ["actorName", "actor_name", "userName", "fullName"])
}

export function readLegacyActorClerkId(metadata: unknown): string | null {
  return readMetaString(metadata, ["actorClerkId", "actor_clerk_id", "clerkId", "clerk_id"])
}

export function readLegacyActorEmail(metadata: unknown): string | null {
  return readMetaString(metadata, ["actorEmail", "actor_email", "email"])
}

/** Collect clerk/email keys for batch Nest User lookup. */
export function collectAuditActorLookupKeys(events: LegacyAuditEventRow[]): AuditActorLookupKeys {
  const clerkIds = new Set<string>()
  const emails = new Set<string>()
  for (const event of events) {
    if (readLegacyActorNameFromMetadata(event.metadata)) continue
    const clerkId = readLegacyActorClerkId(event.metadata)
    const email = readLegacyActorEmail(event.metadata)
    if (clerkId) clerkIds.add(clerkId)
    if (email) emails.add(email.toLowerCase())
  }
  return { clerkIds: [...clerkIds], emails: [...emails] }
}

/**
 * Resolve display name: metadata.actorName → Nest User (via resolve) → "—".
 * Never invents survey.createdBy.
 */
export function resolveLegacyEventActorName(
  event: LegacyAuditEventRow,
  resolveFromUsers?: ResolveAuditActorName
): string {
  const fromMeta = readLegacyActorNameFromMetadata(event.metadata)
  if (fromMeta) return fromMeta
  const fromUsers = resolveFromUsers?.(event)?.trim()
  if (fromUsers) return fromUsers
  return "—"
}

export function resolveLegacyEventRole(event: LegacyAuditEventRow): string {
  return readMetaString(event.metadata, ["actorRole", "role", "userRole"]) || inferAuditRoleFromAction(event.action)
}

export function mapLegacyAuditEventsToHistory(
  propertyId: string,
  events: LegacyAuditEventRow[],
  resolveFromUsers?: ResolveAuditActorName
): AuditHistoryDto[] {
  const rows = events.map((event) => {
    const actor = resolveLegacyEventActorName(event, resolveFromUsers)
    const role = resolveLegacyEventRole(event)
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
    role: audit.actorRole?.trim() || inferAuditRoleFromAction(audit.action),
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

export function buildLifecycleFallback(propertyId: string, lifecycle: SurveyLifecycleTimestamps): AuditHistoryDto[] {
  const creator = lifecycle.creatorName?.trim() || "—"
  const surveyor = lifecycle.surveyorName?.trim() || (creator !== "—" ? creator : "—")
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
 * 1) Convex-migrated audit_events (occurredAt + actorName / Nest Users hydrate)
 * 2) Nest survey_audits excluding import seeds (IMPORTED / IMPORT_UPDATED)
 * 3) Survey lifecycle timestamps preserved from Convex (submittedAt/approvedAt/capturedAt)
 *
 * Import seeds use the importer as changedBy — never treat them as the historical actor.
 */
const IMPORT_SEED_ACTIONS = new Set(["IMPORTED", "IMPORT_UPDATED"])

function isImportSeedAction(action: string): boolean {
  return IMPORT_SEED_ACTIONS.has(action.trim().toUpperCase())
}

export function buildSurveyAuditHistoryFromSources(args: {
  propertyId: string
  legacyEvents: LegacyAuditEventRow[]
  audits: PersistedSurveyAudit[]
  lifecycle?: SurveyLifecycleTimestamps
  resolveActorName?: ResolveAuditActorName
}): AuditHistoryDto[] {
  if (args.legacyEvents.length > 0) {
    return mapLegacyAuditEventsToHistory(args.propertyId, args.legacyEvents, args.resolveActorName)
  }

  const nestAudits = args.audits.filter((a) => !isImportSeedAction(a.action))

  if (nestAudits.length > 0) {
    return mapPersistedAuditsToHistory(args.propertyId, nestAudits)
  }

  if (args.lifecycle) {
    return buildLifecycleFallback(args.propertyId, args.lifecycle)
  }

  return []
}
