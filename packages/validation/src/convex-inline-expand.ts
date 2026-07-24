/**
 * Expand denormalized Convex Surveys-sheet columns (Photos / Floors / CoOwners)
 * into the same row shapes produced by dedicated CoOwners / Floors / Photos sheets.
 *
 * Locked formats (ward1.xlsx / legacy denormalized export):
 * - Photos: JSON `[{type,url}]` OR `Front | url; Side | url`
 * - Floors: floors separated by ` || ` or `;`; each floor is pipe-separated
 *   e.g. `0:ground_floor | self_occupied | pakka_building_with_rcc_roof | Occupied | 850 | residential`
 * - CoOwners: JSON array of owner objects OR `;`-separated names
 */

import { mapConstructionType, mapFloorPosition, mapUsageFactor, mapUsageType } from "./convex-import-map.js"
import { allocateTempPropertyId, importChildJoinKey } from "./property-id.js"

export type WorkbookRow = Record<string, string>

/** Column headers on Surveys sheet that carry inline child data. */
export const SURVEY_INLINE_COLUMNS = {
  photos: "Photos",
  floors: "Floors",
  coOwners: "CoOwners",
} as const

export interface InlineExpansionResult {
  coOwners: WorkbookRow[]
  floors: WorkbookRow[]
  photos: WorkbookRow[]
  /** True when at least one Surveys row had an inline child column. */
  usedInlineColumns: boolean
}

function trim(value: unknown): string {
  if (value == null) return ""
  return String(value).trim()
}

function propertyIdOf(row: WorkbookRow): string {
  return importChildJoinKey(row)
}

function tryParseJson(raw: string): unknown | undefined {
  const s = raw.trim()
  if (!s) return undefined
  if (!(s.startsWith("[") || s.startsWith("{"))) return undefined
  try {
    return JSON.parse(s) as unknown
  } catch {
    return undefined
  }
}

/**
 * Photos: JSON `[{type,url}]` or `Type | url; Type | url`
 */
export function expandInlinePhotos(propertyId: string, raw: string): WorkbookRow[] {
  const pid = propertyId.trim().toUpperCase()
  if (!pid || !raw.trim()) return []

  const parsed = tryParseJson(raw)
  if (parsed !== undefined) {
    const list = Array.isArray(parsed) ? parsed : [parsed]
    const rows: WorkbookRow[] = []
    for (const item of list) {
      if (!item || typeof item !== "object") continue
      const obj = item as Record<string, unknown>
      const typeRaw = trim(obj.type ?? obj.slot ?? obj.Slot ?? obj["Slot Key"])
      const url = trim(obj.url ?? obj.photoUrl ?? obj["Photo URL"] ?? obj.href)
      if (!url) continue
      rows.push({
        "Property ID": pid,
        Slot: typeRaw,
        "Slot Key": typeRaw || "front",
        "Photo URL": url,
      })
    }
    return rows
  }

  const rows: WorkbookRow[] = []
  for (const part of raw.split(";")) {
    const segment = part.trim()
    if (!segment) continue
    const pipe = segment.indexOf("|")
    if (pipe < 0) continue
    const typeRaw = segment.slice(0, pipe).trim()
    const url = segment.slice(pipe + 1).trim()
    if (!url) continue
    rows.push({
      "Property ID": pid,
      Slot: typeRaw,
      "Slot Key": typeRaw,
      "Photo URL": url,
    })
  }
  return rows
}

/**
 * Classify a floor pipe segment into known fields.
 * First segment is always `position:floor_name` or floor name alone.
 */
