import { Injectable, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { JobStatus, Prisma, SurveyStatus } from "@workspace/database"
import {
  assertExportRowCount,
  buildExportFilename,
  renderConvexFullWorkbook,
  renderNagarPanchayatWorkbook,
  renderQcFinalWideWorkbook,
  renderSurveyDataWorkbook,
  sanitizeExportPathSegment,
  streamQcFinalWideWorkbookToFile,
  streamSurveyDataWorkbookToFile,
  wardSurveyDataZipEntry,
  type SurveyExportBundle,
} from "@workspace/excel-reports"
import type { ExportFiltersPayload, ExportJobPayload, ExportReportType } from "@workspace/jobs"
import { ZipArchive } from "archiver"
import ExcelJS from "exceljs"
import { createWriteStream } from "node:fs"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import PDFDocument from "pdfkit"
import { PrismaService } from "../database/prisma.service.js"
import { ObjectStorageService } from "../storage/object-storage.service.js"
import { buildTenantWhere, resolveTenantScope } from "../tenant/tenant-scope.js"
import { renderWardDemandNoticePdf } from "./demand-notice-pdf.js"

const EXPORT_BATCH_SIZE = 500
const DEFAULT_EXPORT_MAX_ROWS = 500_000

type ExportFloorRow = {
  surveyId: string
  floorPosition: string
  usageFactor: string | null
  usageType: string | null
  constructionType: string | null
  occupancy: string | null
  areaSqFt: Prisma.Decimal | null
}

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

/** Floors are loaded via raw SQL (text cast) so legacy FIFTH_FLOOR_PLUS does not crash Prisma enum decoding. */
const SURVEY_EXPORT_SELECT = {
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
  localId: true,
  propertyIdOld: true,
  parcelNumber: true,
  unitSubNo: true,
  sectorNo: true,
  constructedYear: true,
  isSlum: true,
  wardNumber: true,
  relationshipWithOwner: true,
  alternateMobile: true,
  familySize: true,
  houseDoorNo: true,
  locality: true,
  colony: true,
  city: true,
  pinCode: true,
  assessmentYear: true,
  ownershipType: true,
  propertyUse: true,
  propertyType: true,
  situation: true,
  roadType: true,
  taxRateZone: true,
  plotAreaSqFt: true,
  plotAreaSqMeter: true,
  plinthAreaSqFt: true,
  plinthAreaSqMeter: true,
  totalBuiltAreaSqMeter: true,
  waterConnection: true,
  sourceOfWater: true,
  sanitationType: true,
  solidWasteCollection: true,
  electricityConsumerNo: true,
  latitude: true,
  longitude: true,
  gpsAccuracyMeters: true,
  capturedAt: true,
  gpsProvider: true,
  gpsMockLocation: true,
  qcStatus: true,
  serverVersion: true,
  clientUpdatedAt: true,
  createdBy: { select: { fullName: true, email: true } },
  ward: { select: { wardName: true, wardNumber: true } },
  ulb: { select: { name: true, code: true } },
  district: { select: { name: true, code: true } },
  coOwners: { select: { name: true, fatherOrHusbandName: true, mobile: true, alternateMobile: true } },
  photos: { select: { photoType: true, url: true, capturedAt: true, sizeKB: true, width: true, height: true } },
} satisfies Prisma.SurveySelect

function normalizeFloorPosition(raw: string): string {
  return raw === "FIFTH_FLOOR_PLUS" ? "FIFTH_FLOOR" : raw
}

@Injectable()
export class ExportWorkerService {
  private readonly logger = new Logger(ExportWorkerService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: ObjectStorageService,
    private readonly config: ConfigService
  ) {}

  async process(payload: ExportJobPayload, updateProgress: (progress: number) => Promise<void>): Promise<void> {
    await this.prisma.db.exportJob.update({
      where: { id: payload.jobId },
      data: { status: JobStatus.PROCESSING, startedAt: new Date(), errorMessage: null },
    })
    await updateProgress(10)

    let uploadedKey: string | null = null
    try {
      if (payload.reportType === "demand_notices" && payload.format === "pdf") {
        const artifact = await this.renderDemandNoticeWardPdf(payload)
        await updateProgress(75)
        uploadedKey = await this.finishUpload(payload, artifact, artifact.rowCount)
        await updateProgress(100)
        this.logger.log(`Export job ${payload.jobId} completed demand_notices rows=${artifact.rowCount}`)
        return
      }

      if (payload.reportType === "district_ward_zip") {
        const artifact = await this.renderDistrictWardZip(payload, updateProgress)
        uploadedKey = await this.finishUpload(payload, artifact, artifact.rowCount)
        await updateProgress(100)
        this.logger.log(`Export job ${payload.jobId} completed district_ward_zip rows=${artifact.rowCount}`)
        return
      }

      if (payload.reportType === "survey_data" && payload.format === "xlsx") {
        const artifact = await this.renderSurveyDataStreaming(payload, updateProgress)
        uploadedKey = await this.finishUpload(payload, artifact, artifact.rowCount)
        await updateProgress(100)
        this.logger.log(`Export job ${payload.jobId} completed survey_data rows=${artifact.rowCount}`)
        return
      }

      if (payload.reportType === "qc_final" && payload.format === "xlsx") {
        const artifact = await this.renderQcFinalStreaming(payload, updateProgress)
        uploadedKey = await this.finishUpload(payload, artifact, artifact.rowCount)
        await updateProgress(100)
        this.logger.log(`Export job ${payload.jobId} completed qc_final rows=${artifact.rowCount}`)
        return
      }

      const rows = await this.findRows(payload, { take: 10_000 })
      await updateProgress(35)

      const artifact = await this.renderArtifact(payload, rows)
      await updateProgress(75)

      uploadedKey = await this.finishUpload(payload, artifact, rows.length)
      await updateProgress(100)
      this.logger.log(`Export job ${payload.jobId} completed rows=${rows.length}`)
    } catch (err) {
      if (uploadedKey) {
        try {
          await this.storageService.deleteObject(uploadedKey)
        } catch (cleanupErr) {
          this.logger.warn(`Failed to delete partial export ${uploadedKey}: ${String(cleanupErr)}`)
        }
      }
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

  private async finishUpload(
    payload: ExportJobPayload,
    artifact: { contentType: string; filename: string; buffer: Buffer },
    rowCount: number
  ): Promise<string> {
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
        rowCount,
        storageProvider: uploaded.provider,
        bucket: uploaded.bucket,
        objectKey: uploaded.key,
        filename: artifact.filename,
        finishedAt: new Date(),
      },
    })
    return uploaded.key
  }

  private exportMaxRows(): number {
    const raw = this.config.get<string>("EXPORT_MAX_ROWS")
    const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_EXPORT_MAX_ROWS
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_EXPORT_MAX_ROWS
  }

  private buildSurveyWhere(payload: ExportJobPayload, extra: Prisma.SurveyWhereInput = {}): Prisma.SurveyWhereInput {
    const scope = resolveTenantScope(payload.tenantRoles)
    const tenantWhere = buildTenantWhere(scope)

    // Independent report rules — never mix qc_final / survey_data filters.
    let filters = { ...payload.filters }
    if (payload.reportType === "qc_final") {
      if (!filters.wardId) throw new Error("wardId is required for qc_final export")
      filters = { ...filters, qcStatus: "APPROVED" }
    } else if (payload.reportType === "survey_data") {
      if (!filters.wardId) throw new Error("wardId is required for survey_data export")
      const rest = { ...filters }
      delete rest.qcStatus
      filters = rest
    }

    const dateFilter: Prisma.SurveyWhereInput = {}
    if (filters.dateFrom || filters.dateTo) {
      dateFilter.createdAt = {
        ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
      }
    }

    return {
      deletedAt: null,
      ...(tenantWhere ?? {}),
      ...(toSurveyStatus(filters.surveyStatus) ? { surveyStatus: toSurveyStatus(filters.surveyStatus) } : {}),
      ...(filters.qcStatus ? { qcStatus: filters.qcStatus as never } : {}),
      ...(filters.stateId ? { stateId: filters.stateId } : {}),
      ...(filters.districtId ? { districtId: filters.districtId } : {}),
      ...(filters.ulbId ? { ulbId: filters.ulbId } : {}),
      ...(filters.wardId ? { wardId: filters.wardId } : {}),
      ...(filters.surveyorId ? { createdById: filters.surveyorId } : {}),
      ...(filters.selectedIds?.length ? { id: { in: filters.selectedIds } } : {}),
      ...dateFilter,
      ...(filters.search
        ? {
            OR: [
              { propertyId: { contains: filters.search, mode: "insensitive" } },
              { respondentName: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...extra,
    }
  }

  private assertWrittenRowCount(written: number, expected: number, reportType: string): void {
    assertExportRowCount(written, expected, reportType)
  }

  private async resolveGeoNames(filters: ExportFiltersPayload): Promise<{
    wardName?: string
    districtName?: string
  }> {
    if (!filters.wardId) {
      const district = filters.districtId
        ? await this.prisma.db.district.findUnique({ where: { id: filters.districtId }, select: { name: true } })
        : null
      return { districtName: district?.name }
    }

    const ward = await this.prisma.db.ward.findUnique({
      where: { id: filters.wardId },
      select: {
        wardName: true,
        ulb: { select: { district: { select: { name: true } } } },
      },
    })

    let districtName = ward?.ulb.district.name
    if (!districtName && filters.districtId) {
      const district = await this.prisma.db.district.findUnique({
        where: { id: filters.districtId },
        select: { name: true },
      })
      districtName = district?.name
    }

    return { wardName: ward?.wardName, districtName }
  }

  private async assertRowBudget(where: Prisma.SurveyWhereInput): Promise<number> {
    const count = await this.prisma.db.survey.count({ where })
    if (count === 0) {
      throw new Error("No surveys match filters")
    }
    const maxRows = this.exportMaxRows()
    if (count > maxRows) {
      throw new Error(
        `Export too large (${count.toLocaleString("en-IN")} surveys). Narrow district/filters (max ${maxRows.toLocaleString("en-IN")}).`
      )
    }
    return count
  }

  private async loadFloorsBySurveyId(surveyIds: string[]): Promise<Map<string, SurveyExportBundle["floors"]>> {
    const bySurvey = new Map<string, SurveyExportBundle["floors"]>()
    if (surveyIds.length === 0) return bySurvey

    const rows = await this.prisma.db.$queryRaw<ExportFloorRow[]>`
      SELECT
        f."surveyId",
        f."floorPosition"::text AS "floorPosition",
        f."usageFactor"::text AS "usageFactor",
        f."usageType"::text AS "usageType",
        f."constructionType"::text AS "constructionType",
        f."occupancy",
        f."areaSqFt"
      FROM "floors" f
      WHERE f."surveyId" IN (${Prisma.join(surveyIds)})
    `

    for (const row of rows) {
      const floor = {
        floorPosition: normalizeFloorPosition(row.floorPosition),
        usageFactor: row.usageFactor,
        usageType: row.usageType,
        constructionType: row.constructionType,
        occupancy: row.occupancy,
        areaSqFt: row.areaSqFt,
      }
      const list = bySurvey.get(row.surveyId) ?? []
      list.push(floor)
      bySurvey.set(row.surveyId, list)
    }
    return bySurvey
  }

  private async attachFloors<T extends { id: string }>(
    surveys: T[]
  ): Promise<Array<T & { floors: SurveyExportBundle["floors"] }>> {
    const floorsBySurvey = await this.loadFloorsBySurveyId(surveys.map((survey) => survey.id))
    return surveys.map((survey) => ({
      ...survey,
      floors: floorsBySurvey.get(survey.id) ?? [],
    }))
  }

  private async *iterateSurveyBundles(where: Prisma.SurveyWhereInput): AsyncGenerator<SurveyExportBundle> {
    let cursorId: string | undefined
    for (;;) {
      const batch = await this.prisma.db.survey.findMany({
        where,
        orderBy: [
          { parcelNumber: { sort: "asc", nulls: "last" } },
          { unitSubNo: { sort: "asc", nulls: "last" } },
          { id: "asc" },
        ],
        take: EXPORT_BATCH_SIZE,
        ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
        select: SURVEY_EXPORT_SELECT,
      })
      if (batch.length === 0) break
      const withFloors = await this.attachFloors(batch)
      for (const row of withFloors) {
        yield row
      }
      cursorId = batch[batch.length - 1].id
      if (batch.length < EXPORT_BATCH_SIZE) break
    }
  }

  private async renderSurveyDataStreaming(
    payload: ExportJobPayload,
    updateProgress: (progress: number) => Promise<void>
  ) {
    const where = this.buildSurveyWhere(payload)
    const total = await this.assertRowBudget(where)
    await updateProgress(20)

    const dir = await mkdtemp(join(tmpdir(), "export-survey-data-"))
    const filename = join(dir, "survey-data.xlsx")
    try {
      const { rowCount } = await streamSurveyDataWorkbookToFile(filename, this.iterateSurveyBundles(where))
      this.assertWrittenRowCount(rowCount, total, "survey_data")
      await updateProgress(80)
      const buffer = await readFile(filename)
      const geo = await this.resolveGeoNames(payload.filters)
      return {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename: buildExportFilename({ report: "survey_data", ...geo }),
        buffer,
        rowCount,
      }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }

  private async renderQcFinalStreaming(payload: ExportJobPayload, updateProgress: (progress: number) => Promise<void>) {
    if (!payload.filters.wardId) {
      throw new Error("wardId is required for qc_final export")
    }

    const where = this.buildSurveyWhere(payload)
    const total = await this.assertRowBudget(where)
    await updateProgress(20)

    const dir = await mkdtemp(join(tmpdir(), "export-qc-final-"))
    const filename = join(dir, "qc-final.xlsx")
    try {
      const { rowCount } = await streamQcFinalWideWorkbookToFile(filename, this.iterateSurveyBundles(where))
      this.assertWrittenRowCount(rowCount, total, "qc_final")
      await updateProgress(80)
      const buffer = await readFile(filename)
      const geo = await this.resolveGeoNames(payload.filters)
      return {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename: buildExportFilename({ report: "qc_final", ...geo }),
        buffer,
        rowCount,
      }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }

  private async renderDistrictWardZip(payload: ExportJobPayload, updateProgress: (progress: number) => Promise<void>) {
    const districtId = payload.filters.districtId
    if (!districtId) throw new Error("districtId is required for district_ward_zip export")

    const where = this.buildSurveyWhere(payload)
    const totalRows = await this.assertRowBudget(where)
    await updateProgress(15)

    const district = await this.prisma.db.district.findUnique({
      where: { id: districtId },
      select: { code: true, name: true },
    })

    const wards = await this.prisma.db.ward.findMany({
      where: {
        deletedAt: null,
        ...(payload.filters.wardId ? { id: payload.filters.wardId } : {}),
        ulb: {
          districtId,
          ...(payload.filters.ulbId ? { id: payload.filters.ulbId } : {}),
        },
      },
      select: {
        id: true,
        wardNumber: true,
        wardName: true,
        ulb: { select: { code: true, name: true } },
      },
      orderBy: [{ ulb: { code: "asc" } }, { wardNumber: "asc" }],
    })

    const dir = await mkdtemp(join(tmpdir(), "export-district-zip-"))
    const zipPath = join(dir, "wards.zip")
    const archive = new ZipArchive({ zlib: { level: 6 } })
    const output = createWriteStream(zipPath)
    const outputDone = new Promise<void>((resolve, reject) => {
      output.on("close", () => resolve())
      output.on("error", reject)
      archive.on("error", reject)
    })
    archive.pipe(output)

    let wardsWithData = 0
    let exportedRows = 0

    try {
      for (const [index, ward] of wards.entries()) {
        const wardWhere = this.buildSurveyWhere(payload, { wardId: ward.id })
        const wardCount = await this.prisma.db.survey.count({ where: wardWhere })
        if (wardCount === 0) {
          await updateProgress(15 + Math.floor(((index + 1) / Math.max(wards.length, 1)) * 70))
          continue
        }

        const wardFile = join(
          dir,
          `${sanitizeExportPathSegment(ward.ulb.code)}-${sanitizeExportPathSegment(ward.wardNumber)}.xlsx`
        )
        const { rowCount } = await streamSurveyDataWorkbookToFile(wardFile, this.iterateSurveyBundles(wardWhere))
        const entryName = wardSurveyDataZipEntry(ward.ulb.code, ward.wardNumber, ward.wardName)
        archive.file(wardFile, { name: entryName })
        wardsWithData += 1
        exportedRows += rowCount
        await updateProgress(15 + Math.floor(((index + 1) / Math.max(wards.length, 1)) * 70))
      }

      if (wardsWithData === 0) {
        throw new Error("No surveys match filters")
      }

      await archive.finalize()
      await outputDone

      const buffer = await readFile(zipPath)
      const districtCode = sanitizeExportPathSegment(district?.code ?? districtId.slice(0, 8))
      return {
        contentType: "application/zip",
        filename: `survey-data-district-${districtCode}-wards.zip`,
        buffer,
        rowCount: exportedRows || totalRows,
      }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }

  private async renderDemandNoticeWardPdf(payload: ExportJobPayload) {
    const wardId = payload.filters.wardId
    if (!wardId) throw new Error("wardId is required for demand_notices PDF")

    const webInternalUrl =
      this.config.get<string>("WEB_INTERNAL_URL") ||
      this.config.get<string>("APP_URL") ||
      this.config.get<string>("NEXT_PUBLIC_APP_URL")
    if (!webInternalUrl) {
      throw new Error("WEB_INTERNAL_URL (or APP_URL) is required for demand notice PDF generation")
    }

    const printSecret =
      this.config.get<string>("DEMAND_NOTICE_PRINT_SECRET") || this.config.get<string>("CLERK_SECRET_KEY") || ""
    if (!printSecret) {
      throw new Error("DEMAND_NOTICE_PRINT_SECRET is not configured")
    }

    const buffer = await renderWardDemandNoticePdf({
      webInternalUrl,
      printSecret,
      wardId,
      assessmentYearId: payload.filters.assessmentYearId,
    })

    const wardCount = await this.prisma.db.survey.count({
      where: {
        deletedAt: null,
        qcStatus: "APPROVED",
        wardId,
      },
    })

    return {
      contentType: "application/pdf",
      filename: `demand-notices-ward-${wardId}.pdf`,
      buffer,
      rowCount: wardCount,
    }
  }

  private async findRows(payload: ExportJobPayload, options: { take?: number } = {}): Promise<ExportRow[]> {
    const rows = await this.prisma.db.survey.findMany({
      where: this.buildSurveyWhere(payload),
      orderBy: { createdAt: "desc" },
      take: options.take ?? 10_000,
      select: SURVEY_EXPORT_SELECT,
    })
    return await this.attachFloors(rows)
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
            const text =
              value == null
                ? ""
                : typeof value === "string" || typeof value === "number" || typeof value === "boolean"
                  ? String(value)
                  : JSON.stringify(value)
            return `"${text.replaceAll('"', '""')}"`
          })
          .join(",")
      )
    }
    return lines.join("\n")
  }

  private async toExcel(rows: ExportRow[], reportType: string) {
    const bundles = rows as unknown as SurveyExportBundle[]
    if (reportType === "convex_full") return renderConvexFullWorkbook(bundles)
    if (reportType === "nagar_panchayat") return renderNagarPanchayatWorkbook(bundles)
    if (reportType === "survey_data") return renderSurveyDataWorkbook(bundles)
    if (reportType === "qc_final") return renderQcFinalWideWorkbook(bundles)
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
        doc.text(`${row.propertyId} | ${row.surveyStatus} | ${row.respondentName ?? ""} | ${row.ulbId} | ${row.wardId}`)
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
