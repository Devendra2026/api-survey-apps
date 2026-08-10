import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common"
import {
  AssessmentYear,
  ConstructionType,
  FloorPosition,
  GpsSource,
  JobStatus,
  OwnershipType,
  PhotoType,
  PropertyType,
  PropertyUse,
  QcStatus,
  RoadType,
  SanitationType,
  Situation,
  SourceOfWater,
  SurveyStatus,
  TaxRateZone,
  UsageFactor,
  UsageType,
  WaterConnection,
  type Prisma,
} from "@workspace/database"
import type { ImageMigrationPayload } from "@workspace/jobs"
import {
  checkPropertyIdGeoConsistency,
  collectWorkbookGeoPairs,
  disambiguateImportPropertyId,
  emptyToUndefinedNormalized,
  formatDuplicateWorkbookError,
  formatGeoResolveError,
  formatMissingUlbMasterAbort,
  importChildJoinKey,
  mapAssessmentYear,
  mapConstructionType,
  mapFloorPosition,
  mapGpsSource,
  mapOwnershipType,
  mapPhotoType,
  mapPropertyType,
  mapPropertyUse,
  mapQcStatus,
  mapRoadType,
  mapSanitationType,
  mapSituation,
  mapSourceOfWater,
  mapSurveyStatus,
  mapTaxRateZone,
  mapUsageFactor,
  mapUsageType,
  mapWaterConnection,
  normalizeImportString,
  parseNumber,
  parsePropertyId,
  parseYn,
  resolveImportGeo,
  resolveImportPropertyId,
  sqFtToSqMeter,
  type GeoResolved,
  type GeoResolveResult,
} from "@workspace/validation"
import { randomUUID } from "node:crypto"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { canAccessTenant, resolveTenantScope } from "../common/utils/tenant-scope.util.js"
import { JobsService } from "../jobs/jobs.service.js"
import { PrismaService } from "../prisma/prisma.service.js"
import { StorageService } from "../storage/storage.service.js"
import {
  findWorkbookDuplicates,
  groupRowsByPropertyId,
  parseConvexWorkbook,
  type ParsedConvexWorkbook,
  type WorkbookRow,
} from "./convex-workbook-parser.js"

const SYNC_IMPORT_MAX_ROWS = 500
const SYNC_IMPORT_MAX_BYTES = 2 * 1024 * 1024
const CHUNK_SIZE = 50

export interface ImportRowError {
  row: number
  propertyId?: string
  localId?: string
  errors: string[]
}

export interface ImportSummary {
  totalRows: number
  successCount: number
  failureCount: number
  photoSuccessCount: number
  photoFailureCount: number
  photoMigrationEnqueued?: number
  duplicatePropertyIdCount?: number
  duplicateLocalIdCount?: number
  missingMasterPairs?: Array<{ ulbCode: string; wardNumber: string; reason: string; sampleRows: number[] }>
  createdSurveyIds: string[]
  updatedSurveyIds: string[]
  errors: ImportRowError[]
}

export interface ImportPreviewWarning {
  code: string
  message: string
}

export interface ImportPreviewResult {
  originalName: string
  format: "multi-sheet" | "inline-children" | "surveys-only" | "csv"
  surveyRows: number
  coOwnerRows: number
  floorRows: number
  photoRows: number
  missingPropertyIdRows: number
  missingUlbOrWardRows: number
  duplicatePropertyIdCount: number
  duplicateLocalIdCount: number
  duplicates: Array<{ kind: "propertyId" | "localId"; key: string; rows: number[] }>
  usedInlineColumns: boolean
  sheetPreferredWarning: boolean
  canImport: boolean
  warnings: ImportPreviewWarning[]
  sampleErrors: ImportRowError[]
}

interface MappedSurvey {
  rowNumber: number
  propertyId: string
  sheetPropertyId: string
  propertyIdSource: "sheet" | "derived"
  occurrence: number
  forceCreate: boolean
  localId?: string
  data: Prisma.SurveyUncheckedCreateInput
}

