import { Injectable, Logger } from "@nestjs/common"
import { AssessmentYear, JobStatus, OwnershipType, PropertyType, PropertyUse, SurveyStatus } from "@workspace/database"
import type { ImportJobPayload } from "@workspace/jobs"
import ExcelJS from "exceljs"
import { Readable } from "node:stream"
import { PrismaService } from "../database/prisma.service.js"
import { ObjectStorageService } from "../storage/object-storage.service.js"
import { canAccessTenant, resolveTenantScope } from "../tenant/tenant-scope.js"

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

interface ImportRowError {
  row: number
  propertyId?: string
  errors: string[]
}

@Injectable()
export class ImportWorkerService {
  private readonly logger = new Logger(ImportWorkerService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: ObjectStorageService
  ) {}

  async process(payload: ImportJobPayload, updateProgress: (progress: number) => Promise<void>): Promise<void> {
    await this.prisma.db.importJob.update({
      where: { id: payload.jobId },
      data: { status: JobStatus.PROCESSING, startedAt: new Date(), errorMessage: null },
    })
    await updateProgress(5)

    try {
      const source = await this.storageService.getObjectBuffer(payload.objectKey, payload.bucket)
      const rows = await this.parseRows(source, payload.originalName)
      await this.prisma.db.importJob.update({ where: { id: payload.jobId }, data: { totalRows: rows.length } })
      await updateProgress(15)

      const errors: ImportRowError[] = []
      const validRows = await this.validateRows(rows, payload, errors)
      const createdSurveyIds: string[] = []

      await this.prisma.db.$transaction(async (tx) => {
        for (const [index, row] of validRows.entries()) {
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
              createdById: payload.createdById,
              assignedToId: payload.createdById,
              assignedAt: new Date(),
            },
          })
          await tx.surveyAudit.create({
            data: {
              surveyId: survey.id,
              action: "IMPORTED",
              newValue: { propertyId: survey.propertyId },
              changedBy: payload.createdById,
            },
          })
          createdSurveyIds.push(survey.id)
          const progress = 15 + Math.floor(((index + 1) / Math.max(validRows.length, 1)) * 70)
          await updateProgress(progress)
        }
      })

      const errorReportKey = errors.length ? await this.writeErrorReport(payload, errors) : null
      await this.prisma.db.importJob.update({
        where: { id: payload.jobId },
        data: {
          status: JobStatus.SUCCEEDED,
          successCount: createdSurveyIds.length,
          failureCount: errors.length,
          errorReportKey,
          resultSummary: {
            totalRows: rows.length,
            successCount: createdSurveyIds.length,
            failureCount: errors.length,
            createdSurveyIds,
          },
          finishedAt: new Date(),
        },
      })
      await updateProgress(100)
      this.logger.log(`Import job ${payload.jobId} completed rows=${rows.length}`)
    } catch (err) {
      await this.prisma.db.importJob.update({
        where: { id: payload.jobId },
        data: {
          status: JobStatus.FAILED,
          errorMessage: err instanceof Error ? err.message : String(err),
          finishedAt: new Date(),
        },
      })
      throw err
    }
  }

  private async validateRows(
    rows: Array<Record<string, string>>,
    payload: ImportJobPayload,
    errors: ImportRowError[]
  ): Promise<Array<Record<string, string>>> {
    const existing = await this.prisma.db.survey.findMany({
      where: {
        deletedAt: null,
        OR: rows
          .filter((row) => row.propertyId && row.ulbId && row.assessmentYear)
          .map((row) => ({
            propertyId: String(row.propertyId).trim(),
            ulbId: String(row.ulbId).trim(),
            assessmentYear: row.assessmentYear as AssessmentYear,
          })),
      },
      select: { propertyId: true, ulbId: true, assessmentYear: true },
    })
    const existingSet = new Set(existing.map((row) => `${row.ulbId}|${row.propertyId}|${row.assessmentYear}`))
    const seenInFile = new Set<string>()
    const scope = resolveTenantScope(payload.tenantRoles)
    const validRows: Array<Record<string, string>> = []

    rows.forEach((row, index) => {
      const rowErrors: string[] = []
      const propertyId = String(row.propertyId ?? "").trim()
      const ulbId = String(row.ulbId ?? "").trim()
      const assessmentYear = String(row.assessmentYear ?? "").trim()
      const identityKey = `${ulbId}|${propertyId}|${assessmentYear}`
      for (const column of REQUIRED_COLUMNS) {
        if (!row[column] || String(row[column]).trim() === "") {
          rowErrors.push(`Missing required column: ${column}`)
        }
      }
      if (propertyId && ulbId && assessmentYear && seenInFile.has(identityKey)) {
        rowErrors.push(`Duplicate Property ID/ULB/assessmentYear in file: ${propertyId}`)
      }
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
      if (
        !canAccessTenant(scope, {
          stateId: row.stateId,
          districtId: row.districtId,
          ulbId: row.ulbId,
          wardId: row.wardId,
        })
      ) {
        rowErrors.push("Row is outside creator tenant scope")
      }

      if (rowErrors.length) {
        errors.push({ row: index + 2, propertyId: propertyId || undefined, errors: rowErrors })
      } else {
        validRows.push(row)
        seenInFile.add(identityKey)
      }
    })

    return validRows
  }

  private async parseRows(buffer: Buffer, originalName: string): Promise<Array<Record<string, string>>> {
    const workbook = new ExcelJS.Workbook()
    if (originalName.toLowerCase().endsWith(".csv")) {
      await workbook.csv.read(Readable.from(buffer))
    } else {
      await workbook.xlsx.load(buffer as never)
    }

    const sheet = workbook.worksheets[0]
    if (!sheet) return []
    const headerRow = sheet.getRow(1)
    const headers: string[] = []
    headerRow.eachCell((cell, col) => {
      headers[col] = String(cell.value ?? "").trim()
    })

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
            : String(typeof value === "object" && value !== null && "text" in value ? (value as { text: string }).text : value).trim()
      })
      if (Object.values(record).some((value) => value !== "")) rows.push(record)
    })
    return rows
  }

  private async writeErrorReport(payload: ImportJobPayload, errors: ImportRowError[]): Promise<string> {
    const key = ["imports", payload.createdById, payload.jobId, "errors.json"].join("/")
    await this.storageService.putObject({
      key,
      bucket: payload.bucket,
      body: Buffer.from(JSON.stringify({ jobId: payload.jobId, errors }, null, 2), "utf8"),
      mimeType: "application/json",
      metadata: { importJobId: payload.jobId },
    })
    return key
  }
}
