import { BadRequestException, Injectable, Logger } from "@nestjs/common"
import { AssessmentYear, OwnershipType, PropertyType, PropertyUse, SurveyStatus } from "@workspace/database"
import ExcelJS from "exceljs"
import { Readable } from "node:stream"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { canAccessTenant, resolveTenantScope } from "../common/utils/tenant-scope.util.js"
import { PrismaService } from "../prisma/prisma.service.js"

const REQUIRED_COLUMNS = [
  "propertyId",
  "stateId",
  "districtId",
  "ulbId",
  "wardId",
  "ownershipType",
  "propertyUse",
  "propertyType",
] as const

export interface ImportRowError {
  row: number
  propertyId?: string
  errors: string[]
}

export interface ImportSummary {
  totalRows: number
  successCount: number
  failureCount: number
  createdSurveyIds: string[]
  errors: ImportRowError[]
}

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name)

  constructor(private readonly prisma: PrismaService) {}

  async importSurveys(file: Express.Multer.File, user: AuthenticatedUser): Promise<ImportSummary> {
    if (!file) throw new BadRequestException("Import file is required")
    const name = file.originalname.toLowerCase()
    if (!name.endsWith(".xlsx") && !name.endsWith(".csv")) {
      throw new BadRequestException("Only .xlsx and .csv files are supported")
    }

    const rows = await this.parseRows(file)
    if (!rows.length) throw new BadRequestException("Import file has no data rows")

    const propertyIds = rows.map((r) => String(r.propertyId ?? "").trim()).filter(Boolean)
    const dupInFile = propertyIds.filter((id, idx) => propertyIds.indexOf(id) !== idx)
    if (dupInFile.length) {
      throw new BadRequestException(`Duplicate Property IDs in file: ${[...new Set(dupInFile)].join(", ")}`)
    }

    const existing = await this.prisma.db.survey.findMany({
      where: { propertyId: { in: propertyIds }, deletedAt: null },
      select: { propertyId: true },
    })
    const existingSet = new Set(existing.map((e) => e.propertyId))

    const scope = resolveTenantScope(user.tenantRoles)
    const errors: ImportRowError[] = []
    const validRows: Array<Record<string, string>> = []

    rows.forEach((row, index) => {
      const rowNumber = index + 2
      const rowErrors: string[] = []
      for (const col of REQUIRED_COLUMNS) {
        if (!row[col] || String(row[col]).trim() === "") {
          rowErrors.push(`Missing required column: ${col}`)
        }
      }

      const propertyId = String(row.propertyId ?? "").trim()
      if (propertyId && existingSet.has(propertyId)) {
        rowErrors.push(`Property ID already exists: ${propertyId}`)
      }

      if (row.ownershipType && !Object.values(OwnershipType).includes(row.ownershipType as OwnershipType)) {
        rowErrors.push(`Invalid ownershipType: ${row.ownershipType}`)
      }
      if (row.propertyUse && !Object.values(PropertyUse).includes(row.propertyUse as PropertyUse)) {
        rowErrors.push(`Invalid propertyUse: ${row.propertyUse}`)
      }
      if (row.propertyType && !Object.values(PropertyType).includes(row.propertyType as PropertyType)) {
        rowErrors.push(`Invalid propertyType: ${row.propertyType}`)
      }
      if (row.assessmentYear && !Object.values(AssessmentYear).includes(row.assessmentYear as AssessmentYear)) {
        rowErrors.push(`Invalid assessmentYear: ${row.assessmentYear}`)
      }

      if (
        !canAccessTenant(scope, {
          stateId: row.stateId,
          districtId: row.districtId,
          ulbId: row.ulbId,
          wardId: row.wardId,
        })
      ) {
        rowErrors.push("Row is outside your tenant scope")
      }

      if (rowErrors.length) {
        errors.push({ row: rowNumber, propertyId: propertyId || undefined, errors: rowErrors })
      } else {
        validRows.push(row)
      }
    })

    const createdSurveyIds: string[] = []
    if (validRows.length) {
      try {
        await this.prisma.db.$transaction(async (tx) => {
          for (const row of validRows) {
            const survey = await tx.survey.create({
              data: {
                propertyId: String(row.propertyId).trim(),
                stateId: String(row.stateId).trim(),
                districtId: String(row.districtId).trim(),
                ulbId: String(row.ulbId).trim(),
                wardId: String(row.wardId).trim(),
                ownershipType: row.ownershipType as OwnershipType,
                propertyUse: row.propertyUse as PropertyUse,
                propertyType: row.propertyType as PropertyType,
                assessmentYear: row.assessmentYear ? (row.assessmentYear as AssessmentYear) : undefined,
                respondentName: row.respondentName || undefined,
                mobileNumber: row.mobileNumber || undefined,
                houseDoorNo: row.houseDoorNo || undefined,
                locality: row.locality || undefined,
                surveyStatus: SurveyStatus.DRAFT,
                createdById: user.id,
              },
            })
            await tx.surveyAudit.create({
              data: {
                surveyId: survey.id,
                action: "IMPORTED",
                newValue: { propertyId: survey.propertyId },
                changedBy: user.id,
              },
            })
            createdSurveyIds.push(survey.id)
          }
        })
      } catch (err) {
        this.logger.error(`Import transaction failed: ${String(err)}`)
        throw new BadRequestException("Import failed and was rolled back. Fix row errors and retry.")
      }
    }

    const summary: ImportSummary = {
      totalRows: rows.length,
      successCount: createdSurveyIds.length,
      failureCount: errors.length,
      createdSurveyIds,
      errors,
    }
    this.logger.log(
      `Survey import by=${user.id} total=${summary.totalRows} ok=${summary.successCount} fail=${summary.failureCount}`
    )
    return summary
  }

  private async parseRows(file: Express.Multer.File): Promise<Array<Record<string, string>>> {
    const workbook = new ExcelJS.Workbook()
    if (file.originalname.toLowerCase().endsWith(".csv")) {
      await workbook.csv.read(Readable.from(file.buffer))
    } else {
      await workbook.xlsx.load(file.buffer as never)
    }

    const sheet = workbook.worksheets[0]
    if (!sheet) return []

    const headerRow = sheet.getRow(1)
    const headers: string[] = []
    headerRow.eachCell((cell, col) => {
      headers[col] = String(cell.value ?? "").trim()
    })

    for (const required of REQUIRED_COLUMNS) {
      if (!headers.includes(required)) {
        throw new BadRequestException(`Missing required column header: ${required}`)
      }
    }

    const rows: Array<Record<string, string>> = []
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return
      const record: Record<string, string> = {}
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
      if (Object.values(record).some((v) => v !== "")) {
        rows.push(record)
      }
    })
    return rows
  }
}
