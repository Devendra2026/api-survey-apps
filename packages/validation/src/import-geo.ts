/**
 * Shared survey-import geography helpers.
 * Lookup is fail-closed: ULB/Ward masters must already exist.
 */

import { padUlbCode, padWardNo, parsePropertyId } from "./property-id.js"

/** Strip BOM / zero-width / NBSP / CR/LF / tabs, then trim. */
export function normalizeImportString(value: string | undefined | null): string {
  if (value == null) return ""
  return String(value)
    .replace(/^\uFEFF/, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/[\r\n\t]+/g, " ")
    .trim()
}

export function emptyToUndefinedNormalized(value: string | undefined | null): string | undefined {
  const normalized = normalizeImportString(value)
  return normalized === "" ? undefined : normalized
}

/** Canonical ward storage form: unpadded numeric string when possible (matches seed "1"/"2"). */
export function canonicalWardNumber(wardNo: string): string {
  const normalized = normalizeImportString(wardNo)
  const digits = normalized.replace(/\D/g, "")
  if (!digits) return normalized
  const n = Number.parseInt(digits, 10)
  return Number.isNaN(n) ? normalized : String(n)
}

export function buildWardCandidates(wardNumberRaw: string): string[] {
  const raw = normalizeImportString(wardNumberRaw)
  if (!raw) return []
  const padded = padWardNo(raw)
  const unpadded = canonicalWardNumber(raw)
  return [...new Set([raw, padded, unpadded].filter(Boolean))]
}

export function resolveUlbLookupCodes(ulbCodeRaw: string): string[] {
  const raw = normalizeImportString(ulbCodeRaw)
  if (!raw) return []
  const padded = padUlbCode(raw)
  return [...new Set([padded || raw, raw].filter(Boolean))]
}

export type GeoResolveReason = "OK" | "ULB_NOT_FOUND" | "WARD_NOT_FOUND" | "WARD_OTHER_ULB" | "MISSING_INPUT"

export interface GeoResolved {
  stateId: string
  districtId: string
  ulbId: string
  wardId: string
  ulbCode: string
  wardNumber: string
}

export type GeoResolveResult =
  | {
      ok: true
      reason: "OK"
      geo: GeoResolved
      lookupCode: string
      wardCandidates: string[]
    }
  | {
      ok: false
      reason: Exclude<GeoResolveReason, "OK">
      lookupCode: string
      wardCandidates: string[]
      message: string
      otherUlbCode?: string
    }

export function formatGeoResolveError(result: Extract<GeoResolveResult, { ok: false }>): string {
  return result.message
}

export function geoErrorMessage(
  reason: Exclude<GeoResolveReason, "OK">,
  ulbCode: string,
  wardCandidates: string[],
  otherUlbCode?: string
): string {
  switch (reason) {
    case "MISSING_INPUT":
      return "Missing ULB Code or Ward Number"
    case "ULB_NOT_FOUND":
      return `ULB master data is missing for code ${ulbCode}. Import ULB master (POST /imports/geo-catalog) before importing surveys.`
    case "WARD_NOT_FOUND":
      return `Ward master data is missing for ULB ${ulbCode}: tried ${wardCandidates.join(", ") || "(empty)"}. Import wards for this ULB before importing surveys.`
    case "WARD_OTHER_ULB":
      return `Ward exists under a different ULB (${otherUlbCode ?? "unknown"}), not under ${ulbCode}: tried ${wardCandidates.join(", ")}`
    default:
      return `Could not resolve ULB code + ward: ${ulbCode} / ${wardCandidates[0] ?? ""}`
  }
}

/** Human-readable abort message when workbook references ULBs that are not seeded. */
export function formatMissingUlbMasterAbort(missingUlbCodes: string[]): string {
  const codes = [...new Set(missingUlbCodes.map((c) => normalizeImportString(c)).filter(Boolean))].sort()
  return `ULB master data is missing. Import ULB master before importing surveys. Missing codes: ${codes.join(", ")}`
}

/**
 * When Excel ULB/Ward and a parseable Property ID both exist, they must agree
 * (after padding). Fail-closed — do not silently prefer Excel over the ID.
 */
