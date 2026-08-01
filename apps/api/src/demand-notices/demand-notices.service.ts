import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import type { AssessmentYear, PhotoType, Prisma } from "@workspace/database"
import { QcStatus } from "@workspace/database"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { getSkipTake, toPaginatedResult } from "../common/utils/pagination.util.js"
import { resolvePrimaryOwnerName } from "../common/utils/primary-owner.util.js"
import { buildTenantWhere, resolveTenantScope } from "../common/utils/tenant-scope.util.js"
import { PrismaService } from "../prisma/prisma.service.js"
import { StorageService } from "../storage/storage.service.js"
import {
  DEMAND_NOTICE_LEGAL,
  type DemandNoticeAssessmentDto,
  type DemandNoticeDocumentDto,
  type DemandNoticeOfficeDto,
  type DemandNoticeRegisterRowDto,
  type FloorAssessmentRowDto,
} from "./demand-notice.types.js"
import type { DemandNoticeListQueryDto, DemandNoticePrintTokenDto } from "./dto/demand-notice.dto.js"
import { DEMAND_NOTICE_WARD_PDF_MAX, PRINT_TOKEN_TTL_MS, signPrintToken, verifyPrintToken } from "./lib/print-token.js"
import {
  computeDemandTotals,
  computeFloorAlv,
  formatAssessmentYearLabel,
  formatNoticeDate,
  humanizeEnum,
  resolveUsageRateMult,
} from "./lib/tax-calc.js"

const surveyInclude = {
  floors: { orderBy: { position: "asc" as const } },
  photos: { orderBy: { createdAt: "asc" as const } },
  coOwners: { orderBy: { ownerIndex: "asc" as const } },
  ward: { select: { id: true, wardName: true, wardNumber: true } },
  ulb: {
    select: {
      id: true,
      name: true,
      type: true,
      district: { select: { name: true, state: { select: { name: true } } } },
    },
  },
  district: { select: { id: true, name: true } },
  state: { select: { id: true, name: true } },
} as const

type SurveyWithRelations = Prisma.SurveyGetPayload<{ include: typeof surveyInclude }>

function toNumber(value: { toString(): string } | number | string | null | undefined): number {
  if (value == null) return 0
  return typeof value === "number" ? value : Number(value)
}

@Injectable()
export class DemandNoticesService {
  private readonly logger = new Logger(DemandNoticesService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService
  ) {}

  async list(query: DemandNoticeListQueryDto, user: AuthenticatedUser) {
    const where = await this.buildApprovedWhere(query, user)
    const { skip, take, page, limit } = getSkipTake({ ...query, limit: Math.min(query.limit ?? 25, 100) })

    const [total, surveys] = await Promise.all([
      this.prisma.db.survey.count({ where }),
      this.prisma.db.survey.findMany({
        where,
        include: surveyInclude,
        orderBy: [{ ward: { wardNumber: "asc" } }, { propertyId: "asc" }],
        skip,
        take,
      }),
    ])

    const rows: DemandNoticeRegisterRowDto[] = []
    let pageDemandSum = 0
    let rateMissingCount = 0

    for (const survey of surveys) {
      const doc = await this.buildDocumentFromSurvey(survey, { skipPhotos: true })
      const rateMissing = doc.assessment.rateMissing
      if (rateMissing) rateMissingCount += 1
      else pageDemandSum += doc.assessment.totalAnnualDemand

      rows.push({
        surveyId: survey.id,
        propertyId: doc.propertyId,
        wardId: survey.wardId,
        wardNumber: survey.ward.wardNumber,
        ownerName: doc.ownerName,
        assessmentYear: doc.assessmentYear,
        assessmentYearLabel: doc.assessmentYearLabel,
        totalDemand: rateMissing ? null : doc.assessment.totalAnnualDemand,
        rateMissing,
        rateMissingReason: doc.assessment.rateMissingReason,
        approvedAt: survey.approvedAt?.toISOString() ?? null,
      })
    }

    const paginated = toPaginatedResult(rows, total, page, limit)
    return {
      ...paginated,
      kpis: {
        noticeCount: total,
        pageDemand: pageDemandSum,
        rateMissingCount,
      },
    }
  }

