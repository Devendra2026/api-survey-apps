import { emptyEtlJobStats, type EtlJobStats } from "../domain/types.js"

export function finalizeJobStats(
  partial: Partial<EtlJobStats>,
  startedAtMs: number,
  finishedAtMs = Date.now()
): EtlJobStats {
  const base = { ...emptyEtlJobStats(), ...partial }
  const executionTimeMs = Math.max(0, finishedAtMs - startedAtMs)
  const processed = base.imported + base.skipped + base.duplicates + base.failed
  const avgSurveyMs = processed > 0 ? executionTimeMs / processed : 0
  const surveysPerMinute =
    executionTimeMs > 0 ? (processed / executionTimeMs) * 60_000 : 0

  return {
    ...base,
    executionTimeMs,
    avgSurveyMs: Math.round(avgSurveyMs * 100) / 100,
    surveysPerMinute: Math.round(surveysPerMinute * 100) / 100,
  }
}

export function mergeStats(a: EtlJobStats, b: Partial<EtlJobStats>): EtlJobStats {
  return {
    imported: a.imported + (b.imported ?? 0),
    skipped: a.skipped + (b.skipped ?? 0),
    duplicates: a.duplicates + (b.duplicates ?? 0),
    failed: a.failed + (b.failed ?? 0),
    imagesDownloaded: a.imagesDownloaded + (b.imagesDownloaded ?? 0),
    imagesUploaded: a.imagesUploaded + (b.imagesUploaded ?? 0),
    missingImages: a.missingImages + (b.missingImages ?? 0),
    executionTimeMs: b.executionTimeMs ?? a.executionTimeMs,
    avgSurveyMs: b.avgSurveyMs ?? a.avgSurveyMs,
    surveysPerMinute: b.surveysPerMinute ?? a.surveysPerMinute,
  }
}