export function checkPropertyIdGeoConsistency(args: {
  propertyId?: string
  excelUlbCode?: string
  excelWardNumber?: string
}): string | undefined {
  const parsed = parsePropertyId(args.propertyId)
  if (!parsed) return undefined

  const excelUlb = emptyToUndefinedNormalized(args.excelUlbCode)
  const excelWard = emptyToUndefinedNormalized(args.excelWardNumber)
  if (!excelUlb && !excelWard) return undefined

  if (excelUlb) {
    const excelPadded = padUlbCode(excelUlb) || normalizeImportString(excelUlb).toUpperCase()
    const idUlb = parsed.ulbCode
    if (excelPadded && excelPadded !== idUlb) {
      return `Property ID ULB (${idUlb}) does not match Excel ULB Code (${excelUlb})`
    }
  }

  if (excelWard) {
    const excelPadded = padWardNo(excelWard)
    const idWard = parsed.wardNo
    if (excelPadded && excelPadded !== idWard) {
      return `Property ID ward (${idWard}) does not match Excel Ward Number (${excelWard})`
    }
  }

  return undefined
}

/** Minimal DB surface for geography lookup (Prisma-compatible). */
export interface GeoLookupDb {
  ulb: {
    findFirst: (args: { where: { code: string }; include: { district: true } }) => Promise<{
      id: string
      code: string
      districtId: string
      district: { stateId: string }
    } | null>
  }
  ward: {
    findFirst: (args: { where: { ulbId?: string; wardNumber: { in: string[] } }; include?: { ulb: true } }) => Promise<{
      id: string
      wardNumber: string
      ulbId: string
      ulb?: { code: string }
    } | null>
  }
}

export async function resolveImportGeo(
  db: GeoLookupDb,
  ulbCodeRaw: string,
  wardNumberRaw: string,
  cache: Map<string, GeoResolveResult>
): Promise<GeoResolveResult> {
  const lookupCodes = resolveUlbLookupCodes(ulbCodeRaw)
  const wardCandidates = buildWardCandidates(wardNumberRaw)
  const lookupCode = lookupCodes[0] ?? normalizeImportString(ulbCodeRaw)
  const cacheKey = `${lookupCodes.join(",")}|${wardCandidates.join(",")}`

  if (cache.has(cacheKey)) return cache.get(cacheKey)!

  if (!lookupCode || !wardCandidates.length) {
    const result: GeoResolveResult = {
      ok: false,
      reason: "MISSING_INPUT",
      lookupCode,
      wardCandidates,
      message: geoErrorMessage("MISSING_INPUT", lookupCode, wardCandidates),
    }
    cache.set(cacheKey, result)
    return result
  }

  let ulb: Awaited<ReturnType<GeoLookupDb["ulb"]["findFirst"]>> = null
  for (const code of lookupCodes) {
    ulb = await db.ulb.findFirst({
      where: { code },
      include: { district: true },
    })
    if (ulb) break
  }

  // Diagnostic breadcrumb for operators / logs (lookup field is Ulb.code → table ulbs.code).
  if (process.env.IMPORT_GEO_DEBUG === "1") {
    // eslint-disable-next-line no-console
    console.log({
      excelUlbCode: ulbCodeRaw,
      normalizedUlbCode: lookupCode,
      lookupCodes,
      wardNumberRaw,
      wardCandidates,
      prismaWhereClause: { code: lookupCodes },
      matchedUlb: ulb ? { id: ulb.id, code: ulb.code, districtId: ulb.districtId } : null,
    })
  }

  if (!ulb) {
    const result: GeoResolveResult = {
      ok: false,
      reason: "ULB_NOT_FOUND",
      lookupCode,
      wardCandidates,
      message: geoErrorMessage("ULB_NOT_FOUND", lookupCode, wardCandidates),
    }
    cache.set(cacheKey, result)
    return result
  }

  const ward = await db.ward.findFirst({
    where: { ulbId: ulb.id, wardNumber: { in: wardCandidates } },
  })

  if (!ward) {
    const elsewhere = await db.ward.findFirst({
      where: { wardNumber: { in: wardCandidates } },
      include: { ulb: true },
    })
    if (elsewhere?.ulb && elsewhere.ulbId !== ulb.id) {
      const result: GeoResolveResult = {
        ok: false,
        reason: "WARD_OTHER_ULB",
        lookupCode: ulb.code,
        wardCandidates,
        otherUlbCode: elsewhere.ulb.code,
        message: geoErrorMessage("WARD_OTHER_ULB", ulb.code, wardCandidates, elsewhere.ulb.code),
      }
      cache.set(cacheKey, result)
      return result
    }
    const result: GeoResolveResult = {
      ok: false,
      reason: "WARD_NOT_FOUND",
      lookupCode: ulb.code,
      wardCandidates,
      message: geoErrorMessage("WARD_NOT_FOUND", ulb.code, wardCandidates),
    }
    cache.set(cacheKey, result)
    return result
  }

  const result: GeoResolveResult = {
    ok: true,
    reason: "OK",
    lookupCode: ulb.code,
    wardCandidates,
    geo: {
      stateId: ulb.district.stateId,
      districtId: ulb.districtId,
      ulbId: ulb.id,
      wardId: ward.id,
      ulbCode: ulb.code,
      wardNumber: ward.wardNumber,
    },
  }
  cache.set(cacheKey, result)
  return result
}

