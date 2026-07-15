import { BadRequestException, Injectable, Logger } from "@nestjs/common"
import { UlbType } from "@workspace/database"
import {
  canonicalWardNumber,
  emptyToUndefinedNormalized,
  normalizeImportString,
  padUlbCode,
} from "@workspace/validation"
import { PrismaService } from "../prisma/prisma.service.js"
import type { WorkbookRow } from "./convex-workbook-parser.js"

export interface GeoCatalogImportSummary {
  totalRows: number
  statesUpserted: number
  districtsUpserted: number
  ulbsUpserted: number
  wardsUpserted: number
  errors: Array<{ row: number; errors: string[] }>
}

/**
 * Upsert State → District → ULB → Ward from a catalog workbook/CSV.
 * Does not create surveys. Ward numbers are stored in canonical unpadded form ("5").
 *
 * Expected columns (first sheet or sheet named "GeoCatalog"):
 * State Code, State Name, District Name, ULB Code, ULB Name, ULB Type?, Ward Number, Ward Name
 */
@Injectable()
export class GeoCatalogImportService {
  private readonly logger = new Logger(GeoCatalogImportService.name)

  constructor(private readonly prisma: PrismaService) {}

  async importCatalog(file: Express.Multer.File): Promise<GeoCatalogImportSummary> {
    if (!file?.buffer?.length) throw new BadRequestException("Geo catalog file is required")

    const rows = await this.loadGeoRows(file)

    const errors: GeoCatalogImportSummary["errors"] = []
    let statesUpserted = 0
    let districtsUpserted = 0
    let ulbsUpserted = 0
    let wardsUpserted = 0

    const stateCache = new Map<string, string>()
    const districtCache = new Map<string, string>()
    const ulbCache = new Map<string, string>()

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2
      const rowErrors: string[] = []

      const stateCode = emptyToUndefinedNormalized(firstValue(row, ["State Code", "stateCode", "State"]))?.toUpperCase()
      const stateName = emptyToUndefinedNormalized(firstValue(row, ["State Name", "stateName"]))
      const districtName = emptyToUndefinedNormalized(firstValue(row, ["District Name", "District", "districtName"]))
      const ulbCodeRaw = emptyToUndefinedNormalized(
        firstValue(row, ["ULB Code", "Municipality Code", "ulbCode", "Code"])
      )
      const ulbName = emptyToUndefinedNormalized(firstValue(row, ["ULB Name", "ULB / Local Body", "ulbName", "Name"]))
      const wardNumberRaw = emptyToUndefinedNormalized(
        firstValue(row, ["Ward Number", "Ward No", "Ward", "wardNumber"])
      )
      const wardName =
        emptyToUndefinedNormalized(firstValue(row, ["Ward Name", "wardName"])) ??
        (wardNumberRaw ? `Ward ${canonicalWardNumber(wardNumberRaw)}` : undefined)
      const ulbType = mapUlbType(firstValue(row, ["ULB Type", "ulbType", "Type"]))

      if (!stateCode && !stateName) rowErrors.push("Missing State Code / State Name")
      if (!districtName) rowErrors.push("Missing District Name")
      if (!ulbCodeRaw) rowErrors.push("Missing ULB Code")
      if (!ulbName) rowErrors.push("Missing ULB Name")
      if (!wardNumberRaw) rowErrors.push("Missing Ward Number")

      if (rowErrors.length) {
        errors.push({ row: rowNumber, errors: rowErrors })
        continue
      }

      const ulbCode = padUlbCode(ulbCodeRaw!) || normalizeImportString(ulbCodeRaw!).toUpperCase()
      const wardNumber = canonicalWardNumber(wardNumberRaw!)
      const resolvedStateCode = stateCode ?? normalizeImportString(stateName!).slice(0, 8).toUpperCase()
      const resolvedStateName = stateName ?? resolvedStateCode

      try {
        let stateId = stateCache.get(resolvedStateCode)
        if (!stateId) {
          const state = await this.prisma.db.state.upsert({
            where: { code: resolvedStateCode },
            create: { code: resolvedStateCode, name: resolvedStateName },
            update: { name: resolvedStateName },
          })
          stateId = state.id
          stateCache.set(resolvedStateCode, stateId)
          statesUpserted += 1
        }

        const districtKey = `${stateId}|${districtName!.toLowerCase()}`
        let districtId = districtCache.get(districtKey)
        if (!districtId) {
          const district = await this.prisma.db.district.upsert({
            where: {
              stateId_name: { stateId, name: districtName! },
            },
            create: { stateId, name: districtName! },
            update: {},
          })
          districtId = district.id
          districtCache.set(districtKey, districtId)
          districtsUpserted += 1
        }

        let ulbId = ulbCache.get(ulbCode)
        if (!ulbId) {
          const existingByCode = await this.prisma.db.ulb.findFirst({ where: { code: ulbCode } })
          if (existingByCode) {
            const updated = await this.prisma.db.ulb.update({
              where: { id: existingByCode.id },
              data: { name: ulbName!, districtId, type: ulbType },
            })
            ulbId = updated.id
          } else {
            const created = await this.prisma.db.ulb.create({
              data: {
                districtId,
                name: ulbName!,
                code: ulbCode,
                type: ulbType,
              },
            })
            ulbId = created.id
          }
          ulbCache.set(ulbCode, ulbId)
          ulbsUpserted += 1
        }

        await this.prisma.db.ward.upsert({
          where: {
            ulbId_wardNumber: { ulbId, wardNumber },
          },
          create: {
            ulbId,
            wardNumber,
            wardName: wardName!,
          },
          update: { wardName: wardName! },
        })
        wardsUpserted += 1
      } catch (err) {
        errors.push({
          row: rowNumber,
          errors: [err instanceof Error ? err.message : String(err)],
        })
      }
    }

