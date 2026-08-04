import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common"
import { ExportFormat as DbExportFormat, JobStatus, type Prisma, type SurveyStatus } from "@workspace/database"
import {
  renderConvexFullWorkbook,
  renderNagarPanchayatWorkbook,
  renderQcFinalWorkbook,
  renderSurveyDataWorkbook,
  type SurveyExportBundle,
} from "@workspace/excel-reports"
import type { ExportFiltersPayload } from "@workspace/jobs"
import ExcelJS from "exceljs"
import PDFDocument from "pdfkit"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { JobsService } from "../jobs/jobs.service.js"
import { PrismaService } from "../prisma/prisma.service.js"
import { StorageService } from "../storage/storage.service.js"
import type { ExportFilters, ExportFormat, ExportReportType } from "./export.types.js"
import { ReportsRepository } from "./reports.repository.js"

const SYNC_EXPORT_MAX_ROWS = 500
const SYNC_EXPORT_MAX_BYTES = 2 * 1024 * 1024

function stringifyExportField(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return `${value}`
  }
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "object" && typeof (value as { toFixed?: unknown }).toFixed === "function") {
    return (value as { toFixed: (digits?: number) => string }).toFixed()
  }
  return ""
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name)

  constructor(
    private readonly reportsRepository: ReportsRepository,
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
    private readonly storageService: StorageService
  ) {}

  surveyReport(user: AuthenticatedUser, query: PaginationQueryDto & { surveyStatus?: SurveyStatus; ulbId?: string }) {
    return this.reportsRepository.surveyReport(user, query)
  }

  exportSurveys(user: AuthenticatedUser) {
    return this.reportsRepository.exportSurveys(user, {})
  }

  async export(
    user: AuthenticatedUser,
    format: ExportFormat,
    reportType: ExportReportType,
    filters: ExportFilters,
    options: { maxRows?: number; maxBytes?: number } = {}
  ): Promise<
    | { format: ExportFormat; reportType: ExportReportType; count: number; data: unknown }
    | { contentType: string; filename: string; buffer: Buffer }
  > {
    const rows = await this.reportsRepository.exportSurveys(
      user,
      filters,
      options.maxRows ? options.maxRows + 1 : undefined
    )
    if (options.maxRows && rows.length > options.maxRows) {
      throw new BadRequestException(
        `Synchronous exports are capped at ${options.maxRows} rows. Retry without ?sync=true.`
      )
    }
    this.logger.log(`Export format=${format} type=${reportType} rows=${rows.length} by=${user.id}`)

    if (format === "json") {
      return { format, reportType, count: rows.length, data: this.aggregate(rows, reportType) }
    }
    if (format === "csv") {
      return this.assertExportSize(
        {
          contentType: "text/csv",
          filename: `${reportType}-export.csv`,
          buffer: Buffer.from(this.toCsv(rows as Array<Record<string, unknown>>), "utf8"),
        },
        options.maxBytes
      )
    }
    if (format === "xlsx") {
      const buffer = await this.toExcel(rows, reportType)
      return this.assertExportSize(
        {
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          filename: `${reportType}-export.xlsx`,
          buffer,
        },
        options.maxBytes
      )
    }

    const buffer = await this.toPdf(rows, reportType, filters)
    return this.assertExportSize(
      {
        contentType: "application/pdf",
        filename: `${reportType}-export.pdf`,
        buffer,
      },
      options.maxBytes
    )
  }

  exportSync(user: AuthenticatedUser, format: ExportFormat, reportType: ExportReportType, filters: ExportFilters) {
    if (reportType === "district_ward_zip") {
      throw new BadRequestException("district_ward_zip export cannot run synchronously. Retry without ?sync=true.")
    }
    return this.export(user, format, reportType, filters, {
      maxRows: SYNC_EXPORT_MAX_ROWS,
      maxBytes: SYNC_EXPORT_MAX_BYTES,
    })
  }

  async enqueueExport(
    user: AuthenticatedUser,
    format: ExportFormat,
    reportType: ExportReportType,
    filters: ExportFilters
  ) {
    if (reportType === "demand_notices") {
      if (format !== "pdf") {
        throw new BadRequestException("demand_notices export requires format=pdf")
      }
      if (!filters.wardId) {
        throw new BadRequestException("wardId is required for demand_notices PDF export")
      }
      filters = { ...filters, qcStatus: "APPROVED" }
    }

    if (reportType === "district_ward_zip") {
      if (format !== "xlsx") {
        throw new BadRequestException("district_ward_zip export requires format=xlsx")
      }
      if (!filters.districtId) {
        throw new BadRequestException("districtId is required for district_ward_zip export")
      }
    }

    const normalizedFilters = this.normalizeFilters(filters)
    const job = await this.prisma.db.exportJob.create({
      data: {
        createdById: user.id,
        reportType,
        format: this.toDbExportFormat(format),
        filters: normalizedFilters as Prisma.InputJsonValue,
      },
      select: { id: true, status: true },
    })

    await this.jobsService.enqueueExport({
      jobId: job.id,
      createdById: user.id,
      format,
      reportType,
      filters: normalizedFilters,
      tenantRoles: user.tenantRoles,
    })

    await this.prisma.db.securityAudit.create({
      data: {
        action: "EXPORT_ENQUEUED",
        actorId: user.id,
        targetType: "ExportJob",
        targetId: job.id,
        metadata: { format, reportType },
      },
    })

    return { jobId: job.id, status: JobStatus.QUEUED }
  }

  async getJob(user: AuthenticatedUser, jobId: string) {
    const job = await this.prisma.db.exportJob.findFirst({
      where: { id: jobId, createdById: user.id },
      select: {
        id: true,
        status: true,
        reportType: true,
        format: true,
        filename: true,
        rowCount: true,
        errorMessage: true,
        startedAt: true,
        finishedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    if (!job) throw new NotFoundException("Export job not found")
    return job
  }

  async getJobDownload(user: AuthenticatedUser, jobId: string) {
    const job = await this.prisma.db.exportJob.findFirst({
      where: { id: jobId, createdById: user.id, status: JobStatus.SUCCEEDED, objectKey: { not: null } },
      select: { id: true, objectKey: true, filename: true, rowCount: true },
    })
    if (!job?.objectKey) throw new NotFoundException("Completed export job not found")
    const url = await this.storageService.getPresignedDownloadUrl(job.objectKey)
    await this.prisma.db.$transaction([
      this.prisma.db.exportJob.update({
        where: { id: job.id },
        data: { downloadCount: { increment: 1 } },
      }),
      this.prisma.db.securityAudit.create({
        data: {
          action: "EXPORT_DOWNLOAD_URL_ISSUED",
          actorId: user.id,
          targetType: "ExportJob",
          targetId: job.id,
          metadata: { expiresInSeconds: 900 },
        },
      }),
    ])
    return { jobId: job.id, filename: job.filename ?? `${job.id}.xlsx`, rowCount: job.rowCount, url }
  }

  private assertExportSize<T extends { buffer: Buffer }>(result: T, maxBytes?: number): T {
    if (maxBytes && result.buffer.byteLength > maxBytes) {
      throw new BadRequestException("Synchronous exports are capped at 2MB. Retry without ?sync=true.")
    }
    return result
  }

  private normalizeFilters(filters: ExportFilters): ExportFiltersPayload {
    return Object.fromEntries(
      Object.entries(filters).filter(
        (entry): entry is [string, string | string[]] =>
          (typeof entry[1] === "string" && entry[1].length > 0) || (Array.isArray(entry[1]) && entry[1].length > 0)
      )
    )
  }

  private toDbExportFormat(format: ExportFormat): DbExportFormat {
    switch (format) {
      case "csv":
        return DbExportFormat.CSV
      case "json":
        return DbExportFormat.JSON
      case "pdf":
        return DbExportFormat.PDF
      case "xlsx":
        return DbExportFormat.XLSX
    }
  }

  private aggregate(
    rows: Array<{
      surveyStatus: SurveyStatus
      wardId: string
      ulbId: string
      districtId: string
      totalBuiltAreaSqFt: Prisma.Decimal | number | null
    }>,
    reportType: ExportReportType
  ) {
    if (reportType === "surveys" || reportType === "summary") {
      const byStatus: Record<string, number> = {}
      for (const row of rows) {
        byStatus[row.surveyStatus] = (byStatus[row.surveyStatus] ?? 0) + 1
      }
      return { total: rows.length, byStatus, rows: reportType === "surveys" ? rows : undefined }
    }

    const key = reportType === "ward" ? "wardId" : reportType === "ulb" ? "ulbId" : "districtId"
    const grouped: Record<string, number> = {}
    for (const row of rows) {
      const id = String(row[key] ?? "unknown")
      grouped[id] = (grouped[id] ?? 0) + 1
    }
    return { total: rows.length, grouped }
  }

  private toCsv(rows: Array<Record<string, unknown>>) {
    const headers = [
      "id",
      "propertyId",
      "surveyStatus",
      "stateId",
      "districtId",
      "ulbId",
      "wardId",
      "respondentName",
      "mobileNumber",
      "totalBuiltAreaSqFt",
      "submittedAt",
      "approvedAt",
      "createdAt",
    ]
    const lines = [headers.join(",")]
    for (const row of rows) {
      lines.push(
        headers
          .map((h) => {
            const text = stringifyExportField(row[h])
            return `"${text.replaceAll('"', '""')}"`
          })
          .join(",")
      )
    }
    return lines.join("\n")
  }

  private async toExcel(rows: Array<Record<string, unknown>>, reportType: string) {
    const bundles = rows as unknown as SurveyExportBundle[]
    if (reportType === "convex_full") return renderConvexFullWorkbook(bundles)
    if (reportType === "nagar_panchayat") return renderNagarPanchayatWorkbook(bundles)
    if (reportType === "survey_data") return renderSurveyDataWorkbook(bundles)
    if (reportType === "qc_final") return renderQcFinalWorkbook(bundles)
    const workbook = new ExcelJS.Workbook()
    workbook.creator = "Municipal Property Tax Survey API"
    const sheet = workbook.addWorksheet(reportType)
    sheet.columns = [
      { header: "ID", key: "id", width: 28 },
      { header: "Property ID", key: "propertyId", width: 18 },
      { header: "Status", key: "surveyStatus", width: 14 },
      { header: "State", key: "stateId", width: 20 },
      { header: "District", key: "districtId", width: 20 },
      { header: "ULB", key: "ulbId", width: 20 },
      { header: "Ward", key: "wardId", width: 20 },
      { header: "Respondent", key: "respondentName", width: 24 },
      { header: "Mobile", key: "mobileNumber", width: 16 },
      { header: "Built Area (sqft)", key: "totalBuiltAreaSqFt", width: 16 },
      { header: "Submitted At", key: "submittedAt", width: 22 },
      { header: "Approved At", key: "approvedAt", width: 22 },
      { header: "Created At", key: "createdAt", width: 22 },
    ]
    sheet.addRows(rows)
    sheet.getRow(1).font = { bold: true }
    const arrayBuffer = await workbook.xlsx.writeBuffer()
    return Buffer.from(arrayBuffer)
  }

  private toPdf(rows: Array<Record<string, unknown>>, reportType: string, filters: ExportFilters) {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: "A4", bufferPages: true })
      const chunks: Buffer[] = []
      doc.on("data", (chunk: Buffer) => chunks.push(chunk))
      doc.on("end", () => resolve(Buffer.concat(chunks)))
      doc.on("error", reject)

      doc.fontSize(16).text("Municipal Property Tax Survey Report", { align: "center" })
      doc.moveDown(0.5)
      doc.fontSize(11).text(`Report: ${reportType}`, { align: "left" })
      doc.text(`Generated: ${new Date().toISOString()}`)
      if (filters.surveyStatus) doc.text(`Status filter: ${filters.surveyStatus}`)
      if (filters.ulbId) doc.text(`ULB: ${filters.ulbId}`)
      if (filters.wardId) doc.text(`Ward: ${filters.wardId}`)
      doc.moveDown()

      doc.fontSize(9)
      const header = "Property ID | Status | Respondent | ULB | Ward"
      doc.text(header)
      doc.moveDown(0.3)
      doc.text("-".repeat(90))

      for (const [index, row] of rows.entries()) {
        if (index > 0 && index % 40 === 0) {
          doc.addPage()
          doc.fontSize(9).text(header)
          doc.text("-".repeat(90))
        }
        doc.text(
          [
            stringifyExportField(row.propertyId),
            stringifyExportField(row.surveyStatus),
            stringifyExportField(row.respondentName),
            stringifyExportField(row.ulbId),
            stringifyExportField(row.wardId),
          ].join(" | ")
        )
      }

      const range = doc.bufferedPageRange()
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i)
        doc.fontSize(8).text(`Page ${i + 1} of ${range.count}`, 40, doc.page.height - 30, {
          align: "center",
          width: doc.page.width - 80,
        })
      }

      doc.end()
    })
  }
}
