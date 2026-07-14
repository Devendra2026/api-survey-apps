import { Injectable, Logger } from "@nestjs/common"
import { JobStatus, type Prisma, SurveyStatus } from "@workspace/database"
import type { ExportFiltersPayload, ExportJobPayload, ExportReportType } from "@workspace/jobs"
import ExcelJS from "exceljs"
import PDFDocument from "pdfkit"
import { PrismaService } from "../database/prisma.service.js"
import { ObjectStorageService } from "../storage/object-storage.service.js"
import { buildTenantWhere, resolveTenantScope } from "../tenant/tenant-scope.js"

type ExportRow = {
  id: string
  propertyId: string
  surveyStatus: SurveyStatus
  stateId: string
  districtId: string
  ulbId: string
  wardId: string
  respondentName: string | null
  mobileNumber: string | null
  totalBuiltAreaSqFt: Prisma.Decimal | null
  submittedAt: Date | null
  approvedAt: Date | null
  createdAt: Date
}

@Injectable()
export class ExportWorkerService {
  private readonly logger = new Logger(ExportWorkerService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: ObjectStorageService
  ) {}

  async process(payload: ExportJobPayload, updateProgress: (progress: number) => Promise<void>): Promise<void> {
    await this.prisma.db.exportJob.update({
      where: { id: payload.jobId },
      data: { status: JobStatus.PROCESSING, startedAt: new Date(), errorMessage: null },
    })
    await updateProgress(10)

    try {
      const rows = await this.findRows(payload)
      await updateProgress(35)

      const artifact = await this.renderArtifact(payload, rows)
      await updateProgress(75)

      const objectKey = ["exports", payload.createdById, payload.jobId, artifact.filename].join("/")
      const uploaded = await this.storageService.putObject({
        key: objectKey,
        body: artifact.buffer,
        mimeType: artifact.contentType,
        metadata: {
          exportJobId: payload.jobId,
          createdById: payload.createdById,
          reportType: payload.reportType,
          format: payload.format,
        },
      })

      await this.prisma.db.exportJob.update({
        where: { id: payload.jobId },
        data: {
          status: JobStatus.SUCCEEDED,
          rowCount: rows.length,
          storageProvider: uploaded.provider,
          bucket: uploaded.bucket,
          objectKey: uploaded.key,
          finishedAt: new Date(),
        },
      })
      await updateProgress(100)
      this.logger.log(`Export job ${payload.jobId} completed rows=${rows.length}`)
    } catch (err) {
      await this.prisma.db.exportJob.update({
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

  private async findRows(payload: ExportJobPayload): Promise<ExportRow[]> {
    const scope = resolveTenantScope(payload.tenantRoles)
    const tenantWhere = buildTenantWhere(scope)
    const filters = payload.filters
    const dateFilter: Prisma.SurveyWhereInput = {}
    if (filters.dateFrom || filters.dateTo) {
      dateFilter.createdAt = {
        ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
      }
    }

    return this.prisma.db.survey.findMany({
      where: {
        deletedAt: null,
        ...(tenantWhere ?? {}),
        ...(toSurveyStatus(filters.surveyStatus) ? { surveyStatus: toSurveyStatus(filters.surveyStatus) } : {}),
        ...(filters.stateId ? { stateId: filters.stateId } : {}),
        ...(filters.districtId ? { districtId: filters.districtId } : {}),
        ...(filters.ulbId ? { ulbId: filters.ulbId } : {}),
        ...(filters.wardId ? { wardId: filters.wardId } : {}),
        ...dateFilter,
        ...(filters.search
          ? {
              OR: [
                { propertyId: { contains: filters.search, mode: "insensitive" } },
                { respondentName: { contains: filters.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 10000,
      select: {
        id: true,
        propertyId: true,
        surveyStatus: true,
        stateId: true,
        districtId: true,
        ulbId: true,
        wardId: true,
        respondentName: true,
        mobileNumber: true,
        totalBuiltAreaSqFt: true,
        submittedAt: true,
        approvedAt: true,
        createdAt: true,
      },
    })
  }

  private async renderArtifact(payload: ExportJobPayload, rows: ExportRow[]) {
    if (payload.format === "json") {
      return {
        contentType: "application/json",
        filename: `${payload.reportType}-export.json`,
        buffer: Buffer.from(JSON.stringify(this.aggregate(rows, payload.reportType), null, 2), "utf8"),
      }
    }
    if (payload.format === "csv") {
      return {
        contentType: "text/csv",
        filename: `${payload.reportType}-export.csv`,
        buffer: Buffer.from(this.toCsv(rows), "utf8"),
      }
    }
    if (payload.format === "xlsx") {
      return {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename: `${payload.reportType}-export.xlsx`,
        buffer: await this.toExcel(rows, payload.reportType),
      }
    }
    return {
      contentType: "application/pdf",
      filename: `${payload.reportType}-export.pdf`,
      buffer: await this.toPdf(rows, payload.reportType, payload.filters),
    }
  }

  private aggregate(rows: ExportRow[], reportType: ExportReportType) {
    if (reportType === "surveys" || reportType === "summary") {
      const byStatus: Record<string, number> = {}
      for (const row of rows) byStatus[row.surveyStatus] = (byStatus[row.surveyStatus] ?? 0) + 1
      return { total: rows.length, byStatus, rows: reportType === "surveys" ? rows : undefined }
    }

    const key = reportType === "ward" ? "wardId" : reportType === "ulb" ? "ulbId" : "districtId"
    const grouped: Record<string, number> = {}
    for (const row of rows) grouped[row[key]] = (grouped[row[key]] ?? 0) + 1
    return { total: rows.length, grouped }
  }

  private toCsv(rows: ExportRow[]) {
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
      const record = row as unknown as Record<string, unknown>
      lines.push(
        headers
          .map((header) => {
            const value = record[header]
            const text = value == null ? "" : String(value)
            return `"${text.replaceAll('"', '""')}"`
          })
          .join(",")
      )
    }
    return lines.join("\n")
  }

  private async toExcel(rows: ExportRow[], reportType: string) {
    const workbook = new ExcelJS.Workbook()
    workbook.creator = "Municipal Property Tax Survey Worker"
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

  private toPdf(rows: ExportRow[], reportType: string, filters: ExportFiltersPayload) {
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

      const header = "Property ID | Status | Respondent | ULB | Ward"
      doc.fontSize(9).text(header)
      doc.moveDown(0.3)
      doc.text("-".repeat(90))
      for (const [index, row] of rows.entries()) {
        if (index > 0 && index % 40 === 0) {
          doc.addPage()
          doc.fontSize(9).text(header)
          doc.text("-".repeat(90))
        }
        doc.text(
          `${row.propertyId} | ${row.surveyStatus} | ${row.respondentName ?? ""} | ${row.ulbId} | ${row.wardId}`
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

function toSurveyStatus(value: string | undefined): SurveyStatus | undefined {
  return value && Object.values(SurveyStatus).includes(value as SurveyStatus) ? (value as SurveyStatus) : undefined
}