function applyPropertyIdOccurrence(mapped: MappedSurvey, occurrenceByPropertyId: Map<string, number>): MappedSurvey {
  const sheetKey = mapped.sheetPropertyId.toUpperCase()
  const occurrence = (occurrenceByPropertyId.get(sheetKey) ?? 0) + 1
  occurrenceByPropertyId.set(sheetKey, occurrence)
  if (occurrence <= 1) {
    return { ...mapped, occurrence, forceCreate: false }
  }
  const disambiguated = disambiguateImportPropertyId(mapped.sheetPropertyId, occurrence)
  return {
    ...mapped,
    occurrence,
    forceCreate: true,
    propertyId: disambiguated,
    data: {
      ...mapped.data,
      propertyId: disambiguated,
      propertyIdOld: mapped.data.propertyIdOld || mapped.sheetPropertyId,
    },
  }
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

    await this.prisma.db.securityAudit.create({
      data: {
        action: "IMPORT_ENQUEUED",
        actorId: user.id,
        targetType: "ImportJob",
        targetId: job.id,
        metadata: {
          originalName: file.originalname,
          sizeBytes: file.size,
          objectKey: uploaded.key,
        },
      },
    })

    return { jobId: job.id, status: JobStatus.QUEUED }
  }

  async listJobs(user: AuthenticatedUser, take = 50) {
    const limit = Math.min(Math.max(take, 1), 100)
    return this.prisma.db.importJob.findMany({
      where: { createdById: user.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        status: true,
        originalName: true,
        totalRows: true,
        processedRows: true,
        successCount: true,
        failureCount: true,
        photoSuccessCount: true,
        photoFailureCount: true,
        errorMessage: true,
        errorReportKey: true,
        checkpoint: true,
        resultSummary: true,
        startedAt: true,
        finishedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }

  async getJob(user: AuthenticatedUser, jobId: string) {
    const job = await this.prisma.db.importJob.findFirst({
      where: { id: jobId, createdById: user.id },
    })
    if (!job) throw new NotFoundException("Import job not found")
    return job
  }

  async resumeJob(user: AuthenticatedUser, jobId: string) {
    const job = await this.getJob(user, jobId)
    if (!job.objectKey || !job.bucket) {
      throw new BadRequestException("Import job has no stored workbook to resume")
    }
    if (job.status === JobStatus.PROCESSING || job.status === JobStatus.QUEUED) {
      throw new BadRequestException("Import job is already queued or processing")
    }
    if (job.status === JobStatus.SUCCEEDED && job.processedRows >= job.totalRows && job.totalRows > 0) {
      throw new BadRequestException("Import job already completed")
    }

    await this.prisma.db.importJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.QUEUED,
        errorMessage: null,
        finishedAt: null,
      },
    })

    await this.jobsService.enqueueImport({
      jobId: job.id,
      createdById: user.id,
      originalName: job.originalName,
      mimeType: job.mimeType || undefined,
      sizeBytes: 0,
      bucket: job.bucket,
      storageProvider: job.storageProvider ?? undefined,
      objectKey: job.objectKey,
      tenantRoles: user.tenantRoles,
      resumeFromCheckpoint: true,
    })

    return { jobId: job.id, status: JobStatus.QUEUED, resumeFromCheckpoint: true }
  }

  async retryFailedRows(user: AuthenticatedUser, jobId: string) {
    const job = await this.getJob(user, jobId)
    if (!job.objectKey || !job.bucket) {
      throw new BadRequestException("Import job has no stored workbook to retry")
    }
    if (job.status === JobStatus.PROCESSING || job.status === JobStatus.QUEUED) {
      throw new BadRequestException("Import job is already queued or processing")
    }

    const summary = job.resultSummary
    const errors =
      summary &&
      typeof summary === "object" &&
      !Array.isArray(summary) &&
      Array.isArray((summary as { errors?: unknown }).errors)
        ? ((summary as { errors: Array<{ row?: number; propertyId?: string; localId?: string }> }).errors ?? [])
        : []

    if (!errors.length) {
      throw new BadRequestException("No failed rows recorded for this import job")
    }

    const failedPropertyIds = [
      ...new Set(errors.map((error) => error.propertyId).filter((id): id is string => Boolean(id))),
    ]
    const failedLocalIds = [...new Set(errors.map((error) => error.localId).filter((id): id is string => Boolean(id)))]
    const failedRows = [
      ...new Set(errors.map((error) => error.row).filter((row): row is number => typeof row === "number")),
    ]

    await this.prisma.db.importJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.QUEUED,
        errorMessage: null,
        finishedAt: null,
        processedRows: 0,
        successCount: 0,
        failureCount: 0,
      },
    })

    await this.jobsService.enqueueImport({
      jobId: job.id,
      createdById: user.id,
      originalName: job.originalName,
      mimeType: job.mimeType || undefined,
      sizeBytes: 0,
      bucket: job.bucket,
      storageProvider: job.storageProvider ?? undefined,
      objectKey: job.objectKey,
      tenantRoles: user.tenantRoles,
      retryFailedOnly: true,
      failedPropertyIds,
      failedLocalIds,
      failedRows,
    })

    return {
      jobId: job.id,
      status: JobStatus.QUEUED,
      retryFailedOnly: true,
      failedCount: errors.length,
    }
  }

  async getErrorReport(user: AuthenticatedUser, jobId: string) {
    const job = await this.getJob(user, jobId)
    if (!job.errorReportKey) {
      throw new NotFoundException("Validation report is not available for this import job")
    }
    const url = await this.storageService.getPresignedDownloadUrl(job.errorReportKey, 900)
    return {
      jobId: job.id,
      errorReportKey: job.errorReportKey,
      url,
      expiresInSeconds: 900,
      resultSummary: job.resultSummary,
    }
  }

  /**
   * Parse + validate workbook without enqueueing a job or writing surveys.
   * Used by the /import UI confirm step.
   */
  async previewSurveyImport(file: Express.Multer.File): Promise<ImportPreviewResult> {
    this.validateImportFile(file)

    let workbook: ParsedConvexWorkbook
    try {
      workbook = await parseConvexWorkbook(file.buffer, file.originalname)
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : "Failed to parse workbook")
    }

    const duplicates = findWorkbookDuplicates(workbook.surveys)
    const duplicatePropertyIdCount = duplicates.filter((d) => d.kind === "propertyId").length
    const duplicateLocalIdCount = duplicates.filter((d) => d.kind === "localId").length

    let missingPropertyIdRows = 0
    let missingUlbOrWardRows = 0
    const sampleErrors: ImportRowError[] = []

    workbook.surveys.forEach((row, index) => {
      const excelRow = index + 2
      const sheetPropertyId = normalizeImportString(row["Property ID"])
      const ulbCode = normalizeImportString(row["ULB Code"])
      const wardNumber = normalizeImportString(row["Ward Number"])
      const parcelNo = normalizeImportString(row["Parcel Number"])
      const unitNo = normalizeImportString(row["Unit / Sub-No"])
      const propertyUse = mapPropertyUse(row["Property Use"])
      const resolvedPid = resolveImportPropertyId({
        sheetPropertyId,
        ulbCode,
        wardNo: wardNumber,
        parcelNo,
        unitNo,
        propertyUse,
      })
      const propertyId = resolvedPid.propertyId ?? sheetPropertyId
      const errors: string[] = []
      if (resolvedPid.source === "missing") {
        missingPropertyIdRows += 1
        errors.push("Missing Property ID (provide Property ID or ULB/Ward/Parcel/Unit/Property Use to derive it)")
      }
      if (!ulbCode || !wardNumber) {
        missingUlbOrWardRows += 1
        errors.push("Missing ULB Code or Ward Number")
      }
      if (errors.length && sampleErrors.length < 25) {
        sampleErrors.push({
          row: excelRow,
          propertyId: propertyId || undefined,
          localId: normalizeImportString(row["Local ID"]) || undefined,
          errors,
        })
      }
    })

    for (const issue of duplicates) {
      if (sampleErrors.length >= 40) break
      sampleErrors.push({
        row: issue.rows[0] ?? 2,
        propertyId: issue.kind === "propertyId" ? issue.key : undefined,
        localId: issue.kind === "localId" ? issue.key : undefined,
        errors: [formatDuplicateWorkbookError(issue.kind, issue.key, issue.rows)],
      })
    }

    const usedInline = Boolean(workbook.usedInlineColumns)
    const hasChildRows = workbook.coOwners.length > 0 || workbook.floors.length > 0 || workbook.photos.length > 0
    const isCsv = file.originalname.toLowerCase().endsWith(".csv")
    const format: ImportPreviewResult["format"] = isCsv
      ? "csv"
      : usedInline
        ? "inline-children"
        : hasChildRows
          ? "multi-sheet"
          : "surveys-only"

    const warnings: ImportPreviewWarning[] = []
    if (workbook.sheetPreferredWarning) {
      warnings.push({
        code: "SHEET_PREFERRED",
        message: "Dedicated CoOwners/Floors/Photos sheets were used; inline Surveys columns were ignored.",
      })
    }
    if (usedInline) {
      warnings.push({
        code: "INLINE_EXPANDED",
        message: `Expanded inline columns into ${workbook.coOwners.length} co-owners, ${workbook.floors.length} floors, ${workbook.photos.length} photos.`,
      })
    }
    if (duplicatePropertyIdCount || duplicateLocalIdCount) {
      warnings.push({
        code: "WORKBOOK_DUPLICATES",
        message: `Workbook has ${duplicatePropertyIdCount} duplicate Property ID(s) and ${duplicateLocalIdCount} duplicate Local ID(s). First Property ID upserts; extras import as -D2/-D3 for QC correction.`,
      })
    }
    if (missingPropertyIdRows > 0) {
      warnings.push({
        code: "MISSING_PROPERTY_ID",
        message: `${missingPropertyIdRows} row(s) missing Property ID and cannot derive from ULB/Ward/Parcel/Unit/Use (blocking).`,
      })
    }
    if (missingUlbOrWardRows > 0) {
      warnings.push({
        code: "MISSING_GEO",
        message: `${missingUlbOrWardRows} row(s) missing ULB Code or Ward Number.`,
      })
    }

    const canImport = workbook.surveys.length > 0

    return {
      originalName: file.originalname,
      format,
      surveyRows: workbook.surveys.length,
      coOwnerRows: workbook.coOwners.length,
      floorRows: workbook.floors.length,
      photoRows: workbook.photos.length,
      missingPropertyIdRows,
      missingUlbOrWardRows,
      duplicatePropertyIdCount,
      duplicateLocalIdCount,
      duplicates,
      usedInlineColumns: usedInline,
      sheetPreferredWarning: Boolean(workbook.sheetPreferredWarning),
      canImport,
      warnings,
      sampleErrors,
    }
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

    let workbook: ParsedConvexWorkbook
    try {
      workbook = await parseConvexWorkbook(file.buffer, file.originalname)
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : "Failed to parse workbook")
    }

    if (options.enforceSyncCap && workbook.surveys.length > SYNC_IMPORT_MAX_ROWS) {
      throw new BadRequestException("Synchronous imports are capped at 500 rows. Retry without ?sync=true.")
    }

    const coOwnersByPid = groupRowsByPropertyId(workbook.coOwners)
    const floorsByPid = groupRowsByPropertyId(workbook.floors)
    const photosByPid = groupRowsByPropertyId(workbook.photos)
    const scope = resolveTenantScope(user.tenantRoles)
    const geoCache = new Map<string, GeoResolveResult>()
    const errors: ImportRowError[] = []
    const createdSurveyIds: string[] = []
    const updatedSurveyIds: string[] = []
    let successCount = 0
    let photoSuccessCount = 0
    let photoFailureCount = 0

    const duplicates = findWorkbookDuplicates(workbook.surveys)
    const duplicatePropertyIds = new Set(
      duplicates.filter((item) => item.kind === "propertyId").map((item) => item.key)
    )
    const duplicateLocalIds = new Set(duplicates.filter((item) => item.kind === "localId").map((item) => item.key))
    const duplicatePropertyIdCount = duplicatePropertyIds.size
    const duplicateLocalIdCount = duplicateLocalIds.size

    // Duplicates are imported; keep details in the summary, not as row failures.
    let failureCount = 0
    const occurrenceByPropertyId = new Map<string, number>()

    const missingMasterPairs: ImportSummary["missingMasterPairs"] = []
    const geoPairs = collectWorkbookGeoPairs(workbook.surveys)
    const missingUlbCodes: string[] = []
    for (const pair of geoPairs) {
      const resolved = await resolveImportGeo(this.prisma.db, pair.ulbCode, pair.wardNumber, geoCache)
      if (!resolved.ok) {
        missingMasterPairs.push({
          ulbCode: pair.ulbCode,
          wardNumber: pair.wardNumber,
          reason: resolved.message,
          sampleRows: pair.sampleRows,
        })
        if (resolved.reason === "ULB_NOT_FOUND") {
          missingUlbCodes.push(resolved.lookupCode || pair.ulbCode)
        }
        errors.push({
          row: pair.sampleRows[0] ?? 0,
          errors: [`Master data missing: ${resolved.message} (sample rows ${pair.sampleRows.join(", ")})`],
        })
      }
    }

    // Fail closed: do not process survey rows when required ULB masters are absent.
    if (missingUlbCodes.length) {
      throw new BadRequestException({
        message: formatMissingUlbMasterAbort(missingUlbCodes),
        missingUlbCodes: [...new Set(missingUlbCodes)],
        missingMasterPairs,
        duplicatePropertyIdCount,
        duplicateLocalIdCount,
        errors: errors.slice(0, 50),
      })
    }

    for (let offset = 0; offset < workbook.surveys.length; offset += CHUNK_SIZE) {
      const chunkRows = workbook.surveys.slice(offset, offset + CHUNK_SIZE)
      const mappedChunk: MappedSurvey[] = []

      for (const [i, row] of chunkRows.entries()) {
        const rowNumber = offset + i + 2
        const mapped = await this.mapSurveyRow(row, rowNumber, user, scope, geoCache, errors)
        if (mapped) mappedChunk.push(applyPropertyIdOccurrence(mapped, occurrenceByPropertyId))
        else failureCount += 1
      }

      const lookupPropertyIds = mappedChunk.filter((item) => !item.forceCreate).map((item) => item.sheetPropertyId)
      const localIds = mappedChunk
        .filter((item) => !item.forceCreate)
        .map((item) => item.localId)
        .filter((id): id is string => Boolean(id))

      const existingByProperty = lookupPropertyIds.length
        ? await this.prisma.db.survey.findMany({
            where: { deletedAt: null, propertyId: { in: lookupPropertyIds } },
            select: { id: true, propertyId: true, localId: true },
          })
        : []
      const byPropertyId = new Map(existingByProperty.map((s) => [s.propertyId.toUpperCase(), s]))

      const existingByLocal =
        localIds.length > 0
          ? await this.prisma.db.survey.findMany({
              where: {
                deletedAt: null,
                localId: { in: localIds },
                NOT: lookupPropertyIds.length ? { propertyId: { in: lookupPropertyIds } } : undefined,
              },
              select: { id: true, propertyId: true, localId: true },
            })
          : []
      const byLocalId = new Map(
        existingByLocal.filter((s) => s.localId).map((s) => [String(s.localId).toUpperCase(), s])
      )

      for (const item of mappedChunk) {
        try {
          const existing = item.forceCreate
            ? undefined
            : (byPropertyId.get(item.sheetPropertyId.toUpperCase()) ??
              (item.localId ? byLocalId.get(item.localId.toUpperCase()) : undefined))

          const result = await this.prisma.db.$transaction(async (tx) => {
            let surveyId: string
            let created = false

            if (existing) {
              const { createdById, assignedToId, assignedAt, ...updateFields } = item.data
              void createdById
              void assignedToId
              void assignedAt
              await tx.survey.update({
                where: { id: existing.id },
                data: updateFields,
              })
              surveyId = existing.id
              await tx.surveyAudit.create({
                data: {
                  surveyId,
                  action: "IMPORT_UPDATED",
                  newValue: { propertyId: item.propertyId },
                  changedBy: user.id,
                },
              })
            } else {
              const createdSurvey = await tx.survey.create({ data: item.data })
              surveyId = createdSurvey.id
              created = true
              await tx.surveyAudit.create({
                data: {
                  surveyId,
                  action: "IMPORTED",
                  newValue: {
                    propertyId: item.propertyId,
                    sheetPropertyId: item.sheetPropertyId,
                    propertyIdSource: item.propertyIdSource,
                    occurrence: item.occurrence,
                  },
                  changedBy: user.id,
                },
              })
            }

            const childKey = item.sheetPropertyId.toUpperCase()

            await tx.coOwner.deleteMany({ where: { surveyId } })
            for (const [idx, ownerRow] of (coOwnersByPid.get(childKey) ?? []).entries()) {
              const name = String(ownerRow.Name ?? "").trim()
              if (!name) continue
              await tx.coOwner.create({
                data: {
                  surveyId,
                  ownerIndex: parseNumber(ownerRow["Owner Index"]) ?? idx + 1,
                  name,
                  fatherOrHusbandName: emptyToUndefined(ownerRow["Father / Husband Name"]),
                  mobile: emptyToUndefined(ownerRow.Mobile),
                  alternateMobile: emptyToUndefined(ownerRow["Alt Mobile"]),
                },
              })
            }

            await tx.floor.deleteMany({ where: { surveyId } })
            const seenFloorKeys = new Set<string>()
            for (const floorRow of floorsByPid.get(childKey) ?? []) {
              const positionRaw = mapFloorPosition(floorRow.Floor)
              if (!positionRaw || !isFloorPosition(positionRaw)) continue
              const usageFactor = asEnum(mapUsageFactor(floorRow["Usage Factor"]), isUsageFactor)
              if (!usageFactor) continue
              const constructionType =
                asEnum(mapConstructionType(floorRow["Construction Type"]), isConstructionType) ??
                ConstructionType.PAKKA_BUILDING_WITH_RCC_ROOF
              const floorKey = `${positionRaw}::${usageFactor}::${constructionType}`
              if (seenFloorKeys.has(floorKey)) continue
              seenFloorKeys.add(floorKey)
              await tx.floor.create({
                data: {
                  surveyId,
                  clientFloorId: emptyToUndefined(floorRow["Client Floor ID"]),
                  floorPosition: positionRaw,
                  usageFactor,
                  usageType: asEnum(mapUsageType(floorRow["Usage Type"]), isUsageType),
                  constructionType,
                  occupancy: emptyToUndefined(floorRow.Occupancy),
                  areaSqFt: parseNumber(floorRow["Area (Sqft)"]),
                  position: parseNumber(floorRow.Position) ?? 0,
                },
              })
            }

            await tx.photo.deleteMany({ where: { surveyId } })
            let photoOk = 0
            let photoFail = 0
            for (const photoRow of photosByPid.get(childKey) ?? []) {
              try {
                const photoTypeRaw = mapPhotoType(photoRow["Slot Key"] || photoRow.Slot)
                if (!photoTypeRaw || !isPhotoType(photoTypeRaw)) {
                  photoFail += 1
                  continue
                }
                const sourceUrl = emptyToUndefined(photoRow["Photo URL"])
                if (!sourceUrl) {
                  photoFail += 1
                  continue
                }
                await tx.photo.create({
                  data: {
                    surveyId,
                    photoType: photoTypeRaw,
                    url: sourceUrl,
                    sourceUrl,
                    importStatus: "PENDING",
                    sizeKB: parseNumber(photoRow["Size (KB)"]),
                    width: parseNumber(photoRow.Width),
                    height: parseNumber(photoRow.Height),
                    capturedAt: parseDate(photoRow["Captured At"]),
                  },
                })
                photoOk += 1
              } catch {
                photoFail += 1
              }
            }

            return { surveyId, created, photoOk, photoFail }
          })

          if (result.created) {
            createdSurveyIds.push(result.surveyId)
            if (!item.forceCreate) {
              byPropertyId.set(item.sheetPropertyId.toUpperCase(), {
                id: result.surveyId,
                propertyId: item.propertyId,
                localId: item.localId ?? null,
              })
            }
          } else updatedSurveyIds.push(result.surveyId)
          successCount += 1
          photoSuccessCount += result.photoOk
          photoFailureCount += result.photoFail
        } catch (err) {
          failureCount += 1
          errors.push({
            row: item.rowNumber,
            propertyId: item.propertyId,
            localId: item.localId,
            errors: [err instanceof Error ? err.message : String(err)],
          })
        }
      }
    }

    const surveyIdsForPhotos = [...createdSurveyIds, ...updatedSurveyIds]
    let photoMigrationEnqueued = 0
    if (surveyIdsForPhotos.length) {
      photoMigrationEnqueued = await this.enqueuePendingPhotoMigrations(surveyIdsForPhotos, user.id)
    }

    const summary: ImportSummary = {
      totalRows: workbook.surveys.length,
      successCount,
      failureCount,
      photoSuccessCount,
      photoFailureCount,
      photoMigrationEnqueued,
      duplicatePropertyIdCount,
      duplicateLocalIdCount,
      missingMasterPairs,
      createdSurveyIds,
      updatedSurveyIds,
      errors,
    }
    this.logger.log(
      `Survey import by=${user.id} total=${summary.totalRows} ok=${summary.successCount} fail=${summary.failureCount} photosQueued=${photoMigrationEnqueued}`
    )
    return summary
  }

  private async enqueuePendingPhotoMigrations(surveyIds: string[], createdById: string): Promise<number> {
    const photos = await this.prisma.db.photo.findMany({
      where: {
        surveyId: { in: surveyIds },
        importStatus: "PENDING",
        sourceUrl: { not: null },
      },
      select: { id: true, surveyId: true, sourceUrl: true, photoType: true },
      take: 50_000,
    })
    const payloads: ImageMigrationPayload[] = photos
      .filter((p): p is typeof p & { sourceUrl: string } => Boolean(p.sourceUrl))
      .map((p) => ({
        // Empty: sync imports have no ImportJob row for photo success counters.
        importJobId: "",
        surveyId: p.surveyId,
        photoId: p.id,
        sourceUrl: p.sourceUrl,
        photoType: p.photoType,
        createdById,
      }))
    if (!payloads.length) return 0
    return this.jobsService.enqueueImageMigrationBulk(payloads)
  }

  private async mapSurveyRow(
    row: WorkbookRow,
    rowNumber: number,
    user: AuthenticatedUser,
    scope: ReturnType<typeof resolveTenantScope>,
    geoCache: Map<string, GeoResolveResult>,
    errors: ImportRowError[]
  ): Promise<MappedSurvey | null> {
    const rowErrors: string[] = []
    const localId = emptyToUndefined(row["Local ID"])
    const legacySurveyId = emptyToUndefined(row["Survey ID"])
    let parcelNo = emptyToUndefined(row["Parcel Number"])
    let unitNo = emptyToUndefined(row["Unit / Sub-No"])
    const propertyUseMapped = mapPropertyUse(row["Property Use"])

    let propertyId = emptyToUndefined(row["Property ID"])?.toUpperCase()
    const sheetPropertyIdRaw = propertyId
    const childJoinKey = importChildJoinKey(row) || sheetPropertyIdRaw || ""
    const excelUlbCode = firstRowValue(row, ["ULB Code", "Municipality Code", "municipalityCode", "ULB"])
    const excelWardNumber = firstRowValue(row, ["Ward Number", "Ward No", "Ward", "wardNo"])

    let ulbCodeRaw = excelUlbCode
    let wardNumberRaw = excelWardNumber

    const resolvedPid = resolveImportPropertyId({
      sheetPropertyId: sheetPropertyIdRaw,
      ulbCode: ulbCodeRaw,
      wardNo: wardNumberRaw,
      parcelNo,
      unitNo,
      propertyUse: propertyUseMapped,
    })
    if (resolvedPid.source === "missing" || !resolvedPid.propertyId) {
      propertyId = undefined
      rowErrors.push("Missing Property ID (provide Property ID or ULB/Ward/Parcel/Unit/Property Use to derive it)")
    } else {
      propertyId = resolvedPid.propertyId
    }
    const propertyIdSource: "sheet" | "derived" = resolvedPid.source === "derived" ? "derived" : "sheet"
    const sheetPropertyId = childJoinKey || propertyId || ""

    const consistencyError = propertyId
      ? checkPropertyIdGeoConsistency({
          propertyId,
          excelUlbCode,
          excelWardNumber,
        })
      : undefined
    if (consistencyError) rowErrors.push(consistencyError)

    // Property ID encodes ULB (6) + Ward (3); use it when Excel ULB/Ward columns are blank.
    const parsedPropertyId = propertyId ? parsePropertyId(propertyId) : null
    if (!ulbCodeRaw && parsedPropertyId) ulbCodeRaw = parsedPropertyId.ulbCode
    if (!wardNumberRaw && parsedPropertyId) wardNumberRaw = parsedPropertyId.wardNo
    if (!parcelNo && parsedPropertyId) parcelNo = parsedPropertyId.parcelNo
    if (!unitNo && parsedPropertyId) unitNo = parsedPropertyId.unitNo

    const assessmentMapped = mapAssessmentYear(row["Assessment Year"])
    if (emptyToUndefined(row["Assessment Year"]) && !assessmentMapped) {
      rowErrors.push(`Invalid Assessment Year: ${row["Assessment Year"]}`)
    }
    const assessmentYear = (assessmentMapped ?? AssessmentYear.AY_2025_2026) as AssessmentYear

    let geo: GeoResolved | null = null
    if (ulbCodeRaw && wardNumberRaw) {
      const geoResult = await resolveImportGeo(this.prisma.db, ulbCodeRaw, wardNumberRaw, geoCache)
      if (geoResult.ok) {
        geo = geoResult.geo
      } else {
        rowErrors.push(formatGeoResolveError(geoResult))
      }
    } else {
      rowErrors.push("Missing ULB Code or Ward Number")
    }

    this.logger.debug({
      rowNumber,
      propertyId,
      propertyIdSource,
      sheetPropertyId,
      excelUlbCode: excelUlbCode ?? null,
      excelWardNumber: excelWardNumber ?? null,
      derivedUlbCode: ulbCodeRaw ?? null,
      derivedWardNumber: wardNumberRaw ?? null,
      dbUlbCode: geo?.ulbCode ?? null,
      dbWardNumber: geo?.wardNumber ?? null,
      validationResult: rowErrors.length ? rowErrors : "ok",
    })

    const ownershipType = asEnum(mapOwnershipType(row["Ownership Type"]), isOwnershipType)
    const propertyUse = asEnum(propertyUseMapped, isPropertyUse)
    const propertyType = asEnum(mapPropertyType(row["Property Type"]), isPropertyType)
    if (emptyToUndefined(row["Ownership Type"]) && !ownershipType) {
      rowErrors.push(`Invalid Ownership Type: ${row["Ownership Type"]}`)
    }
    if (emptyToUndefined(row["Property Use"]) && !propertyUse) {
      rowErrors.push(`Invalid Property Use: ${row["Property Use"]}`)
    }
    if (emptyToUndefined(row["Property Type"]) && !propertyType) {
      rowErrors.push(`Invalid Property Type: ${row["Property Type"]}`)
    }

    if (geo && !canAccessTenant(scope, geo)) {
      rowErrors.push("Row is outside your tenant scope")
    }

    if (rowErrors.length || !propertyId || !geo) {
      errors.push({
        row: rowNumber,
        propertyId,
        localId,
        errors: rowErrors.length ? rowErrors : ["Invalid survey row"],
      })
      return null
    }

    const plotAreaSqFt = parseNumber(row["Plot Area SqFt"])
    const plinthAreaSqFt = parseNumber(row["Plinth Area SqFt"])
    const totalBuiltAreaSqFt = parseNumber(row["Total Built Up Area SqFt"])

    const ynWater = parseYn(row["Water Connection?"])
    const waterConnection =
      asEnum(mapWaterConnection(row["Water Connection?"]), isWaterConnection) ??
      (ynWater === true ? WaterConnection.YES : ynWater === false ? WaterConnection.NO : undefined)

    const data: Prisma.SurveyUncheckedCreateInput = {
      propertyId,
      localId,
      legacySurveyId,
      propertyIdOld: emptyToUndefined(row["Property ID (Old)"]),
      parcelNumber: parcelNo,
      unitSubNo: unitNo,
      sectorNo: emptyToUndefined(row["Sector / Zone"]),
      constructedYear: parseNumber(row["Constructed Year"]),
      isSlum: parseYn(row["Slum Area"]) ?? false,
      wardNumber: geo.wardNumber,
      ulbCode: geo.ulbCode,
      districtName: emptyToUndefined(row.District),
      stateId: geo.stateId,
      districtId: geo.districtId,
      ulbId: geo.ulbId,
      wardId: geo.wardId,
      respondentName: emptyToUndefined(row["Respondent Name"]),
      relationshipWithOwner: emptyToUndefined(row["Relationship with Owner"]),
      familySize: parseNumber(row["Family Size"]),
      mobileNumber: emptyToUndefined(row["Mobile Number"]),
      alternateMobile: emptyToUndefined(row["Alt Mobile"]),
      houseDoorNo: emptyToUndefined(row["House / Door No"]),
      locality: emptyToUndefined(row["Locality / Landmark"]),
      colony: emptyToUndefined(row["Colony / Society"]),
      city: emptyToUndefined(row.City),
      pinCode: emptyToUndefined(row["Pin Code"]),
      assessmentYear,
      ownershipType,
      propertyUse,
      propertyType,
      situation: asEnum(mapSituation(row.Situation), isSituation),
      roadType: asEnum(mapRoadType(row["Road Type"]), isRoadType),
      taxRateZone: asEnum(mapTaxRateZone(row["Tax Rate Zone"]), isTaxRateZone),
      plotAreaSqFt,
      plotAreaSqMeter: parseNumber(row["Plot Area SqMeter"]) ?? sqFtToSqMeter(plotAreaSqFt),
      plinthAreaSqFt,
      plinthAreaSqMeter: parseNumber(row["Plinth Area SqMeter"]) ?? sqFtToSqMeter(plinthAreaSqFt),
      totalBuiltAreaSqFt,
      totalBuiltAreaSqMeter: parseNumber(row["Total Built Up Area SqMeter"]) ?? sqFtToSqMeter(totalBuiltAreaSqFt),
      waterConnection,
      sourceOfWater: asEnum(mapSourceOfWater(row["Source of Water"]), isSourceOfWater),
      sanitationType: asEnum(mapSanitationType(row["Sanitation Type"]), isSanitationType),
      solidWasteCollection: parseYn(row["Door-to-door Waste Collection"]),
      electricityConsumerNo: emptyToUndefined(row["Electricity Consumer No"]),
      latitude: parseNumber(row["GPS Latitude"]),
      longitude: parseNumber(row["GPS Longitude"]),
      gpsAccuracyMeters: parseNumber(row["GPS Accuracy (m)"]),
      gpsProvider: emptyToUndefined(row["GPS Provider"]),
      gpsMockLocation: parseYn(row["GPS Mock Location"]),
      gpsSource: asEnum(mapGpsSource("import"), isGpsSource) ?? GpsSource.IMPORT,
      capturedAt: parseDate(row["GPS Captured At"]),
      surveyStatus: asEnum(mapSurveyStatus(row["Survey Status"]), isSurveyStatus) ?? SurveyStatus.DRAFT,
      qcStatus: asEnum(mapQcStatus(row["QC Status"]), isQcStatus) ?? QcStatus.PENDING,
      serverVersion: parseNumber(row["Server Version"]) ?? 1,
      clientUpdatedAt: parseDate(row["Client Updated At"]),
      submittedAt: parseDate(row["Submitted At"]),
      createdById: user.id,
      assignedToId: user.id,
      assignedAt: new Date(),
    }

    return {
      rowNumber,
      propertyId,
      sheetPropertyId,
      propertyIdSource,
      occurrence: 1,
      forceCreate: false,
      localId,
      data,
    }
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
}

