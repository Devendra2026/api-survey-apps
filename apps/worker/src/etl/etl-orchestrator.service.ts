import { Injectable, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import {
  AssessmentYear,
  ConstructionType,
  FloorPosition,
  GpsSource,
  OwnershipType,
  PhotoType,
  Prisma,
  MigrationStatus as PrismaMigrationStatus,
  PropertyType,
  PropertyUse,
  QcStatus,
  RoadType,
  SanitationType,
  Situation,
  SourceOfWater,
  StorageProvider,
  SurveyStatus,
  TaxRateZone,
  UlbType,
  UsageFactor,
  UsageType,
  WaterConnection,
} from "@workspace/database"
import {
  assertDistrictId,
  ConvexHttpExtractor,
  DEFAULT_ETL_BATCH_SIZE,
  DEFAULT_ETL_MAX_RETRIES,
  DEFAULT_MAX_IMAGE_BYTES,
  ETL_DRAFT_PLACEHOLDER_WARD,
  ETL_MIGRATABLE_STATUSES,
  extensionFromMime,
  isFinalAttempt,
  isPermanentFailure,
  isSurveyInDistrictScope,
  rebuildPhotoKeysWithExtension,
  remediationFor,
  shouldSkipSurvey,
  shouldSkipSurveyForRefresh,
  transformSurveyBundle,
  validateImageBuffer,
  type AttemptBudget,
  type MappedSurvey,
  type PhotoSlot,
  type TransformContext,
} from "@workspace/etl-core"
import type { EtlSurveyImportPayload } from "@workspace/jobs"
import { normalizeWardNumber, wardNumbersMatch } from "@workspace/validation"
import { PrismaService } from "../database/prisma.service.js"
import { ObjectStorageService } from "../storage/object-storage.service.js"

@Injectable()
export class EtlOrchestratorService {
  private readonly logger = new Logger(EtlOrchestratorService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
    private readonly config: ConfigService
  ) {}

  createExtractor(): ConvexHttpExtractor {
    const siteUrl = this.config.get<string>("CONVEX_SITE_URL")?.trim()
    const etlSecret = this.config.get<string>("ETL_CONVEX_SECRET")?.trim()
    if (!siteUrl || !etlSecret) {
      throw new Error("CONVEX_SITE_URL and ETL_CONVEX_SECRET are required for ETL")
    }
    return new ConvexHttpExtractor({ siteUrl, etlSecret })
  }

  async processSurveyImport(payload: EtlSurveyImportPayload): Promise<{
    outcome: "imported" | "skipped" | "duplicate" | "failed"
    imagesUploaded: number
    imagesDownloaded: number
    missingImages: number
    error?: string
  }> {
    const { migrationJobId, correlationId, legacySurveyId } = payload
    const maxRetries = Number(this.config.get("ETL_MAX_RETRIES") ?? DEFAULT_ETL_MAX_RETRIES)

    const refreshPending = payload.refreshPending === true || payload.type === "REFRESH_PENDING"

    try {
      const existing = await this.prisma.db.migrationState.findUnique({
        where: { legacySurveyId },
      })
      const nestSurvey = await this.prisma.db.survey.findFirst({
        where: { legacySurveyId, deletedAt: null },
        select: { id: true, qcStatus: true, districtId: true },
      })

      if (nestSurvey && (nestSurvey.qcStatus === QcStatus.APPROVED || nestSurvey.qcStatus === QcStatus.REJECTED)) {
        await this.appendLog(migrationJobId, "info", "Skipped: Nest QC already terminal", legacySurveyId, correlationId)
        return { outcome: "skipped", imagesUploaded: 0, imagesDownloaded: 0, missingImages: 0 }
      }

      if (payload.districtId) {
        const scope = assertDistrictId(payload.districtId)
        if (nestSurvey && !isSurveyInDistrictScope(nestSurvey.districtId, scope)) {
          await this.appendLog(migrationJobId, "info", "Skipped: out of district scope", legacySurveyId, correlationId)
          return { outcome: "skipped", imagesUploaded: 0, imagesDownloaded: 0, missingImages: 0 }
        }
      }

      if (refreshPending) {
        if (
          shouldSkipSurveyForRefresh({
            migrationStatus: existing?.status,
            nestQcStatus: nestSurvey?.qcStatus,
          })
        ) {
          await this.appendLog(migrationJobId, "info", "Skipped refresh", legacySurveyId, correlationId)
          return { outcome: "duplicate", imagesUploaded: 0, imagesDownloaded: 0, missingImages: 0 }
        }
      } else if (shouldSkipSurvey(existing?.status)) {
        await this.appendLog(migrationJobId, "info", "Skipped existing survey", legacySurveyId, correlationId)
        return { outcome: "duplicate", imagesUploaded: 0, imagesDownloaded: 0, missingImages: 0 }
      }

      await this.prisma.db.migrationState.upsert({
        where: { legacySurveyId },
        create: {
          legacySurveyId,
          status: PrismaMigrationStatus.IN_PROGRESS,
          correlationId,
        },
        update: {
          status: PrismaMigrationStatus.IN_PROGRESS,
          correlationId,
          lastError: null,
        },
      })

      const extractor = this.createExtractor()
      const bundles = await extractor.getSurveyBundles([legacySurveyId])
      const bundle = bundles[0]
      if (!bundle) {
        // Non-survey IDs or deleted docs — skip so migration finishes with zero FAILED
        await this.prisma.db.migrationState.update({
          where: { legacySurveyId },
          data: {
            status: PrismaMigrationStatus.SKIPPED,
            lastSyncedAt: new Date(),
            correlationId,
            lastError: "Skipped: not found as a Convex survey document",
          },
        })
        await this.markFailedImportResolved(migrationJobId, legacySurveyId)
        return { outcome: "skipped", imagesUploaded: 0, imagesDownloaded: 0, missingImages: 0 }
      }

      await this.ensureGeoForBundle(bundle)

      const transformCtx = await this.buildTransformContext()
      const transformed = transformSurveyBundle(bundle, transformCtx, {
        existingStatus: refreshPending ? null : (existing?.status ?? null),
      })

      if (transformed.ok && "skip" in transformed && transformed.skip) {
        await this.prisma.db.migrationState.update({
          where: { legacySurveyId },
          data: {
            status: PrismaMigrationStatus.SKIPPED,
            lastSyncedAt: new Date(),
            correlationId,
            lastError: transformed.reason.slice(0, 2000),
          },
        })
        await this.markFailedImportResolved(migrationJobId, legacySurveyId)
        return {
          outcome: transformed.reason === "duplicate" ? "duplicate" : "skipped",
          imagesUploaded: 0,
          imagesDownloaded: 0,
          missingImages: 0,
        }
      }

      if (!transformed.ok) {
        throw new Error(transformed.error)
      }

      const survey = transformed.survey

      // Refresh path for existing PENDING Nest rows: update fields only, no image re-download.
      if (refreshPending && nestSurvey) {
        const { surveyId } = await this.loadSurveyTransaction(survey, [], { statusOnlyRefresh: true })
        await this.prisma.db.migrationState.upsert({
          where: { legacySurveyId },
          create: {
            legacySurveyId,
            status: PrismaMigrationStatus.COMPLETED,
            surveyId,
            lastSyncedAt: new Date(),
            correlationId,
          },
          update: {
            status: PrismaMigrationStatus.COMPLETED,
            surveyId,
            lastSyncedAt: new Date(),
            lastError: null,
            correlationId,
          },
        })
        await this.markFailedImportResolved(migrationJobId, legacySurveyId)
        await this.appendLog(migrationJobId, "info", "Refreshed pending survey status", legacySurveyId, correlationId)
        return { outcome: "imported", imagesUploaded: 0, imagesDownloaded: 0, missingImages: 0 }
      }

      const uploadedKeys: string[] = []
      let imagesDownloaded = 0
      let imagesUploaded = 0
      const missingImages = Math.max(0, (bundle.photos?.length ?? 0) - survey.photos.length)

      try {
        const extensionBySlot: Partial<Record<PhotoSlot, string>> = {}
        const photoMeta: Array<{
          slot: string
          photoType: string
          objectKey: string
          sourceUrl: string
          bucket: string
          provider: "S3" | "MINIO"
          mimeType: string
          sizeBytes: number
          checksum: string
          width?: number
          height?: number
          capturedAt?: Date
        }> = []

        const maxBytes = Number(this.config.get("ETL_MAX_IMAGE_BYTES") ?? DEFAULT_MAX_IMAGE_BYTES)

        for (const photo of survey.photos) {
          const buffer = await this.downloadImage(photo.sourceUrl)
          imagesDownloaded += 1
          const validated = validateImageBuffer(buffer, null, maxBytes)
          if (!validated.ok || !validated.mimeType) {
            throw new Error(validated.error ?? "Image validation failed")
          }
          const ext = extensionFromMime(validated.mimeType)
          extensionBySlot[photo.slot] = ext
        }

        const withKeys = rebuildPhotoKeysWithExtension(survey, survey.districtCode, extensionBySlot)

        for (const photo of withKeys.photos) {
          const buffer = await this.downloadImage(photo.sourceUrl)
          const validated = validateImageBuffer(buffer, null, maxBytes)
          if (!validated.ok || !validated.mimeType || validated.sizeBytes == null) {
            throw new Error(validated.error ?? "Image validation failed")
          }

          const uploaded = await this.storage.putObject({
            key: photo.objectKey,
            body: buffer,
            mimeType: validated.mimeType,
            metadata: {
              legacySurveyId,
              slot: photo.slot,
              correlationId,
              migrationJobId,
            },
          })
          uploadedKeys.push(uploaded.key)
          imagesUploaded += 1

          this.logger.log(
            JSON.stringify({
              msg: "etl_image_uploaded",
              correlationId,
              legacySurveyId,
              objectKey: uploaded.key,
              sizeBytes: uploaded.sizeBytes,
              checksum: uploaded.checksum,
            })
          )

          photoMeta.push({
            slot: photo.slot,
            photoType: photo.photoType,
            objectKey: uploaded.key,
            sourceUrl: photo.sourceUrl,
            bucket: uploaded.bucket,
            provider: uploaded.provider === StorageProvider.MINIO ? "MINIO" : "S3",
            mimeType: uploaded.mimeType,
            sizeBytes: uploaded.sizeBytes,
            checksum: uploaded.checksum,
            width: photo.width,
            height: photo.height,
            capturedAt: photo.capturedAt ? new Date(photo.capturedAt) : undefined,
          })
        }

        const { surveyId } = await this.loadSurveyTransaction(withKeys, photoMeta)

        await this.prisma.db.migrationState.update({
          where: { legacySurveyId },
          data: {
            status: PrismaMigrationStatus.COMPLETED,
            surveyId,
            imagesImported: imagesUploaded,
            imagesExpected: withKeys.imagesExpected,
            checksum: withKeys.checksum,
            lastSyncedAt: new Date(),
            lastError: null,
            correlationId,
          },
        })

        await this.markFailedImportResolved(migrationJobId, legacySurveyId)

        await this.appendLog(
          migrationJobId,
          "info",
          `Imported survey ${legacySurveyId}`,
          legacySurveyId,
          correlationId,
          { surveyId, imagesUploaded }
        )

        return { outcome: "imported", imagesUploaded, imagesDownloaded, missingImages }
      } catch (inner) {
        await this.compensateUploads(uploadedKeys)
        throw inner
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const stack = err instanceof Error ? err.stack : undefined
      this.logger.error(`ETL survey failed ${legacySurveyId}: ${message}`, stack)

      const state = await this.prisma.db.migrationState.findUnique({ where: { legacySurveyId } })
      const retryCount = (state?.retryCount ?? 0) + 1
      await this.prisma.db.migrationState.upsert({
        where: { legacySurveyId },
        create: {
          legacySurveyId,
          status: PrismaMigrationStatus.FAILED,
          retryCount,
          lastError: message.slice(0, 2000),
          correlationId,
        },
        update: {
          status: PrismaMigrationStatus.FAILED,
          retryCount,
          lastError: message.slice(0, 2000),
          correlationId,
        },
      })

      await this.prisma.db.failedImport.upsert({
        where: {
          jobId_legacySurveyId_stage: {
            jobId: migrationJobId,
            legacySurveyId,
            stage: "LOAD",
          },
        },
        create: {
          jobId: migrationJobId,
          legacySurveyId,
          stage: "LOAD",
          errorMessage: message.slice(0, 2000),
          stackTrace: stack?.slice(0, 8000),
          retryCount,
        },
        update: {
          errorMessage: message.slice(0, 2000),
          stackTrace: stack?.slice(0, 8000),
          retryCount,
          resolvedAt: null,
        },
      })

      await this.appendLog(migrationJobId, "error", message, legacySurveyId, correlationId)

      if (retryCount <= maxRetries) {
        throw err
      }

      return {
        outcome: "failed",
        imagesUploaded: 0,
        imagesDownloaded: 0,
        missingImages: 0,
        error: message,
      }
    }
  }

  private async markFailedImportResolved(jobId: string, legacySurveyId: string): Promise<void> {
    await this.prisma.db.failedImport.updateMany({
      where: { legacySurveyId, resolvedAt: null },
      data: { resolvedAt: new Date() },
    })
  }

  /**
   * Auto-provision missing ULB/ward rows so production Convex codes always resolve locally.
   * Creates at most one canonical ward per normalized ward number (never 1 + 01 variants).
   */
  private async ensureGeoForBundle(bundle: {
    municipalityCode: string
    municipalityName?: string | null
    wardNo: string
    districtName?: string | null
    status?: string
  }): Promise<void> {
    const code = bundle.municipalityCode?.trim()
    const rawWardNo = bundle.wardNo?.trim() || (bundle.status === "draft" ? ETL_DRAFT_PLACEHOLDER_WARD : "")
    if (!code || !rawWardNo) return

    const wardNo = normalizeWardNumber(rawWardNo)

    let ulb = await this.prisma.db.ulb.findFirst({
      where: { code },
      select: { id: true, code: true },
    })

    if (!ulb) {
      const district =
        (bundle.districtName
          ? await this.prisma.db.district.findFirst({ where: { name: bundle.districtName } })
          : null) ?? (await this.prisma.db.district.findFirst({ orderBy: { createdAt: "asc" } }))
      if (!district) {
        this.logger.warn(`Cannot auto-create ULB ${code}: no district in local catalog`)
        return
      }
      const name = (bundle.municipalityName?.trim() || `ULB ${code}`).slice(0, 120)
      try {
        ulb = await this.prisma.db.ulb.create({
          data: {
            districtId: district.id,
            name,
            code,
            type: UlbType.MUNICIPAL_COUNCIL,
          },
          select: { id: true, code: true },
        })
        this.logger.log(`Auto-created ULB ${code} (${name}) under district ${district.name}`)
      } catch (err) {
        ulb = await this.prisma.db.ulb.findFirst({ where: { code }, select: { id: true, code: true } })
        if (!ulb) throw err
      }
    }

    const wards = await this.prisma.db.ward.findMany({
      where: { ulbId: ulb.id, deletedAt: null },
      select: { id: true, wardNumber: true },
    })
    const exists = wards.some((w) => wardNumbersMatch(w.wardNumber, wardNo))
    if (exists) {
      return
    }

    const wardCode = `${ulb.code}-W${wardNo}`.toUpperCase()
    try {
      await this.prisma.db.ward.create({
        data: {
          ulbId: ulb.id,
          wardNumber: wardNo,
          wardCode,
          wardName: `Ward ${wardNo}`,
        },
      })
      this.logger.log(`Auto-created ward ${wardNo} (${wardCode}) for ULB ${code}`)
    } catch {
      // unique race — ignore
    }
  }

  async listBatchIds(cursor: string | null, batchSize = DEFAULT_ETL_BATCH_SIZE) {
    const extractor = this.createExtractor()
    // All Convex statuses, including drafts (placeholders fill missing ward/AY).
    return extractor.listSurveyIds({
      cursor,
      numItems: batchSize,
      statuses: ETL_MIGRATABLE_STATUSES,
    })
  }

  /**
   * Cursor is an opaque Nest survey id offset for refresh-pending batches.
   * Returns legacySurveyIds for Nest rows still PENDING QC within the given district scope.
   */
  async listPendingRefreshIds(cursor: string | null, batchSize = DEFAULT_ETL_BATCH_SIZE, districtId?: string) {
    const scope = assertDistrictId(districtId)
    const take = Math.max(1, Math.min(batchSize, 500))
    const rows = await this.prisma.db.survey.findMany({
      where: {
        deletedAt: null,
        qcStatus: QcStatus.PENDING,
        legacySurveyId: { not: null },
        districtId: scope,
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: { id: "asc" },
      take,
      select: { id: true, legacySurveyId: true },
    })
    const ids = rows.map((r) => r.legacySurveyId!).filter(Boolean)
    const last = rows[rows.length - 1]
    return {
      ids,
      continueCursor: last?.id ?? cursor ?? "",
      isDone: rows.length < take,
    }
  }

  async countConvexSurveys() {
    return this.createExtractor().countSurveys(ETL_MIGRATABLE_STATUSES)
  }

  async buildTransformContext(): Promise<TransformContext> {
    const systemUserId = await this.resolveSystemUserId()
    const ulbs = await this.prisma.db.ulb.findMany({
      select: {
        id: true,
        code: true,
        districtId: true,
        district: { select: { id: true, stateId: true, name: true } },
        wards: {
          where: { deletedAt: null },
          select: { id: true, wardNumber: true },
        },
      },
    })

    const byCode = new Map(ulbs.map((u) => [u.code.toUpperCase(), u]))

    const users = await this.prisma.db.user.findMany({
      select: { id: true, clerkUserId: true, email: true },
    })
    const byClerk = new Map(users.filter((u) => u.clerkUserId).map((u) => [u.clerkUserId, u.id]))
    const byEmail = new Map(users.filter((u) => u.email).map((u) => [u.email.toLowerCase(), u.id]))

    return {
      systemUserId,
      resolveGeo: ({ municipalityCode, wardNo, districtCode }) => {
        const ulb = byCode.get(municipalityCode.trim().toUpperCase())
        if (!ulb) return null
        const want = normalizeWardNumber(wardNo)
        const ward = ulb.wards.find((w) => wardNumbersMatch(w.wardNumber, want))
        if (!ward) return null
        return {
          stateId: ulb.district.stateId,
          districtId: ulb.districtId,
          ulbId: ulb.id,
          wardId: ward.id,
          districtCode: districtCode || ulb.district.name,
          wardNo: ward.wardNumber,
        }
      },
      resolveUserId: ({ clerkId, email }) => {
        if (clerkId && byClerk.has(clerkId)) return byClerk.get(clerkId)!
        if (email && byEmail.has(email.toLowerCase())) return byEmail.get(email.toLowerCase())!
        return null
      },
    }
  }

  private async resolveSystemUserId(): Promise<string> {
    const configured = this.config.get<string>("ETL_SYSTEM_USER_ID")?.trim()
    if (configured) return configured
    const admin = await this.prisma.db.user.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    })
    if (!admin) throw new Error("No Nest user found for ETL systemUserId — set ETL_SYSTEM_USER_ID")
    return admin.id
  }

  private async downloadImage(url: string): Promise<Buffer> {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Image download failed (${response.status}) for ${url.slice(0, 120)}`)
    }
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  private async compensateUploads(keys: string[]): Promise<void> {
    for (const key of keys) {
      try {
        await this.storage.deleteObject(key)
      } catch (err) {
        this.logger.warn(`Compensate delete failed for ${key}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  private async loadSurveyTransaction(
    survey: MappedSurvey,
    photoMeta: Array<{
      slot: string
      photoType: string
      objectKey: string
      sourceUrl: string
      bucket: string
      provider: "S3" | "MINIO"
      mimeType: string
      sizeBytes: number
      checksum: string
      width?: number
      height?: number
      capturedAt?: Date
    }>,
    options?: { statusOnlyRefresh?: boolean }
  ): Promise<{ surveyId: string }> {
    return this.prisma.db.$transaction(async (tx) => {
      const existing = await tx.survey.findFirst({
        where: { legacySurveyId: survey.legacySurveyId, deletedAt: null },
        select: { id: true, qcStatus: true },
      })

      if (existing) {
        // Never overwrite Admin QC decisions.
        if (existing.qcStatus === QcStatus.APPROVED || existing.qcStatus === QcStatus.REJECTED) {
          return { surveyId: existing.id }
        }

        const surveyStatus = (asEnum(survey.surveyStatus, SurveyStatus) as SurveyStatus) ?? SurveyStatus.SUBMITTED

        await tx.survey.update({
          where: { id: existing.id },
          data: {
            localId: survey.localId,
            parcelNumber: survey.parcelNumber,
            unitSubNo: survey.unitSubNo,
            sectorNo: survey.sectorNo,
            constructedYear: survey.constructedYear,
            isSlum: survey.isSlum,
            wardNumber: survey.wardNumber,
            ulbCode: survey.ulbCode,
            districtName: survey.districtName,
            stateId: survey.stateId,
            districtId: survey.districtId,
            ulbId: survey.ulbId,
            wardId: survey.wardId,
            respondentName: survey.respondentName,
            relationshipWithOwner: survey.relationshipWithOwner,
            mobileNumber: survey.mobileNumber,
            alternateMobile: survey.alternateMobile,
            familySize: survey.familySize,
            houseDoorNo: survey.houseDoorNo,
            locality: survey.locality,
            colony: survey.colony,
            city: survey.city,
            pinCode: survey.pinCode,
            assessmentYear: survey.assessmentYear as AssessmentYear,
            ownershipType: asEnum(survey.ownershipType, OwnershipType),
            propertyUse: asEnum(survey.propertyUse, PropertyUse),
            propertyType: asEnum(survey.propertyType, PropertyType),
            situation: asEnum(survey.situation, Situation),
            roadType: asEnum(survey.roadType, RoadType),
            taxRateZone: asEnum(survey.taxRateZone, TaxRateZone),
            plotAreaSqFt: survey.plotAreaSqFt,
            plotAreaSqMeter: survey.plotAreaSqMeter,
            plinthAreaSqFt: survey.plinthAreaSqFt,
            plinthAreaSqMeter: survey.plinthAreaSqMeter,
            waterConnection: asEnum(survey.waterConnection, WaterConnection),
            sourceOfWater: asEnum(survey.sourceOfWater, SourceOfWater),
            sanitationType: asEnum(survey.sanitationType, SanitationType),
            solidWasteCollection: survey.solidWasteCollection,
            electricityConsumerNo: survey.electricityConsumerNo,
            latitude: survey.latitude,
            longitude: survey.longitude,
            gpsAccuracyMeters: survey.gpsAccuracyMeters,
            gpsProvider: survey.gpsProvider,
            gpsMockLocation: survey.gpsMockLocation,
            gpsSource: asEnum(survey.gpsSource, GpsSource),
            capturedAt: survey.capturedAt,
            surveyStatus,
            // Keep Nest qcStatus PENDING while refreshing from Convex field data.
            qcStatus: QcStatus.PENDING,
            serverVersion: survey.serverVersion,
            completionPct: survey.completionPct,
            clientUpdatedAt: survey.clientUpdatedAt,
            submittedAt: survey.submittedAt,
          },
        })

        if (!options?.statusOnlyRefresh && photoMeta.length > 0) {
          // Insert-only photos that are missing; do not wipe existing on refresh.
          for (const p of photoMeta) {
            const already = await tx.photo.findFirst({
              where: { surveyId: existing.id, photoType: p.photoType as PhotoType },
              select: { id: true },
            })
            if (already) continue
            await tx.photo.create({
              data: {
                surveyId: existing.id,
                photoType: p.photoType as PhotoType,
                url: p.objectKey,
                sourceUrl: p.sourceUrl,
                objectKey: p.objectKey,
                bucket: p.bucket,
                storageProvider: p.provider === "MINIO" ? StorageProvider.MINIO : StorageProvider.S3,
                mimeType: p.mimeType,
                sizeBytes: p.sizeBytes,
                sizeKB: Math.ceil(p.sizeBytes / 1024),
                checksum: p.checksum,
                width: p.width,
                height: p.height,
                capturedAt: p.capturedAt,
                importStatus: "SUCCEEDED",
              },
            })
          }
        }

        return { surveyId: existing.id }
      }

      // Avoid unique collision on (ulbId, propertyId, assessmentYear)
      const propertyId = await this.ensureUniquePropertyId(tx, survey)

      const created = await tx.survey.create({
        data: {
          legacySurveyId: survey.legacySurveyId,
          localId: survey.localId,
          propertyId,
          propertyIdOld: survey.propertyIdOld,
          parcelNumber: survey.parcelNumber,
          unitSubNo: survey.unitSubNo,
          sectorNo: survey.sectorNo,
          constructedYear: survey.constructedYear,
          isSlum: survey.isSlum,
          wardNumber: survey.wardNumber,
          ulbCode: survey.ulbCode,
          districtName: survey.districtName,
          stateId: survey.stateId,
          districtId: survey.districtId,
          ulbId: survey.ulbId,
          wardId: survey.wardId,
          createdById: survey.createdById,
          respondentName: survey.respondentName,
          relationshipWithOwner: survey.relationshipWithOwner,
          mobileNumber: survey.mobileNumber,
          alternateMobile: survey.alternateMobile,
          familySize: survey.familySize,
          houseDoorNo: survey.houseDoorNo,
          locality: survey.locality,
          colony: survey.colony,
          city: survey.city,
          pinCode: survey.pinCode,
          assessmentYear: survey.assessmentYear as AssessmentYear,
          ownershipType: asEnum(survey.ownershipType, OwnershipType),
          propertyUse: asEnum(survey.propertyUse, PropertyUse),
          propertyType: asEnum(survey.propertyType, PropertyType),
          situation: asEnum(survey.situation, Situation),
          roadType: asEnum(survey.roadType, RoadType),
          taxRateZone: asEnum(survey.taxRateZone, TaxRateZone),
          plotAreaSqFt: survey.plotAreaSqFt,
          plotAreaSqMeter: survey.plotAreaSqMeter,
          plinthAreaSqFt: survey.plinthAreaSqFt,
          plinthAreaSqMeter: survey.plinthAreaSqMeter,
          waterConnection: asEnum(survey.waterConnection, WaterConnection),
          sourceOfWater: asEnum(survey.sourceOfWater, SourceOfWater),
          sanitationType: asEnum(survey.sanitationType, SanitationType),
          solidWasteCollection: survey.solidWasteCollection,
          electricityConsumerNo: survey.electricityConsumerNo,
          latitude: survey.latitude,
          longitude: survey.longitude,
          gpsAccuracyMeters: survey.gpsAccuracyMeters,
          gpsProvider: survey.gpsProvider,
          gpsMockLocation: survey.gpsMockLocation,
          gpsSource: asEnum(survey.gpsSource, GpsSource),
          capturedAt: survey.capturedAt,
          surveyStatus: (asEnum(survey.surveyStatus, SurveyStatus) as SurveyStatus) ?? SurveyStatus.SUBMITTED,
          qcStatus: (asEnum(survey.qcStatus, QcStatus) as QcStatus) ?? QcStatus.PENDING,
          serverVersion: survey.serverVersion,
          completionPct: survey.completionPct,
          clientUpdatedAt: survey.clientUpdatedAt,
          submittedAt: survey.submittedAt,
          coOwners: {
            create: survey.coOwners.map((o) => ({
              ownerIndex: o.ownerIndex,
              name: o.name,
              fatherOrHusbandName: o.fatherOrHusbandName,
              mobile: o.mobile,
              alternateMobile: o.alternateMobile,
            })),
          },
          floors: {
            create: survey.floors.map((f) => ({
              clientFloorId: f.clientFloorId,
              floorPosition: (asEnum(f.floorPosition, FloorPosition) as FloorPosition) ?? FloorPosition.GROUND_FLOOR,
              usageFactor: (asEnum(f.usageFactor, UsageFactor) as UsageFactor) ?? UsageFactor.RESIDENTIAL,
              usageType: asEnum(f.usageType, UsageType),
              constructionType:
                (asEnum(f.constructionType, ConstructionType) as ConstructionType) ??
                ConstructionType.PAKKA_BUILDING_WITH_RCC_ROOF,
              occupancy: f.occupancy,
              areaSqFt: f.areaSqFt,
              position: f.position,
            })),
          },
          photos: {
            create: photoMeta.map((p) => ({
              photoType: p.photoType as PhotoType,
              url: p.objectKey,
              sourceUrl: p.sourceUrl,
              objectKey: p.objectKey,
              bucket: p.bucket,
              storageProvider: p.provider === "MINIO" ? StorageProvider.MINIO : StorageProvider.S3,
              mimeType: p.mimeType,
              sizeBytes: p.sizeBytes,
              sizeKB: Math.ceil(p.sizeBytes / 1024),
              checksum: p.checksum,
              width: p.width,
              height: p.height,
              capturedAt: p.capturedAt,
              importStatus: "SUCCEEDED",
            })),
          },
        },
      })

      // Seed survey_audits so QC Review Audit History is not empty for Convex→Nest imports.
      const createdAt = survey.capturedAt ?? survey.clientUpdatedAt ?? new Date()
      await tx.surveyAudit.create({
        data: {
          surveyId: created.id,
          action: "CREATED",
          newValue: {
            source: "convex_etl",
            surveyStatus: created.surveyStatus,
            propertyId: created.propertyId,
          },
          changedBy: survey.createdById,
          changedAt: createdAt,
        },
      })
      if (survey.submittedAt) {
        await tx.surveyAudit.create({
          data: {
            surveyId: created.id,
            action: "SUBMITTED",
            oldValue: { surveyStatus: "DRAFT" },
            newValue: {
              source: "convex_etl",
              surveyStatus: created.surveyStatus,
              qcStatus: created.qcStatus,
            },
            changedBy: survey.createdById,
            changedAt: survey.submittedAt,
          },
        })
      }

      return { surveyId: created.id }
    })
  }

  private async ensureUniquePropertyId(tx: Prisma.TransactionClient, survey: MappedSurvey): Promise<string> {
    const base = survey.propertyId
    const clash = await tx.survey.findFirst({
      where: {
        ulbId: survey.ulbId,
        propertyId: base,
        assessmentYear: survey.assessmentYear as AssessmentYear,
        deletedAt: null,
      },
      select: { id: true, legacySurveyId: true },
    })
    if (!clash) return base
    if (clash.legacySurveyId === survey.legacySurveyId) return base
    return `${base}__${survey.legacySurveyId.slice(-8)}`.toUpperCase()
  }

  async appendLog(
    jobId: string,
    level: string,
    message: string,
    legacySurveyId?: string,
    correlationId?: string,
    metaJson?: Prisma.InputJsonValue
  ) {
    await this.prisma.db.migrationLog.create({
      data: {
        jobId,
        level,
        message: message.slice(0, 4000),
        legacySurveyId,
        correlationId,
        metaJson,
      },
    })
  }

  /**
   * Close out a MigrationJob whose queue job threw. Without this the row stays
   * RUNNING forever, hides the error, and blocks the next full migration.
   */
  async failJob(input: {
    migrationJobId: string
    correlationId?: string
    error: unknown
    attempt: AttemptBudget
  }): Promise<void> {
    const { migrationJobId, correlationId, error, attempt } = input
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 2000)

    try {
      const job = await this.prisma.db.migrationJob.findUnique({ where: { id: migrationJobId } })
      if (!job) return

      const permanent = isPermanentFailure(error)
      const remediation = remediationFor(error)
      await this.appendLog(
        migrationJobId,
        "error",
        remediation ? `${message} — ${remediation}` : message,
        undefined,
        correlationId
      )
      // Permanent failures skip the retry budget entirely, so waiting for the
      // final attempt would leave this row RUNNING forever.
      if (!permanent && !isFinalAttempt(attempt)) return

      const stats: Record<string, string | number> = {}
      for (const [key, value] of Object.entries((job.statsJson as Record<string, unknown> | null) ?? {})) {
        if (typeof value === "number" || typeof value === "string") stats[key] = value
      }
      stats.error = message
      if (remediation) stats.remediation = remediation

      await this.prisma.db.migrationJob.update({
        where: { id: migrationJobId },
        data: { status: "FAILED", finishedAt: new Date(), statsJson: stats },
      })
      this.logger.error(`ETL job ${migrationJobId} marked FAILED: ${message}`)
    } catch (err) {
      this.logger.warn(
        `Could not record ETL failure for job ${migrationJobId}: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  async bumpJobStats(
    jobId: string,
    delta: Partial<{
      imported: number
      skipped: number
      duplicates: number
      failed: number
      imagesDownloaded: number
      imagesUploaded: number
      missingImages: number
    }>
  ) {
    const job = await this.prisma.db.migrationJob.findUnique({ where: { id: jobId } })
    if (!job) return
    const current = (job.statsJson as Record<string, number> | null) ?? {}
    const next = { ...current }
    for (const [key, value] of Object.entries(delta)) {
      next[key] = (Number(current[key] ?? 0) || 0) + (value ?? 0)
    }
    await this.prisma.db.migrationJob.update({
      where: { id: jobId },
      data: { statsJson: next },
    })
  }
}

function asEnum<T extends Record<string, string>>(
  value: string | undefined | null,
  enumObj: T
): T[keyof T] | undefined {
  if (!value) return undefined
  const values = Object.values(enumObj)
  return values.includes(value) ? (value as T[keyof T]) : undefined
}