  async getDocument(surveyId: string, user?: AuthenticatedUser): Promise<DemandNoticeDocumentDto> {
    const survey = await this.prisma.db.survey.findFirst({
      where: { id: surveyId, deletedAt: null, qcStatus: QcStatus.APPROVED },
      include: surveyInclude,
    })
    if (!survey) throw new NotFoundException("Demand notice not found (QC APPROVED only)")

    if (user) {
      const scope = resolveTenantScope(user.tenantRoles)
      const tenantWhere = buildTenantWhere(scope)
      if (tenantWhere) {
        const allowed = await this.prisma.db.survey.count({
          where: { id: surveyId, deletedAt: null, qcStatus: QcStatus.APPROVED, ...tenantWhere },
        })
        if (!allowed) throw new NotFoundException("Demand notice not found")
      }
    }

    return this.buildDocumentFromSurvey(survey)
  }

  async listWardDocuments(
    wardId: string,
    assessmentYearId: string | undefined,
    user?: AuthenticatedUser
  ): Promise<DemandNoticeDocumentDto[]> {
    const query = { wardId, assessmentYearId } satisfies DemandNoticeListQueryDto
    const where = await this.buildApprovedWhere(query, user)
    const surveys = await this.prisma.db.survey.findMany({
      where,
      include: surveyInclude,
      orderBy: [{ propertyId: "asc" }],
      take: DEMAND_NOTICE_WARD_PDF_MAX + 1,
    })
    if (surveys.length > DEMAND_NOTICE_WARD_PDF_MAX) {
      throw new BadRequestException(
        `Ward has more than ${DEMAND_NOTICE_WARD_PDF_MAX} approved notices. Narrow the filter.`
      )
    }
    const docs: DemandNoticeDocumentDto[] = []
    for (const survey of surveys) {
      docs.push(await this.buildDocumentFromSurvey(survey))
    }
    return docs
  }

  mintPrintToken(dto: DemandNoticePrintTokenDto, user: AuthenticatedUser) {
    if (!dto.surveyId && !dto.wardId) {
      throw new BadRequestException("surveyId or wardId is required")
    }
    if (dto.wardId && !dto.surveyId && !dto.assessmentYearId) {
      // ward bulk can omit AY but UI should prefer it; allow all approved years in ward
    }
    const secret = this.printSecret()
    const token = signPrintToken(
      {
        surveyId: dto.surveyId,
        wardId: dto.wardId,
        assessmentYearId: dto.assessmentYearId,
        exp: Date.now() + PRINT_TOKEN_TTL_MS,
      },
      secret
    )
    this.logger.log(`Print token minted by user=${user.id} survey=${dto.surveyId ?? "-"} ward=${dto.wardId ?? "-"}`)
    return { token, expiresInMs: PRINT_TOKEN_TTL_MS }
  }

  async getDocumentByPrintToken(surveyId: string, token: string): Promise<DemandNoticeDocumentDto> {
    const claims = this.parseToken(token)
    if (claims.surveyId && claims.surveyId !== surveyId) {
      throw new UnauthorizedException("Print token survey mismatch")
    }
    return this.getDocument(surveyId)
  }

  async listWardDocumentsByPrintToken(
    wardId: string,
    assessmentYearId: string | undefined,
    token: string
  ): Promise<DemandNoticeDocumentDto[]> {
    const claims = this.parseToken(token)
    if (claims.wardId && claims.wardId !== wardId) {
      throw new UnauthorizedException("Print token ward mismatch")
    }
    const ay = assessmentYearId ?? claims.assessmentYearId
    return this.listWardDocuments(wardId, ay)
  }

  private parseToken(token: string) {
    try {
      return verifyPrintToken(token, this.printSecret())
    } catch (err) {
      throw new UnauthorizedException(err instanceof Error ? err.message : "Invalid print token")
    }
  }

  private printSecret(): string {
    const secret =
      this.config.get<string>("DEMAND_NOTICE_PRINT_SECRET") || this.config.get<string>("CLERK_SECRET_KEY") || ""
    if (!secret) {
      throw new BadRequestException("DEMAND_NOTICE_PRINT_SECRET is not configured")
    }
    return secret
  }

