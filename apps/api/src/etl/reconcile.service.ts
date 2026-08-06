import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { assertDistrictId, ConvexHttpExtractor, DEFAULT_ETL_BATCH_SIZE } from "@workspace/etl-core"
import { mapSurveyStatus, normalizeWardNumber } from "@workspace/validation"
import { PrismaService } from "../prisma/prisma.service.js"

export type ReconcileResult = {
  districtId: string
  districtName: string
  totals: {
    nestSurveys: number
    withLegacyId: number
    ok: number
    statusMismatch: number
    wardMismatch: number
    onlyNest: number
    onlyConvexSampled: number
  }
  byUlb: Array<{
    ulbCode: string
    ulbName: string
    ok: number
    statusMismatch: number
    wardMismatch: number
    onlyNest: number
  }>
  samples: {
    statusMismatch: Array<{ legacySurveyId: string; nestStatus: string; convexStatus: string; wardNo: string }>
    wardMismatch: Array<{ legacySurveyId: string; nestWard: string; convexWard: string }>
    onlyNest: Array<{ surveyId: string; legacySurveyId: string | null }>
    onlyConvex: Array<{ legacySurveyId: string; municipalityCode: string; wardNo: string; status: string }>
  }
}

type NestSurveyRow = {
  id: string
  legacySurveyId: string | null
  surveyStatus: string
  wardNumber: string | null
  ulbId: string
  qcStatus: string
}

