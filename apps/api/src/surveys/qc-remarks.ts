import type { QcCorrectionItemDto, RejectSurveyDto } from "./dto/survey.dto.js"
import type { QcRemarkInput } from "./surveys.repository.js"

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/** One general remark (the summary text) plus one row per structured correction. */
export function buildQcRemarkRows(dto: RejectSurveyDto): QcRemarkInput[] {
  const rows: QcRemarkInput[] = []
  const summary = dto.qcRemarks.trim()
  if (summary) rows.push({ body: summary, section: null, field: null, reason: null })

  for (const item of dto.corrections ?? []) {
    const field = clean(item.field)
    const reason = clean(item.reason)
    const note = clean(item.note)
    const body = note ?? [field, reason].filter((part): part is string => part !== null).join(": ")
    rows.push({ body: body || item.section, section: item.section, field, reason })
  }
  return rows
}

export function correctionsAuditValue(items: QcCorrectionItemDto[]) {
  return items.map((item) => ({
    section: item.section,
    field: clean(item.field),
    reason: clean(item.reason),
    note: clean(item.note),
  }))
}
