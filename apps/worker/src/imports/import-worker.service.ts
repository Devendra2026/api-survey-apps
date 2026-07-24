import { Injectable, Logger } from "@nestjs/common"
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
import type { ImportJobPayload } from "@workspace/jobs"
import {
  checkPropertyIdGeoConsistency,
  collectWorkbookGeoPairs,
  emptyToUndefinedNormalized,
  formatDuplicateWorkbookError,
  formatGeoResolveError,
  formatMissingUlbMasterAbort,
  formatPropertyId,
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
  sqFtToSqMeter,
  type GeoResolved,
  type GeoResolveResult,
} from "@workspace/validation"
import { PrismaService } from "../database/prisma.service.js"
import { ObjectStorageService } from "../storage/object-storage.service.js"
import { canAccessTenant, resolveTenantScope } from "../tenant/tenant-scope.js"
import {
  findWorkbookDuplicates,
  groupRowsByPropertyId,
  parseConvexWorkbook,
  type WorkbookRow,
} from "./convex-workbook-parser.js"

const CHUNK_SIZE = 50

function toSurveyUpdateData(data: Prisma.SurveyUncheckedCreateInput): Prisma.SurveyUncheckedUpdateInput {
  const { createdById, assignedToId, assignedAt, ...updateFields } = data
  void createdById
  void assignedToId
  void assignedAt
  return updateFields
}

interface ImportRowError {
  row: number
  propertyId?: string
  localId?: string
  errors: string[]
}

interface ImportCheckpoint {
  processedRows: number
  lastPropertyId?: string
}