function parseFloorSegment(propertyId: string, segment: string): WorkbookRow | null {
  const parts = segment
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean)
  if (!parts.length) return null

  const head = parts[0] ?? ""
  let position = ""
  let floorName = head
  const colon = head.indexOf(":")
  if (colon >= 0) {
    position = head.slice(0, colon).trim()
    floorName = head.slice(colon + 1).trim() || head
  }

  let usageType = ""
  let constructionType = ""
  let usageFactor = ""
  let occupancy = ""
  let areaSqft = ""

  for (const part of parts.slice(1)) {
    const lower = part.toLowerCase()
    if (lower === "occupied" || lower === "vacant") {
      occupancy = part
      continue
    }
    if (/^\d+(\.\d+)?$/.test(part.replace(/,/g, ""))) {
      if (!areaSqft) areaSqft = part.replace(/,/g, "")
      continue
    }
    if (!usageType && mapUsageType(part)) {
      usageType = part
      continue
    }
    if (!constructionType && mapConstructionType(part)) {
      constructionType = part
      continue
    }
    if (!usageFactor && mapUsageFactor(part)) {
      usageFactor = part
      continue
    }
    if (!occupancy && (lower.includes("occup") || lower.includes("vacant"))) {
      occupancy = part
      continue
    }
    // Unclassified leftover: prefer as construction then occupancy text
    if (!constructionType) constructionType = part
    else if (!occupancy) occupancy = part
  }

  if (!mapFloorPosition(floorName) && !floorName) return null

  return {
    "Property ID": propertyId,
    "Client Floor ID": "",
    Position: position || "0",
    Floor: floorName,
    "Usage Factor": usageFactor,
    "Usage Type": usageType,
    "Construction Type": constructionType,
    Occupancy: occupancy,
    "Area (Sqft)": areaSqft,
  }
}

/**
 * Floors: `floor || floor` or `floor; floor`, each floor pipe-separated.
 */
export function expandInlineFloors(propertyId: string, raw: string): WorkbookRow[] {
  const pid = propertyId.trim().toUpperCase()
  if (!pid || !raw.trim()) return []

  const parsed = tryParseJson(raw)
  if (parsed !== undefined) {
    const list = Array.isArray(parsed) ? parsed : [parsed]
    const rows: WorkbookRow[] = []
    for (const [index, item] of list.entries()) {
      if (!item || typeof item !== "object") continue
      const obj = item as Record<string, unknown>
      const floorName = trim(obj.floorName ?? obj.Floor ?? obj.floorPosition ?? obj.position_name)
      const position = trim(obj.position ?? obj.Position ?? index)
      if (!floorName && !trim(obj.Floor)) continue
      rows.push({
        "Property ID": pid,
        "Client Floor ID": trim(obj.clientFloorId ?? obj["Client Floor ID"]),
        Position: position || String(index),
        Floor: floorName || trim(obj.Floor),
        "Usage Factor": trim(obj.usageFactor ?? obj["Usage Factor"]),
        "Usage Type": trim(obj.usageType ?? obj["Usage Type"]),
        "Construction Type": trim(obj.constructionType ?? obj["Construction Type"]),
        Occupancy: trim(
          obj.occupancy ??
            obj.Occupancy ??
            (obj.isOccupied === true ? "Occupied" : obj.isOccupied === false ? "Vacant" : "")
        ),
        "Area (Sqft)": trim(obj.areaSqft ?? obj["Area (Sqft)"] ?? obj.area),
      })
    }
    return rows
  }

  // Prefer ` || ` as multi-floor delimiter; fall back to `;` when segments look like floors.
  const multi = raw.includes("||") ? raw.split("||") : raw.split(";")
  const rows: WorkbookRow[] = []
  for (const segment of multi) {
    const row = parseFloorSegment(pid, segment.trim())
    if (row) rows.push(row)
  }
  return rows
}

/**
 * CoOwners: JSON array or `;`-separated names.
 */