function emptyToUndefined(value: string | undefined | null): string | undefined {
  return emptyToUndefinedNormalized(value)
}

function firstRowValue(row: WorkbookRow, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = emptyToUndefined(row[key])
    if (value) return value
  }
  // Case-insensitive / whitespace-normalized fallback for excel header drift
  const normalized = new Map(
    Object.entries(row).map(([header, value]) => [
      normalizeImportString(header).toLowerCase().replace(/\s+/g, " "),
      value,
    ])
  )
  for (const key of keys) {
    const value = emptyToUndefined(normalized.get(key.trim().toLowerCase().replace(/\s+/g, " ")))
    if (value) return value
  }
  return undefined
}

function parseDate(raw: string | undefined): Date | undefined {
  if (!raw || !String(raw).trim()) return undefined
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? undefined : d
}

function asEnum<T extends string>(value: string | undefined, guard: (v: string) => v is T): T | undefined {
  if (!value) return undefined
  return guard(value) ? value : undefined
}

function isOwnershipType(v: string): v is OwnershipType {
  return Object.values(OwnershipType).includes(v as OwnershipType)
}
function isPropertyUse(v: string): v is PropertyUse {
  return Object.values(PropertyUse).includes(v as PropertyUse)
}
function isPropertyType(v: string): v is PropertyType {
  return Object.values(PropertyType).includes(v as PropertyType)
}
function isSituation(v: string): v is Situation {
  return Object.values(Situation).includes(v as Situation)
}
function isRoadType(v: string): v is RoadType {
  return Object.values(RoadType).includes(v as RoadType)
}
function isTaxRateZone(v: string): v is TaxRateZone {
  return Object.values(TaxRateZone).includes(v as TaxRateZone)
}
function isWaterConnection(v: string): v is WaterConnection {
  return Object.values(WaterConnection).includes(v as WaterConnection)
}
function isSourceOfWater(v: string): v is SourceOfWater {
  return Object.values(SourceOfWater).includes(v as SourceOfWater)
}
function isSanitationType(v: string): v is SanitationType {
  return Object.values(SanitationType).includes(v as SanitationType)
}
function isSurveyStatus(v: string): v is SurveyStatus {
  return Object.values(SurveyStatus).includes(v as SurveyStatus)
}
function isQcStatus(v: string): v is QcStatus {
  return Object.values(QcStatus).includes(v as QcStatus)
}
function isFloorPosition(v: string): v is FloorPosition {
  return Object.values(FloorPosition).includes(v as FloorPosition)
}
function isUsageFactor(v: string): v is UsageFactor {
  return Object.values(UsageFactor).includes(v as UsageFactor)
}
function isUsageType(v: string): v is UsageType {
  return Object.values(UsageType).includes(v as UsageType)
}
function isConstructionType(v: string): v is ConstructionType {
  return Object.values(ConstructionType).includes(v as ConstructionType)
}
function isPhotoType(v: string): v is PhotoType {
  return Object.values(PhotoType).includes(v as PhotoType)
}
function isGpsSource(v: string): v is GpsSource {
  return Object.values(GpsSource).includes(v as GpsSource)
}