    const summary: GeoCatalogImportSummary = {
      totalRows: rows.length,
      statesUpserted,
      districtsUpserted,
      ulbsUpserted,
      wardsUpserted,
      errors,
    }
    this.logger.log(
      `Geo catalog import rows=${summary.totalRows} ulbs=${summary.ulbsUpserted} wards=${summary.wardsUpserted} errors=${summary.errors.length}`
    )
    return summary
  }

  private async loadGeoRows(file: Express.Multer.File): Promise<WorkbookRow[]> {
    const ExcelJS = await import("exceljs")
    const { Readable } = await import("node:stream")
    const workbook = new ExcelJS.Workbook()
    const lower = file.originalname.toLowerCase()
    const stream = Readable.from(file.buffer)

    if (lower.endsWith(".csv")) {
      await workbook.csv.read(stream)
    } else {
      await workbook.xlsx.read(stream)
    }

    const sheet =
      workbook.getWorksheet("GeoCatalog") ??
      workbook.worksheets.find((s) => s.name.trim().toLowerCase() === "geocatalog") ??
      workbook.worksheets[0]

    if (!sheet) throw new BadRequestException("Geo catalog workbook has no sheets")

    const headerRow = sheet.getRow(1)
    const headers: string[] = []
    headerRow.eachCell((cell, col) => {
      headers[col] = String(cell.value ?? "")
        .trim()
        .replace(/^\uFEFF/, "")
    })

    const rows: WorkbookRow[] = []
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return
      const record: WorkbookRow = {}
      headers.forEach((header, col) => {
        if (!header) return
        const value = row.getCell(col).value
        record[header] =
          value == null
            ? ""
            : String(
                typeof value === "object" && value !== null && "text" in value
                  ? (value as { text: string }).text
                  : value
              ).trim()
      })
      if (Object.values(record).some((v) => v !== "")) rows.push(record)
    })

    if (!rows.length) throw new BadRequestException("Geo catalog has no data rows")
    return rows
  }
}

function firstValue(row: WorkbookRow, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = emptyToUndefinedNormalized(row[key])
    if (value) return value
  }
  const normalized = new Map(
    Object.entries(row).map(([h, v]) => [normalizeImportString(h).toLowerCase().replace(/\s+/g, " "), v])
  )
  for (const key of keys) {
    const value = emptyToUndefinedNormalized(normalized.get(key.trim().toLowerCase().replace(/\s+/g, " ")))
    if (value) return value
  }
  return undefined
}

function mapUlbType(raw: string | undefined): UlbType {
  const value = normalizeImportString(raw).toUpperCase().replace(/\s+/g, "_")
  if (value === "TOWN_PANCHAYAT" || value === "TOWNPANCHAYAT" || value === "TP") {
    return UlbType.TOWN_PANCHAYAT
  }
  return UlbType.MUNICIPAL_COUNCIL
}
