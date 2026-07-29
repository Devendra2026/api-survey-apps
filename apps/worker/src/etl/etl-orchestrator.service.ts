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
  ConvexHttpExtractor,
  DEFAULT_ETL_BATCH_SIZE,
  DEFAULT_ETL_MAX_RETRIES,
  DEFAULT_MAX_IMAGE_BYTES,
  ETL_MIGRATABLE_STATUSES,
  extensionFromMime,
  isFinalAttempt,
  isPermanentFailure,
  rebuildPhotoKeysWithExtension,
  remediationFor,
  shouldSkipSurvey,
  transformSurveyBundle,
  validateImageBuffer,
  type AttemptBudget,
  type MappedSurvey,
  type MigrationStatus,
  type PhotoSlot,
  type TransformContext,
} from "@workspace/etl-core"
import type { EtlSurveyImportPayload } from "@workspace/jobs"
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

    try {
      const existing = await this.prisma.db.migrationState.findUnique({
        where: { legacySurveyId },
      })
      if (shouldSkipSurvey(existing?.status)) {
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
        existingStatus: existing?.status as MigrationStatus | null,
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
   */
  private async ensureGeoForBundle(bundle: {
    municipalityCode: string
    municipalityName?: string | null
    wardNo: string
    districtName?: string | null
  }): Promise<void> {
    const code = bundle.municipalityCode?.trim()
    const wardNo = bundle.wardNo?.trim()
    if (!code || !wardNo) return

    let ulb = await this.prisma.db.ulb.findFirst({
      where: { code },
      select: { id: true },
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
          select: { id: true },
        })
        this.logger.log(`Auto-created ULB ${code} (${name}) under district ${district.name}`)
      } catch (err) {
        // Race / unique name: re-read by code
        ulb = await this.prisma.db.ulb.findFirst({ where: { code }, select: { id: true } })
        if (!ulb) throw err
      }
    }

    const wards = await this.prisma.db.ward.findMany({
      where: { ulbId: ulb.id },
      select: { id: true, wardNumber: true },
    })
    const wantNum = Number.parseInt(wardNo, 10)
    const exists = wards.some((w) => {
      if (w.wardNumber.trim() === wardNo) return true
      const haveNum = Number.parseInt(w.wardNumber.trim(), 10)
      return Number.isFinite(wantNum) && Number.isFinite(haveNum) && wantNum === haveNum
    })
    if (exists) return

    const padded = Number.isFinite(wantNum) && wantNum >= 0 && wantNum < 100 ? String(wantNum).padStart(2, "0") : wardNo
    const variants = [...new Set([wardNo, padded, Number.isFinite(wantNum) ? String(wantNum) : wardNo])]

    for (const wardNumber of variants) {
      const already = await this.prisma.db.ward.findFirst({
        where: { ulbId: ulb.id, wardNumber },
        select: { id: true },
      })
      if (already) continue
      try {
        await this.prisma.db.ward.create({
          data: {
            ulbId: ulb.id,
            wardNumber,
            wardName: `Ward ${wardNumber}`,
          },
        })
        this.logger.log(`Auto-created ward ${wardNumber} for ULB ${code}`)
      } catch {
        // unique race — ignore
      }
    }
  }

  async listBatchIds(cursor: string | null, batchSize = DEFAULT_ETL_BATCH_SIZE) {
    const extractor = this.createExtractor()
    // Everything except drafts: drafts lack ward/assessment fields, while
    // approved and rejected surveys are finished records that must be imported.
    return extractor.listSurveyIds({
      cursor,
      numItems: batchSize,
      statuses: ETL_MIGRATABLE_STATUSES,
    })
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
        wards: { select: { id: true, wardNumber: true } },
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
        const want = wardNo.trim()
        const wantNum = Number.parseInt(want, 10)
        const ward = ulb.wards.find((w) => {
          const have = w.wardNumber.trim()
          if (have === want) return true
          const haveNum = Number.parseInt(have, 10)
          return Number.isFinite(wantNum) && Number.isFinite(haveNum) && wantNum === haveNum
        })
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
    }>
  ): Promise<{ surveyId: string }> {
    return this.prisma.db.$transaction(async (tx) => {
      const existing = await tx.survey.findFirst({
        where: { legacySurveyId: survey.legacySurveyId, deletedAt: null },
        select: { id: true },
      })
      if (existing) {
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
              usageFactor: asEnum(f.usageFactor, UsageFactor),
              usageType: asEnum(f.usageType, UsageType),
              constructionType: asEnum(f.constructionType, ConstructionType),
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
