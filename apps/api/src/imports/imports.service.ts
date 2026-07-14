import { BadRequestException, Injectable, Logger } from "@nestjs/common"
import { AssessmentYear, JobStatus, OwnershipType, PropertyType, PropertyUse, SurveyStatus } from "@workspace/database"
import ExcelJS from "exceljs"
import { randomUUID } from "node:crypto"
import { Readable } from "node:stream"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { canAccessTenant, resolveTenantScope } from "../common/utils/tenant-scope.util.js"
import { JobsService } from "../jobs/jobs.service.js"
import { PrismaService } from "../prisma/prisma.service.js"
import { StorageService } from "../storage/storage.service.js"

const SYNC_IMPORT_MAX_ROWS = 500
const SYNC_IMPORT_MAX_BYTES = 2 * 1024 * 1024

const REQUIRED_COLUMNS = [
  "propertyId",
  "stateId",
  "districtId",
  "ulbId",
  "wardId",
  "assessmentYear",
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly jobsService: JobsService
  ) {}

  async enqueueSurveyImport(file: Express.Multer.File, user: AuthenticatedUser) {
    this.validateImportFile(file)

    const job = await this.prisma.db.importJob.create({
      data: {
        createdById: user.id,
        originalName: file.originalname,
        mimeType: file.mimetype,
      },
      select: { id: true, status: true },
    })

    const objectKey = ["imports", user.id, job.id, `${randomUUID()}-${this.safeObjectName(file.originalname)}`].join(
      "/"
    )
    const uploaded = await this.storageService.uploadStoredObject({
      key: objectKey,
      buffer: file.buffer,
      mimeType: file.mimetype || "application/octet-stream",
      originalName: file.originalname,
      metadata: {
        importJobId: job.id,
        createdById: user.id,
      },
    })

    await this.prisma.db.importJob.update({
      where: { id: job.id },
      data: {
        storageProvider: uploaded.provider,
        bucket: uploaded.bucket,
        objectKey: uploaded.key,
      },
    })

    await this.jobsService.enqueueImport({
      jobId: job.id,
      createdById: user.id,
      originalName: file.originalname,
      mimeType: file.mimetype || undefined,
      sizeBytes: file.size,
      bucket: uploaded.bucket,
      storageProvider: uploaded.provider,
      objectKey: uploaded.key,
      tenantRoles: user.tenantRoles,
    })

    return { jobId: job.id, status: JobStatus.QUEUED }
  }

  async importSurveys(
    file: Express.Multer.File,
    user: AuthenticatedUser,
    options: { enforceSyncCap?: boolean } = {}
  ): Promise<ImportSummary> {
    if (!file) throw new BadRequestException("Import file is required")
    this.validateImportFile(file)
    if (options.enforceSyncCap && file.size > SYNC_IMPORT_MAX_BYTES) {
      throw new BadRequestException("Synchronous imports are capped at 2MB. Retry without ?sync=true.")
    }

    const rows = await this.parseRows(file)
    if (!rows.length) throw new BadRequestException("Import file has no data rows")
    if (options.enforceSyncCap && rows.length > SYNC_IMPORT_MAX_ROWS) {
      throw new BadRequestException("Synchronous imports are capped at 500 rows. Retry without ?sync=true.")
    }

    const existing = await this.prisma.db.survey.findMany({
      where: {
        deletedAt: null,
        OR: rows
          .filter((r) => r.propertyId && r.ulbId && r.assessmentYear)
          .map((r) => ({
            propertyId: String(r.propertyId).trim(),
            ulbId: String(r.ulbId).trim(),
            assessmentYear: r.assessmentYear as AssessmentYear,
          })),
      },
      select: { propertyId: true, ulbId: true, assessmentYear: true },
    })
    const existingSet = new Set(existing.map((e) => `${e.ulbId}|${e.propertyId}|${e.assessmentYear}`))

    const scope = resolveTenantScope(user.tenantRoles)
    const errors: ImportRowError[] = []
    const validRows: Array<Record<string, string>> = []

    const wards = await this.prisma.db.ward.findMany({
      where: { id: { in: [...new Set(rows.map((r) => String(r.wardId ?? "").trim()).filter(Boolean))] } },
      include: { ulb: { include: { district: true } } },
    })
    const wardById = new Map(wards.map((w) => [w.id, w]))

    rows.forEach((row, index) => {
      const rowNumber = index + 2
      const rowErrors: string[] = []
      for (const col of REQUIRED_COLUMNS) {
        if (!row[col] || String(row[col]).trim() === "") {
          rowErrors.push(`Missing required column: ${col}`)
        }
      }

      const propertyId = String(row.propertyId ?? "").trim()
      const ulbId = String(row.ulbId ?? "").trim()
      const assessmentYear = String(row.assessmentYear ?? "").trim()
      const identityKey = `${ulbId}|${propertyId}|${assessmentYear}`
      if (propertyId && ulbId && assessmentYear && existingSet.has(identityKey)) {
        rowErrors.push(`Property ID already exists for ULB/assessment year: ${propertyId}`)
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

      const ward = wardById.get(String(row.wardId ?? "").trim())
      if (row.wardId && !ward) {
        rowErrors.push("Invalid wardId")
      } else if (ward) {
        if (ward.ulbId !== String(row.ulbId ?? "").trim()) rowErrors.push("wardId does not belong to ulbId")
        if (ward.ulb.districtId !== String(row.districtId ?? "").trim())
          rowErrors.push("ulbId does not belong to districtId")
        if (ward.ulb.district.stateId !== String(row.stateId ?? "").trim()) {
          rowErrors.push("districtId does not belong to stateId")
        }
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
        existingSet.add(identityKey)
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
                assessmentYear: row.assessmentYear as AssessmentYear,
                respondentName: row.respondentName || undefined,
                mobileNumber: row.mobileNumber || undefined,
                houseDoorNo: row.houseDoorNo || undefined,
                locality: row.locality || undefined,
                surveyStatus: SurveyStatus.DRAFT,
                createdById: user.id,
                assignedToId: user.id,
                assignedAt: new Date(),
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

  private validateImportFile(file: Express.Multer.File | undefined): asserts file is Express.Multer.File {
    if (!file) throw new BadRequestException("Import file is required")
    const name = file.originalname.toLowerCase()
    if (!name.endsWith(".xlsx") && !name.endsWith(".csv")) {
      throw new BadRequestException("Only .xlsx and .csv files are supported")
    }
  }

  private safeObjectName(originalName: string) {
    return originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160) || "import-file"
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
      headers[col] = this.cellValueToString(cell.value).trim()
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
        record[header] = this.cellValueToString(value).trim()
      })
      if (Object.values(record).some((v) => v !== "")) {
        rows.push(record)
      }
    })
    return rows
  }

  private cellValueToString(value: ExcelJS.CellValue): string {
    if (value == null) return ""
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value instanceof Date) {
      return String(value)
    }
    if ("text" in value && typeof value.text === "string") {
      return value.text
    }
    if ("result" in value) {
      return this.cellValueToString(value.result)
    }
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("")
    }
    return ""
  }
}
