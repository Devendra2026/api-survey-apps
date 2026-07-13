import { Injectable, Logger } from "@nestjs/common"
import type { Prisma, SurveyStatus } from "@workspace/database"
import ExcelJS from "exceljs"
import PDFDocument from "pdfkit"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import type { ExportFilters, ExportFormat, ExportReportType } from "./export.types.js"
import { ReportsRepository } from "./reports.repository.js"

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name)

  constructor(private readonly reportsRepository: ReportsRepository) {}

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
    filters: ExportFilters
  ): Promise<
    | { format: ExportFormat; reportType: ExportReportType; count: number; data: unknown }
    | { contentType: string; filename: string; buffer: Buffer }
  > {
    const rows = await this.reportsRepository.exportSurveys(user, filters)
    this.logger.log(`Export format=${format} type=${reportType} rows=${rows.length} by=${user.id}`)

    if (format === "json") {
      return { format, reportType, count: rows.length, data: this.aggregate(rows, reportType) }
    }
    if (format === "csv") {
      return {
        contentType: "text/csv",
        filename: `${reportType}-export.csv`,
        buffer: Buffer.from(this.toCsv(rows as Array<Record<string, unknown>>), "utf8"),
      }
    }
    if (format === "xlsx") {
      const buffer = await this.toExcel(rows, reportType)
      return {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename: `${reportType}-export.xlsx`,
        buffer,
      }
    }

    const buffer = await this.toPdf(rows, reportType, filters)
    return {
      contentType: "application/pdf",
      filename: `${reportType}-export.pdf`,
      buffer,
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
            const value = row[h]
            const text = value == null ? "" : String(value)
            return `"${text.replaceAll('"', '""')}"`
          })
          .join(",")
      )
    }
    return lines.join("\n")
  }

  private async toExcel(rows: Array<Record<string, unknown>>, reportType: string) {
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
          `${row.propertyId ?? ""} | ${row.surveyStatus ?? ""} | ${row.respondentName ?? ""} | ${row.ulbId ?? ""} | ${row.wardId ?? ""}`
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