export function expandInlineCoOwners(propertyId: string, raw: string): WorkbookRow[] {
  const pid = propertyId.trim().toUpperCase()
  if (!pid || !raw.trim()) return []

  const parsed = tryParseJson(raw)
  if (parsed !== undefined) {
    const list = Array.isArray(parsed) ? parsed : [parsed]
    const rows: WorkbookRow[] = []
    for (const [index, item] of list.entries()) {
      if (!item || typeof item !== "object") continue
      const obj = item as Record<string, unknown>
      const name = trim(obj.name ?? obj.Name)
      if (!name) continue
      rows.push({
        "Property ID": pid,
        "Owner Index": trim(obj.ownerIndex ?? obj["Owner Index"] ?? index + 1),
        Name: name,
        "Father / Husband Name": trim(obj.fatherOrHusbandName ?? obj["Father / Husband Name"]),
        Mobile: trim(obj.mobile ?? obj.mobileNo ?? obj.Mobile),
        "Alt Mobile": trim(obj.alternateMobile ?? obj.altMobileNo ?? obj["Alt Mobile"] ?? obj.altMobile),
      })
    }
    return rows
  }

  // `Name | Father | Mobile | Alt; Name2 | ...` or plain `Name; Name2`
  const rows: WorkbookRow[] = []
  for (const [index, part] of raw.split(";").entries()) {
    const segment = part.trim()
    if (!segment) continue
    const bits = segment.split("|").map((b) => b.trim())
    const name = bits[0] ?? ""
    if (!name) continue
    rows.push({
      "Property ID": pid,
      "Owner Index": String(index + 1),
      Name: name,
      "Father / Husband Name": bits[1] ?? "",
      Mobile: bits[2] ?? "",
      "Alt Mobile": bits[3] ?? "",
    })
  }
  return rows
}

/**
 * Walk Surveys rows and expand inline child columns into synthetic sheet rows.
 * When Property ID is blank, join via Local ID / Survey ID, or stamp a TEMP-* Property ID
 * so children are not dropped.
 */
export function expandInlineChildColumns(surveys: WorkbookRow[]): InlineExpansionResult {
  const coOwners: WorkbookRow[] = []
  const floors: WorkbookRow[] = []
  const photos: WorkbookRow[] = []
  let usedInlineColumns = false

  for (const row of surveys) {
    let pid = propertyIdOf(row)
    if (!pid) {
      pid = allocateTempPropertyId()
      row["Property ID"] = pid
    }

    const photosRaw = trim(row[SURVEY_INLINE_COLUMNS.photos])
    const floorsRaw = trim(row[SURVEY_INLINE_COLUMNS.floors])
    const coOwnersRaw = trim(row[SURVEY_INLINE_COLUMNS.coOwners])

    if (photosRaw) {
      usedInlineColumns = true
      photos.push(...expandInlinePhotos(pid, photosRaw))
    }
    if (floorsRaw) {
      usedInlineColumns = true
      floors.push(...expandInlineFloors(pid, floorsRaw))
    }
    if (coOwnersRaw) {
      usedInlineColumns = true
      coOwners.push(...expandInlineCoOwners(pid, coOwnersRaw))
    }
  }

  return { coOwners, floors, photos, usedInlineColumns }
}

/**
 * Merge dedicated-sheet rows with inline expansion.
 * Dedicated sheets win when they already have rows; inline fills gaps only.
 */
export function mergeChildSheetsWithInline(
  surveys: WorkbookRow[],
  sheets: { coOwners: WorkbookRow[]; floors: WorkbookRow[]; photos: WorkbookRow[] }
): InlineExpansionResult & { sheetPreferredWarning: boolean } {
  const inline = expandInlineChildColumns(surveys)
  const hasSheetCoOwners = sheets.coOwners.length > 0
  const hasSheetFloors = sheets.floors.length > 0
  const hasSheetPhotos = sheets.photos.length > 0
  const sheetPreferredWarning = inline.usedInlineColumns && (hasSheetCoOwners || hasSheetFloors || hasSheetPhotos)

  return {
    coOwners: hasSheetCoOwners ? sheets.coOwners : inline.coOwners,
    floors: hasSheetFloors ? sheets.floors : inline.floors,
    photos: hasSheetPhotos ? sheets.photos : inline.photos,
    usedInlineColumns: inline.usedInlineColumns,
    sheetPreferredWarning,
  }
}