interface MappedSurvey {
  rowNumber: number
  propertyId: string
  localId?: string
  legacySurveyId?: string
  geo: GeoResolved
  data: Prisma.SurveyUncheckedCreateInput
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
      data: { status: JobStatus.PROCESSING, startedAt: new Date(), errorMessage: null, finishedAt: null },
    })
    await updateProgress(2)

    try {
      const source = await this.storageService.getObjectBuffer(payload.objectKey, payload.bucket)
      const workbook = await parseConvexWorkbook(source, payload.originalName)
      await updateProgress(8)

      const duplicates = findWorkbookDuplicates(workbook.surveys)
      const duplicatePropertyIds = new Set(
        duplicates.filter((item) => item.kind === "propertyId").map((item) => item.key)
      )
      const duplicateLocalIds = new Set(duplicates.filter((item) => item.kind === "localId").map((item) => item.key))

      const checkpoint = payload.resumeFromCheckpoint ? await this.readCheckpoint(payload.jobId) : { processedRows: 0 }

      const retryPropertyIds = new Set((payload.failedPropertyIds ?? []).map((id) => id.toUpperCase()))
      const retryLocalIds = new Set((payload.failedLocalIds ?? []).map((id) => id.toUpperCase()))
      const retryRows = new Set(payload.failedRows ?? [])
      const retryFailedOnly = Boolean(payload.retryFailedOnly)

      let surveys = workbook.surveys
      if (retryFailedOnly) {
        surveys = workbook.surveys.filter((row, index) => {
          const excelRow = index + 2
          const propertyId = String(row["Property ID"] ?? "")
            .trim()
            .toUpperCase()
          const localId = String(row["Local ID"] ?? "")
            .trim()
            .toUpperCase()
          return (
            retryRows.has(excelRow) ||
            (propertyId && retryPropertyIds.has(propertyId)) ||
            (localId && retryLocalIds.has(localId))
          )
        })
      }

      await this.prisma.db.importJob.update({
        where: { id: payload.jobId },
        data: { totalRows: surveys.length },
      })

      const coOwnersByPid = groupRowsByPropertyId(workbook.coOwners)
      const floorsByPid = groupRowsByPropertyId(workbook.floors)
      const photosByPid = groupRowsByPropertyId(workbook.photos)

      const errors: ImportRowError[] = duplicates.flatMap((issue) =>
        issue.rows.map((row) => ({
          row,
          propertyId: issue.kind === "propertyId" ? issue.key : undefined,
          localId: issue.kind === "localId" ? issue.key : undefined,
          errors: [formatDuplicateWorkbookError(issue.kind, issue.key, issue.rows)],
        }))
      )
      const createdSurveyIds: string[] = []
      const updatedSurveyIds: string[] = []
      let successCount = 0
      let failureCount = errors.length
      let photoSuccessCount = 0
      let photoFailureCount = 0
      let processedRows = retryFailedOnly ? 0 : checkpoint.processedRows

      const startIndex = retryFailedOnly ? 0 : Math.min(Math.max(checkpoint.processedRows, 0), surveys.length)
      const remaining = surveys.slice(startIndex)

      const geoCache = new Map<string, GeoResolveResult>()
      const scope = resolveTenantScope(payload.tenantRoles)

      const missingMasterPairs: Array<{
        ulbCode: string
        wardNumber: string
        reason: string
        sampleRows: number[]
      }> = []
      const geoPairs = collectWorkbookGeoPairs(surveys, {
        skipPropertyIds: duplicatePropertyIds,
        skipLocalIds: duplicateLocalIds,
      })
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

      // Fail closed: stop the job when ULB masters referenced by the workbook are absent.
      if (missingUlbCodes.length) {
        const abortMessage = formatMissingUlbMasterAbort(missingUlbCodes)
        const validationReport = {
          jobId: payload.jobId,
          aborted: true,
          reason: "ULB_MASTER_MISSING",
          message: abortMessage,
          missingUlbCodes: [...new Set(missingUlbCodes)],
          missingMasterPairs,
          duplicates,
          duplicatePropertyIdCount: duplicatePropertyIds.size,
          duplicateLocalIdCount: duplicateLocalIds.size,
          errors,
        }
        const errorReportKey = await this.writeValidationReport(payload, validationReport)
        await this.prisma.db.importJob.update({
          where: { id: payload.jobId },
          data: {
            status: JobStatus.FAILED,
            errorMessage: abortMessage,
            failureCount: errors.length,
            errorReportKey,
            resultSummary: validationReport as unknown as Prisma.InputJsonValue,
            finishedAt: new Date(),
          },
        })
        this.logger.warn(`Import job ${payload.jobId} aborted: ${abortMessage}`)
        await updateProgress(100)
        return
      }

      for (let offset = 0; offset < remaining.length; offset += CHUNK_SIZE) {
        const chunkRows = remaining.slice(offset, offset + CHUNK_SIZE)
        const mappedChunk: MappedSurvey[] = []

        for (const [i, row] of chunkRows.entries()) {
          const rowNumber = startIndex + offset + i + 2
          const propertyId = normalizeImportString(row["Property ID"]).toUpperCase()
          const localId = normalizeImportString(row["Local ID"]).toUpperCase()
          if ((propertyId && duplicatePropertyIds.has(propertyId)) || (localId && duplicateLocalIds.has(localId))) {
            // Already recorded in workbook duplicate validation report.
            continue
          }
          const mapped = await this.mapSurveyRow(row, rowNumber, payload, scope, geoCache, errors)
          if (mapped) mappedChunk.push(mapped)
          else failureCount += 1
        }

        const propertyIds = mappedChunk.map((item) => item.propertyId)
        const localIds = mappedChunk.map((item) => item.localId).filter((id): id is string => Boolean(id))

        const existingByProperty = propertyIds.length
          ? await this.prisma.db.survey.findMany({
              where: { deletedAt: null, propertyId: { in: propertyIds } },
              select: { id: true, propertyId: true, localId: true },
            })
          : []
        const byPropertyId = new Map(existingByProperty.map((s) => [s.propertyId.toUpperCase(), s]))

        const unmatchedLocalIds = localIds.filter((localId) => {
          return !existingByProperty.some((s) => s.localId?.toUpperCase() === localId.toUpperCase())
        })
        const existingByLocal =
          unmatchedLocalIds.length > 0
            ? await this.prisma.db.survey.findMany({
                where: {
                  deletedAt: null,
                  localId: { in: unmatchedLocalIds },
                  NOT: { propertyId: { in: propertyIds } },
                },
                select: { id: true, propertyId: true, localId: true },
              })
            : []
        const byLocalId = new Map(
          existingByLocal.filter((s) => s.localId).map((s) => [String(s.localId).toUpperCase(), s])
        )

        for (const item of mappedChunk) {
          try {
            const existing =
              byPropertyId.get(item.propertyId.toUpperCase()) ??
              (item.localId ? byLocalId.get(item.localId.toUpperCase()) : undefined)

            const result = await this.prisma.db.$transaction(async (tx) => {
              let surveyId: string
              let created = false

              if (existing) {
                await tx.survey.update({
                  where: { id: existing.id },
                  data: toSurveyUpdateData(item.data),
                })
                surveyId = existing.id
                await tx.surveyAudit.create({
                  data: {
                    surveyId,
                    action: "IMPORT_UPDATED",
                    newValue: { propertyId: item.propertyId, jobId: payload.jobId },
                    changedBy: payload.createdById,
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
                    newValue: { propertyId: item.propertyId, jobId: payload.jobId },
                    changedBy: payload.createdById,
                  },
                })
              }

              await tx.coOwner.deleteMany({ where: { surveyId } })
              const coOwnerRows = coOwnersByPid.get(item.propertyId.toUpperCase()) ?? []
              for (const [idx, ownerRow] of coOwnerRows.entries()) {
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
              const floorRows = floorsByPid.get(item.propertyId.toUpperCase()) ?? []
              const seenPositions = new Set<string>()
              for (const floorRow of floorRows) {
                const positionRaw = mapFloorPosition(floorRow.Floor)
                if (!positionRaw || !isFloorPosition(positionRaw)) continue
                if (seenPositions.has(positionRaw)) continue
                seenPositions.add(positionRaw)
                const areaSqFt = parseNumber(floorRow["Area (Sqft)"])
                await tx.floor.create({
                  data: {
                    surveyId,
                    clientFloorId: emptyToUndefined(floorRow["Client Floor ID"]),
                    floorPosition: positionRaw,
                    usageFactor: asEnum(mapUsageFactor(floorRow["Usage Factor"]), isUsageFactor),
                    usageType: asEnum(mapUsageType(floorRow["Usage Type"]), isUsageType),
                    constructionType: asEnum(mapConstructionType(floorRow["Construction Type"]), isConstructionType),
                    occupancy: emptyToUndefined(floorRow.Occupancy),
                    areaSqFt: areaSqFt ?? undefined,
                    position: parseNumber(floorRow.Position) ?? 0,
                  },
                })
              }

              const photoRows = photosByPid.get(item.propertyId.toUpperCase()) ?? []
              let photoOk = 0
              let photoFail = 0
              for (const photoRow of photoRows) {
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
                  const existingPhoto = await tx.photo.findFirst({
                    where: { surveyId, photoType: photoTypeRaw },
                  })
                  if (existingPhoto) {
                    await tx.photo.update({
                      where: { id: existingPhoto.id },
                      data: {
                        sourceUrl,
                        importStatus: "PENDING",
                        url: sourceUrl,
                        sizeKB: parseNumber(photoRow["Size (KB)"]),
                        width: parseNumber(photoRow.Width),
                        height: parseNumber(photoRow.Height),
                        capturedAt: parseDate(photoRow["Captured At"]),
                      },
                    })
                  } else {
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
                  }
                  photoOk += 1
                } catch {
                  photoFail += 1
                }
              }

              return { surveyId, created, photoOk, photoFail }
            })

            if (result.created) createdSurveyIds.push(result.surveyId)
            else updatedSurveyIds.push(result.surveyId)
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

        processedRows = startIndex + offset + chunkRows.length
        const checkpointData: ImportCheckpoint = {
          processedRows,
          lastPropertyId: mappedChunk.at(-1)?.propertyId ?? checkpoint.lastPropertyId,
        }
        await this.prisma.db.importJob.update({
          where: { id: payload.jobId },
          data: {
            processedRows,
            successCount,
            failureCount,
            photoSuccessCount,
            photoFailureCount,
            checkpoint: checkpointData as unknown as Prisma.InputJsonValue,
          },
        })

        const progress = 10 + Math.floor(((startIndex + offset + chunkRows.length) / Math.max(surveys.length, 1)) * 85)
        await updateProgress(Math.min(progress, 95))
      }

      const validationReport = {
        jobId: payload.jobId,
        totalRows: surveys.length,
        successCount,
        failureCount,
        photoSuccessCount,
        photoFailureCount,
        createdSurveyIds,
        updatedSurveyIds,
        duplicates,
        duplicatePropertyIdCount: duplicatePropertyIds.size,
        duplicateLocalIdCount: duplicateLocalIds.size,
        missingMasterPairs,
        errors,
        resumedFrom: checkpoint.processedRows,
        retryFailedOnly,
        usedInlineColumns: Boolean(workbook.usedInlineColumns),
        sheetPreferredWarning: Boolean(workbook.sheetPreferredWarning),
        expandedCoOwnerRows: workbook.coOwners.length,
        expandedFloorRows: workbook.floors.length,
        expandedPhotoRows: workbook.photos.length,
      }
      const errorReportKey = await this.writeValidationReport(payload, validationReport)

      await this.prisma.db.importJob.update({
        where: { id: payload.jobId },
        data: {
          status: JobStatus.SUCCEEDED,
          processedRows,
          successCount,
          failureCount,
          photoSuccessCount,
          photoFailureCount,
          errorReportKey,
          resultSummary: validationReport as unknown as Prisma.InputJsonValue,
          checkpoint: { processedRows },
          finishedAt: new Date(),
        },
      })
      await updateProgress(100)
      this.logger.log(
        `Import job ${payload.jobId} completed total=${surveys.length} ok=${successCount} fail=${failureCount}`
      )
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

  /** Survey IDs created/updated by a completed import (from resultSummary). */
  async getResultSurveyIds(jobId: string): Promise<string[]> {
    const job = await this.prisma.db.importJob.findUnique({
      where: { id: jobId },
      select: { resultSummary: true },
    })
    const summary = job?.resultSummary
    if (!summary || typeof summary !== "object" || Array.isArray(summary)) return []
    const obj = summary as Record<string, unknown>
    const created = Array.isArray(obj.createdSurveyIds)
      ? obj.createdSurveyIds.filter((id): id is string => typeof id === "string")
      : []
    const updated = Array.isArray(obj.updatedSurveyIds)
      ? obj.updatedSurveyIds.filter((id): id is string => typeof id === "string")
      : []
    return [...new Set([...created, ...updated])]
  }

  private async readCheckpoint(jobId: string): Promise<ImportCheckpoint> {
    const job = await this.prisma.db.importJob.findUnique({
      where: { id: jobId },
      select: { checkpoint: true, processedRows: true },
    })
    const raw = job?.checkpoint
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const obj = raw as Record<string, unknown>
      return {
        processedRows: typeof obj.processedRows === "number" ? obj.processedRows : (job?.processedRows ?? 0),
        lastPropertyId: typeof obj.lastPropertyId === "string" ? obj.lastPropertyId : undefined,
      }
    }
    return { processedRows: job?.processedRows ?? 0 }
  }

  private async mapSurveyRow(
    row: WorkbookRow,
    rowNumber: number,
    payload: ImportJobPayload,
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
    const excelUlbCode = firstRowValue(row, ["ULB Code", "Municipality Code", "municipalityCode", "ULB"])
    const excelWardNumber = firstRowValue(row, ["Ward Number", "Ward No", "Ward", "wardNo"])

    let ulbCodeRaw = excelUlbCode
    let wardNumberRaw = excelWardNumber

    if (!propertyId && ulbCodeRaw && wardNumberRaw && parcelNo && unitNo && propertyUseMapped) {
      propertyId = formatPropertyId({
        ulbCode: ulbCodeRaw,
        wardNo: wardNumberRaw,
        parcelNo,
        unitNo,
        propertyUse: propertyUseMapped,
      })
    }
    if (!propertyId) rowErrors.push("Missing Property ID (and could not derive from ULB/Ward/Parcel/Unit/Use)")

    const consistencyError = checkPropertyIdGeoConsistency({
      propertyId,
      excelUlbCode,
      excelWardNumber,
    })
    if (consistencyError) rowErrors.push(consistencyError)

    const parsedPropertyId = parsePropertyId(propertyId)
    if (!ulbCodeRaw && parsedPropertyId) ulbCodeRaw = parsedPropertyId.ulbCode
    if (!wardNumberRaw && parsedPropertyId) wardNumberRaw = parsedPropertyId.wardNo
    if (!parcelNo && parsedPropertyId) parcelNo = parsedPropertyId.parcelNo
    if (!unitNo && parsedPropertyId) unitNo = parsedPropertyId.unitNo

    const assessmentYear = mapAssessmentYear(row["Assessment Year"]) ?? AssessmentYear.AY_2025_2026
    if (!mapAssessmentYear(row["Assessment Year"]) && emptyToUndefined(row["Assessment Year"])) {
      rowErrors.push(`Invalid Assessment Year: ${row["Assessment Year"]}`)
    }

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
      propertyId: propertyId ?? null,
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
      rowErrors.push("Row is outside creator tenant scope")
    }

    if (rowErrors.length || !propertyId || !geo) {
      errors.push({
        row: rowNumber,
        propertyId: propertyId,
        localId,
        errors: rowErrors.length ? rowErrors : ["Invalid survey row"],
      })
      return null
    }

    const plotAreaSqFt = parseNumber(row["Plot Area SqFt"])
    const plinthAreaSqFt = parseNumber(row["Plinth Area SqFt"])
    const totalBuiltAreaSqFt = parseNumber(row["Total Built Up Area SqFt"])
    const plotAreaSqMeter = parseNumber(row["Plot Area SqMeter"]) ?? sqFtToSqMeter(plotAreaSqFt)
    const plinthAreaSqMeter = parseNumber(row["Plinth Area SqMeter"]) ?? sqFtToSqMeter(plinthAreaSqFt)
    const totalBuiltAreaSqMeter = parseNumber(row["Total Built Up Area SqMeter"]) ?? sqFtToSqMeter(totalBuiltAreaSqFt)

    const surveyStatus = asEnum(mapSurveyStatus(row["Survey Status"]), isSurveyStatus) ?? SurveyStatus.DRAFT
    const qcStatus = asEnum(mapQcStatus(row["QC Status"]), isQcStatus) ?? QcStatus.PENDING
    const waterConnection = mapWaterConnection(row["Water Connection?"])
      ? asEnum(mapWaterConnection(row["Water Connection?"]), isWaterConnection)
      : parseYn(row["Water Connection?"]) === true
        ? WaterConnection.YES
        : parseYn(row["Water Connection?"]) === false
          ? WaterConnection.NO
          : undefined

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
      assessmentYear: assessmentYear as AssessmentYear,
      ownershipType,
      propertyUse,
      propertyType,
      situation: asEnum(mapSituation(row.Situation), isSituation),
      roadType: asEnum(mapRoadType(row["Road Type"]), isRoadType),
      taxRateZone: asEnum(mapTaxRateZone(row["Tax Rate Zone"]), isTaxRateZone),
      plotAreaSqFt,
      plotAreaSqMeter,
      plinthAreaSqFt,
      plinthAreaSqMeter,
      totalBuiltAreaSqFt,
      totalBuiltAreaSqMeter,
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
      surveyStatus,
      qcStatus,
      serverVersion: parseNumber(row["Server Version"]) ?? 1,
      clientUpdatedAt: parseDate(row["Client Updated At"]),
      submittedAt: parseDate(row["Submitted At"]),
      createdById: payload.createdById,
      assignedToId: payload.createdById,
      assignedAt: new Date(),
    }

    return { rowNumber, propertyId, localId, legacySurveyId, geo, data }
  }

  private async writeValidationReport(payload: ImportJobPayload, report: Record<string, unknown>): Promise<string> {
    const key = ["imports", payload.createdById, payload.jobId, "validation-report.json"].join("/")
    await this.storageService.putObject({
      key,
      bucket: payload.bucket,
      body: Buffer.from(JSON.stringify(report, null, 2), "utf8"),
      mimeType: "application/json",
      metadata: { importJobId: payload.jobId },
    })
    return key
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