  private async buildApprovedWhere(
    query: DemandNoticeListQueryDto,
    user?: AuthenticatedUser
  ): Promise<Prisma.SurveyWhereInput> {
    const scope = user
      ? resolveTenantScope(user.tenantRoles)
      : {
          isGlobal: true as const,
          stateIds: [],
          districtIds: [],
          ulbIds: [],
          wardIds: [],
          parentStateIds: [],
          parentDistrictIds: [],
          parentUlbIds: [],
        }
    const tenantWhere = user ? buildTenantWhere(scope) : undefined

    let assessmentYear: AssessmentYear | undefined
    if (query.assessmentYear) {
      assessmentYear = query.assessmentYear as AssessmentYear
    } else if (query.assessmentYearId) {
      const entry = await this.prisma.db.referenceEntry.findUnique({ where: { id: query.assessmentYearId } })
      if (!entry) throw new BadRequestException("Invalid assessmentYearId")
      assessmentYear = entry.code as AssessmentYear
    }

    return {
      deletedAt: null,
      qcStatus: QcStatus.APPROVED,
      ...(tenantWhere ?? {}),
      ...(query.districtId ? { districtId: query.districtId } : {}),
      ...(query.ulbId ? { ulbId: query.ulbId } : {}),
      ...(query.wardId ? { wardId: query.wardId } : {}),
      ...(assessmentYear ? { assessmentYear } : {}),
      ...(query.search
        ? {
            OR: [
              { propertyId: { contains: query.search, mode: "insensitive" } },
              { respondentName: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    }
  }

  private async buildDocumentFromSurvey(
    survey: SurveyWithRelations,
    opts?: { skipPhotos?: boolean }
  ): Promise<DemandNoticeDocumentDto> {
    const primaryOwner = survey.coOwners[0]
    const ownerName = resolvePrimaryOwnerName(survey.coOwners, survey.respondentName) ?? "—"
    const fatherName = primaryOwner?.fatherOrHusbandName?.trim() || "—"
    const mobileNo = primaryOwner?.mobile?.trim() || survey.mobileNumber?.trim() || "—"
    const address = [survey.houseDoorNo, survey.locality, survey.colony, survey.city, survey.pinCode]
      .filter(Boolean)
      .join(", ")

    const office = this.buildOffice(survey)
    const assessment = await this.computeAssessment(survey)

    let frontPhotoUrl: string | null = null
    let sidePhotoUrl: string | null = null
    if (!opts?.skipPhotos) {
      const urls = await this.resolvePhotoUrls(survey.photos)
      frontPhotoUrl = urls.front
      sidePhotoUrl = urls.side
    }

    return {
      surveyId: survey.id,
      propertyId: survey.propertyId,
      assessmentYear: survey.assessmentYear,
      assessmentYearLabel: formatAssessmentYearLabel(survey.assessmentYear),
      noticeDate: formatNoticeDate(survey.approvedAt ?? new Date()),
      ownerName,
      fatherName,
      mobileNo,
      oldHouseNo: survey.propertyIdOld?.trim() || "—",
      address: address || "—",
      taxZoneLabel: humanizeEnum(survey.taxRateZone),
      wardLabel: `Ward No. ${survey.ward.wardNumber}`,
      gisParcel: survey.ward.wardNumber,
      propertyUseLabel: humanizeEnum(survey.propertyUse),
      latitude: survey.latitude != null ? toNumber(survey.latitude) : null,
      longitude: survey.longitude != null ? toNumber(survey.longitude) : null,
      frontPhotoUrl,
      sidePhotoUrl,
      office,
      assessment,
      legalHindi: DEMAND_NOTICE_LEGAL.hindi,
      legalEnglish: DEMAND_NOTICE_LEGAL.english,
    }
  }

  private buildOffice(survey: SurveyWithRelations): DemandNoticeOfficeDto {
    const ulbName = survey.ulb.name
    const districtName = survey.ulb.district?.name ?? survey.district.name
    const stateName = survey.ulb.district?.state?.name ?? survey.state.name
    const isTownPanchayat = survey.ulb.type === "TOWN_PANCHAYAT"
    const bodyEn = isTownPanchayat ? "Town Panchayat" : "Municipal Council"
    const bodyHi = isTownPanchayat ? "नगर पंचायत" : "नगर पालिका परिषद"
    const subject = ulbName.toLowerCase().startsWith(bodyEn.toLowerCase()) ? ulbName : `${bodyEn} ${ulbName}`
    return {
      headerLine1: `Office of ${subject}`,
      headerLine2: `${districtName}, ${stateName}`,
      ulbName,
      districtName,
      stateName,
      hindiOffice: `कार्यालय ${bodyHi} ${ulbName}`,
    }
  }

  private async computeAssessment(survey: SurveyWithRelations): Promise<DemandNoticeAssessmentDto> {
    const empty = (reason: string): DemandNoticeAssessmentDto => ({
      floorRows: [],
      totalArea: 0,
      totalAlv: 0,
      totalAssessableAlv: 0,
      assessablePct: 80,
      propertyTaxPct: 10,
      waterTaxPct: 7.5,
      drainageTaxPct: 2.5,
      penaltyPct: 0,
      propertyTax: 0,
      waterTax: 0,
      drainageTax: 0,
      penalty: 0,
      totalAnnualDemand: 0,
      annualBaseRate: null,
      rateMissing: true,
      rateMissingReason: reason,
    })

    const ayEntry = await this.prisma.db.referenceEntry.findFirst({
      where: {
        code: survey.assessmentYear,
        status: "ACTIVE",
        category: { code: "ASSESSMENT_YEAR" },
      },
    })
    if (!ayEntry) return empty(`Assessment year catalog entry missing for ${survey.assessmentYear}`)

    const taxConfig = await this.prisma.db.taxConfig.findUnique({
      where: {
        wardId_assessmentYearId: { wardId: survey.wardId, assessmentYearId: ayEntry.id },
      },
      include: {
        cells: { include: { roadWidthEntry: true, constructionEntry: true } },
      },
    })
    if (!taxConfig || taxConfig.status !== "PUBLISHED") {
      return empty("Published tax config not found for this ward and assessment year")
    }

    const assessablePct = toNumber(taxConfig.assessablePct)
    const propertyTaxPct = toNumber(taxConfig.propertyTaxPct)
    const waterTaxPct = toNumber(taxConfig.waterTaxPct)
    const drainageTaxPct = toNumber(taxConfig.drainageTaxPct)
    const penaltyPct = toNumber(taxConfig.penaltyPct)

    const zoneCode = survey.taxRateZone
    if (!zoneCode) return empty("Survey tax rate zone is missing")

    const roadEntry = await this.prisma.db.referenceEntry.findFirst({
      where: { code: zoneCode, status: "ACTIVE", category: { code: "TAX_RATE_ZONE" } },
    })
    if (!roadEntry) return empty(`Tax rate zone catalog entry missing for ${zoneCode}`)

    const floorRows: FloorAssessmentRowDto[] = []
    let sno = 1
    let firstRate: number | null = null

    for (const floor of survey.floors) {
      const constructionCode = floor.constructionType
      if (!constructionCode) {
        return empty(`Floor ${floor.floorPosition} missing construction type`)
      }
      const constructionEntry = await this.prisma.db.referenceEntry.findFirst({
        where: { code: constructionCode, status: "ACTIVE", category: { code: "CONSTRUCTION_TYPE" } },
      })
      if (!constructionEntry) {
        return empty(`Construction catalog entry missing for ${constructionCode}`)
      }

      const cell = taxConfig.cells.find(
        (c) => c.roadWidthEntryId === roadEntry.id && c.constructionEntryId === constructionEntry.id
      )
      const annualRate = cell ? toNumber(cell.annualRatePerSqFt) : 0
      if (!cell || annualRate <= 0) {
        return empty(`Rate cell missing for zone ${humanizeEnum(zoneCode)} × ${humanizeEnum(constructionCode)}`)
      }
      if (firstRate == null) firstRate = annualRate

      const areaSqFt = toNumber(floor.areaSqFt)
      const usageMult = resolveUsageRateMult(floor.usageFactor, floor.usageType, survey.propertyUse)
      const { grossAlv, assessableAlv, propertyTax } = computeFloorAlv(
        areaSqFt,
        annualRate,
        usageMult,
        assessablePct,
        propertyTaxPct
      )

      floorRows.push({
        sno: sno++,
        floorLabel: humanizeEnum(floor.floorPosition),
        usageTypeLabel: humanizeEnum(floor.usageType),
        usageFactorLabel: humanizeEnum(floor.usageFactor),
        constructionLabel: humanizeEnum(floor.constructionType),
        areaSqFt,
        annualRate,
        usageMult,
        alv: grossAlv,
        assessableAlv,
        tax: propertyTax,
      })
    }

    if (floorRows.length === 0) {
      // Fallback: use total built area with first available cell for zone
      const anyCell = taxConfig.cells.find((c) => c.roadWidthEntryId === roadEntry.id)
      const annualRate = anyCell ? toNumber(anyCell.annualRatePerSqFt) : 0
      if (!anyCell || annualRate <= 0) return empty("No floors and no usable rate cell")
      const areaSqFt = toNumber(survey.totalBuiltAreaSqFt) || toNumber(survey.plinthAreaSqFt)
      const usageMult = resolveUsageRateMult(null, null, survey.propertyUse)
      const { grossAlv, assessableAlv, propertyTax } = computeFloorAlv(
        areaSqFt,
        annualRate,
        usageMult,
        assessablePct,
        propertyTaxPct
      )
      floorRows.push({
        sno: 1,
        floorLabel: "Ground Floor",
        usageTypeLabel: humanizeEnum(survey.propertyUse),
        usageFactorLabel: "—",
        constructionLabel: anyCell.constructionEntry?.name ?? "—",
        areaSqFt,
        annualRate,
        usageMult,
        alv: grossAlv,
        assessableAlv,
        tax: propertyTax,
      })
      firstRate = annualRate
    }

    const totalArea = floorRows.reduce((s, r) => s + r.areaSqFt, 0)
    const totalAlv = floorRows.reduce((s, r) => s + r.alv, 0)
    const totalAssessableAlv = floorRows.reduce((s, r) => s + r.assessableAlv, 0)
    const propertyTax = floorRows.reduce((s, r) => s + r.tax, 0)
    const openLand = String(survey.propertyUse ?? "").includes("OPEN_LAND")
    const includeWater = !openLand && survey.waterConnection !== "NO"
    const { waterTax, drainageTax, penalty, totalAnnualDemand } = computeDemandTotals(
      totalAssessableAlv,
      propertyTax,
      waterTaxPct,
      drainageTaxPct,
      penaltyPct,
      includeWater,
      !openLand
    )

    return {
      floorRows,
      totalArea,
      totalAlv,
      totalAssessableAlv,
      assessablePct,
      propertyTaxPct,
      waterTaxPct,
      drainageTaxPct,
      penaltyPct,
      propertyTax,
      waterTax,
      drainageTax,
      penalty,
      totalAnnualDemand,
      annualBaseRate: firstRate,
      rateMissing: false,
      rateMissingReason: null,
    }
  }

  private async resolvePhotoUrls(
    photos: Array<{
      id: string
      photoType: PhotoType
      url: string | null
      objectKey: string | null
      sourceUrl?: string | null
    }>
  ): Promise<{ front: string | null; side: string | null }> {
    const pick = async (type: PhotoType): Promise<string | null> => {
      const photo = photos.find((p) => p.photoType === type)
      if (!photo) return null
      if (photo.sourceUrl && /^https?:\/\//i.test(photo.sourceUrl)) return photo.sourceUrl
      if (photo.url && /^https?:\/\//i.test(photo.url)) return photo.url
      if (photo.objectKey && this.storage.isConfigured()) {
        try {
          return await this.storage.getPresignedDownloadUrl(photo.objectKey, 3600)
        } catch (err) {
          this.logger.warn(`Photo URL failed photo=${photo.id}: ${String(err)}`)
        }
      }
      return null
    }
    return { front: await pick("FRONT"), side: await pick("SIDE") }
  }
}