@Injectable()
export class ReconcileService {
  private readonly logger = new Logger(ReconcileService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async reconcileWithConvex(districtId: string): Promise<ReconcileResult> {
    const scope = assertDistrictId(districtId)

    const district = await this.prisma.db.district.findUnique({
      where: { id: scope },
      select: { id: true, name: true },
    })
    if (!district) {
      throw new BadRequestException(`Unknown districtId: ${scope}`)
    }

    const ulbs = await this.prisma.db.ulb.findMany({
      where: { districtId: scope },
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    })
    const ulbCodeSet = new Set(ulbs.map((u) => u.code))

    const nestSurveys = await this.prisma.db.survey.findMany({
      where: { districtId: scope, deletedAt: null },
      select: {
        id: true,
        legacySurveyId: true,
        surveyStatus: true,
        wardNumber: true,
        ulbId: true,
        qcStatus: true,
      },
    })

    const nestByLegacyId = new Map<string, NestSurveyRow>()
    const nestIdsWithLegacy = new Set<string>()
    for (const s of nestSurveys) {
      if (s.legacySurveyId) {
        nestByLegacyId.set(s.legacySurveyId, s)
        nestIdsWithLegacy.add(s.legacySurveyId)
      }
    }

    const totals = {
      nestSurveys: nestSurveys.length,
      withLegacyId: nestIdsWithLegacy.size,
      ok: 0,
      statusMismatch: 0,
      wardMismatch: 0,
      onlyNest: 0,
      onlyConvexSampled: 0,
    }

    const byUlbMap = new Map<
      string,
      { ulbCode: string; ulbName: string; ok: number; statusMismatch: number; wardMismatch: number; onlyNest: number }
    >()
    for (const u of ulbs) {
      byUlbMap.set(u.id, { ulbCode: u.code, ulbName: u.name, ok: 0, statusMismatch: 0, wardMismatch: 0, onlyNest: 0 })
    }

    const samples: ReconcileResult["samples"] = {
      statusMismatch: [],
      wardMismatch: [],
      onlyNest: [],
      onlyConvex: [],
    }

    const batchSize = 50
    const legacyIds = [...nestIdsWithLegacy]
    for (let i = 0; i < legacyIds.length; i += batchSize) {
      const chunk = legacyIds.slice(i, i + batchSize)
      const bundles = await this.createExtractor().getSurveyBundles(chunk)
      const bundleById = new Map(bundles.map((b) => [b._id, b]))

      for (const legacyId of chunk) {
        const nest = nestByLegacyId.get(legacyId)!
        const ulb = byUlbMap.get(nest.ulbId)

        const bundle = bundleById.get(legacyId)
        if (!bundle) {
          totals.onlyNest += 1
          if (ulb) ulb.onlyNest += 1
          if (samples.onlyNest.length < 20) {
            samples.onlyNest.push({ surveyId: nest.id, legacySurveyId: nest.legacySurveyId })
          }
          continue
        }

        const convexStatus = mapSurveyStatus(bundle.status)
        const statusDiffers = convexStatus !== nest.surveyStatus
        const isPendingQc = nest.qcStatus === "PENDING"

        if (statusDiffers && isPendingQc) {
          totals.statusMismatch += 1
          if (ulb) ulb.statusMismatch += 1
          if (samples.statusMismatch.length < 20) {
            samples.statusMismatch.push({
              legacySurveyId: legacyId,
              nestStatus: nest.surveyStatus,
              convexStatus: convexStatus ?? bundle.status,
              wardNo: normalizeWardNumber(bundle.wardNo),
            })
          }
          continue
        }

        const nestWard = normalizeWardNumber(nest.wardNumber ?? "")
        const convexWard = normalizeWardNumber(bundle.wardNo)
        if (nestWard !== convexWard) {
          totals.wardMismatch += 1
          if (ulb) ulb.wardMismatch += 1
          if (samples.wardMismatch.length < 20) {
            samples.wardMismatch.push({
              legacySurveyId: legacyId,
              nestWard,
              convexWard,
            })
          }
          continue
        }

        totals.ok += 1
        if (ulb) ulb.ok += 1
      }
    }

    const { count, samples: onlyConvexSamples } = await this.findOnlyConvexSurveys(ulbCodeSet, nestIdsWithLegacy)
    totals.onlyConvexSampled = count
    samples.onlyConvex = onlyConvexSamples

    const byUlb = [...byUlbMap.values()].sort((a, b) => a.ulbCode.localeCompare(b.ulbCode))

    return {
      districtId: district.id,
      districtName: district.name,
      totals,
      byUlb,
      samples,
    }
  }

  private async findOnlyConvexSurveys(
    ulbCodeSet: Set<string>,
    nestIds: Set<string>
  ): Promise<{ count: number; samples: ReconcileResult["samples"]["onlyConvex"] }> {
    if (ulbCodeSet.size === 0) return { count: 0, samples: [] }

    const extractor = this.createExtractor()
    let count = 0
    const samples: ReconcileResult["samples"]["onlyConvex"] = []
    let cursor: string | null = null

    do {
      const page = await extractor.listSurveyIds({ cursor, numItems: DEFAULT_ETL_BATCH_SIZE })
      if (page.ids.length === 0) break

      for (let i = 0; i < page.ids.length; i += 50) {
        const chunk = page.ids.slice(i, i + 50)
        const bundles = await extractor.getSurveyBundles(chunk)
        for (const bundle of bundles) {
          const code = bundle.municipalityCode?.trim()
          if (!code || !ulbCodeSet.has(code)) continue
          if (nestIds.has(bundle._id)) continue
          count += 1
          if (samples.length < 20) {
            samples.push({
              legacySurveyId: bundle._id,
              municipalityCode: code,
              wardNo: normalizeWardNumber(bundle.wardNo),
              status: mapSurveyStatus(bundle.status) ?? bundle.status,
            })
          }
        }
      }

      cursor = page.continueCursor
      if (page.isDone) break
    } while (cursor !== null)

    return { count, samples }
  }

  private createExtractor(): ConvexHttpExtractor {
    const siteUrl = this.config.get<string>("CONVEX_SITE_URL")?.trim().replace(/\/+$/, "")
    const etlSecret = this.config.get<string>("ETL_CONVEX_SECRET")?.trim()
    if (!siteUrl || !etlSecret) {
      throw new ServiceUnavailableException("CONVEX_SITE_URL / ETL_CONVEX_SECRET not configured")
    }
    return new ConvexHttpExtractor({ siteUrl, etlSecret })
  }
}