export interface WorkbookGeoPair {
  ulbCode: string
  wardNumber: string
  sampleRows: number[]
}

/** Collect distinct ULB+ward pairs from survey workbook rows for master-data preflight. */
export function collectWorkbookGeoPairs(
  surveys: Array<Record<string, string>>,
  options?: {
    skipPropertyIds?: Set<string>
    skipLocalIds?: Set<string>
  }
): WorkbookGeoPair[] {
  const map = new Map<string, WorkbookGeoPair>()

  surveys.forEach((row, index) => {
    const excelRow = index + 2
    const propertyId = normalizeImportString(row["Property ID"]).toUpperCase()
    const localId = normalizeImportString(row["Local ID"]).toUpperCase()
    if (propertyId && options?.skipPropertyIds?.has(propertyId)) return
    if (localId && options?.skipLocalIds?.has(localId)) return

    let ulbCode =
      emptyToUndefinedNormalized(row["ULB Code"]) ??
      emptyToUndefinedNormalized(row["Municipality Code"]) ??
      emptyToUndefinedNormalized(row.municipalityCode) ??
      emptyToUndefinedNormalized(row.ULB)
    let wardNumber =
      emptyToUndefinedNormalized(row["Ward Number"]) ??
      emptyToUndefinedNormalized(row["Ward No"]) ??
      emptyToUndefinedNormalized(row.Ward) ??
      emptyToUndefinedNormalized(row.wardNo)

    const parsed = parsePropertyId(propertyId)
    if (!ulbCode && parsed) ulbCode = parsed.ulbCode
    if (!wardNumber && parsed) wardNumber = parsed.wardNo
    if (!ulbCode || !wardNumber) return

    const key = `${resolveUlbLookupCodes(ulbCode)[0] ?? ulbCode}|${buildWardCandidates(wardNumber).join(",")}`
    const existing = map.get(key)
    if (existing) {
      if (existing.sampleRows.length < 5) existing.sampleRows.push(excelRow)
      return
    }
    map.set(key, { ulbCode, wardNumber, sampleRows: [excelRow] })
  })

  return [...map.values()]
}

export function formatDuplicateWorkbookError(kind: "propertyId" | "localId", key: string, rows: number[]): string {
  const label = kind === "propertyId" ? "Property ID" : "Local ID"
  if (kind === "propertyId") {
    return `Duplicate ${label} in workbook: ${key} (rows ${rows.join(", ")}). First row upserts; extras import as ${key}-D2, -D3, … for QC correction.`
  }
  return `Duplicate ${label} in workbook: ${key} (rows ${rows.join(", ")}). All rows are still imported.`
}

/** Suffix duplicate Property ID occurrences so @@unique([ulbId, propertyId, assessmentYear]) holds. */
export function disambiguateImportPropertyId(sheetPropertyId: string, occurrence: number): string {
  if (occurrence <= 1) return sheetPropertyId
  return `${sheetPropertyId}-D${occurrence}`
}
