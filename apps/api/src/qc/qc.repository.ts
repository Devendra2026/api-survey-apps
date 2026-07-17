import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common"
import { OwnershipType, type CoOwner, type Prisma } from "@workspace/database"
import { formatPropertyId, padParcelNo } from "@workspace/validation"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { getSkipTake, toPaginatedResult } from "../common/utils/pagination.util.js"
import { buildTenantWhere, resolveTenantScope } from "../common/utils/tenant-scope.util.js"
import { PrismaService } from "../prisma/prisma.service.js"
import type { QcFiltersDto } from "./dto/qc-filters.dto.js"
import type { QcRegistryQueryDto } from "./dto/qc-registry.dto.js"
import type { QcCoOwnerInputDto, QcFloorInputDto, QcSurveyCorrectionDto } from "./dto/qc-survey-action.dto.js"

const QC_REGISTRY_STATUSES = ["SUBMITTED", "APPROVED", "REJECTED", "REOPENED"] as const

function formatRegistryDate(value: Date | null | undefined) {
  if (!value) return "—"
  return value.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

function displayQcStatus(surveyStatus: string, qcStatus?: string | null) {
  if (surveyStatus === "APPROVED" || qcStatus === "APPROVED") return "Approved"
  if (surveyStatus === "REOPENED" || surveyStatus === "REJECTED" || qcStatus === "REJECTED") return "Returned"
  if (surveyStatus === "SUBMITTED" && (qcStatus === "PENDING" || !qcStatus)) return "Pending QC"
  if (surveyStatus === "SUBMITTED") return "Pending QC"
  return surveyStatus
}

@Injectable()
export class QcRepository {
  constructor(private readonly prisma: PrismaService) {}

  private resolveFilters(filters: QcFiltersDto) {
    const districtId = filters.districtId || filters.district
    const ulbId = filters.ulbId || filters.ulb
    const wardId = filters.wardId || filters.ward

    let dateFrom: Date | undefined
    let dateTo: Date | undefined

    if (filters.month && /^\d{4}-\d{2}$/.test(filters.month)) {
      const year = Number(filters.month.slice(0, 4))
      const month = Number(filters.month.slice(5, 7))
      dateFrom = new Date(Date.UTC(year, month - 1, 1))
      dateTo = new Date(Date.UTC(year, month, 1))
    } else {
      if (filters.dateFrom) dateFrom = new Date(`${filters.dateFrom}T00:00:00.000Z`)
      if (filters.dateTo) {
        dateTo = new Date(`${filters.dateTo}T00:00:00.000Z`)
        dateTo.setUTCDate(dateTo.getUTCDate() + 1)
      }
    }

    return { districtId, ulbId, wardId, dateFrom, dateTo }
  }

  private buildWhere(user: AuthenticatedUser, filters: QcFiltersDto): Prisma.SurveyWhereInput {
    const scope = resolveTenantScope(user.tenantRoles)
    const tenantWhere = buildTenantWhere(scope)
    const f = this.resolveFilters(filters)

    return {
      deletedAt: null,
      ...(tenantWhere ?? {}),
      ...(f.districtId ? { districtId: f.districtId } : {}),
      ...(f.ulbId ? { ulbId: f.ulbId } : {}),
      ...(f.wardId ? { wardId: f.wardId } : {}),
      ...(f.dateFrom || f.dateTo
        ? {
            createdAt: {
              ...(f.dateFrom ? { gte: f.dateFrom } : {}),
              ...(f.dateTo ? { lt: f.dateTo } : {}),
            },
          }
        : {}),
    }
  }

  private registryBaseWhere(user: AuthenticatedUser, query: QcRegistryQueryDto): Prisma.SurveyWhereInput {
    const scope = resolveTenantScope(user.tenantRoles)
    const tenantWhere = buildTenantWhere(scope)
    const search = query.search?.trim()

    return {
      deletedAt: null,
      surveyStatus: { in: [...QC_REGISTRY_STATUSES] },
      ...(tenantWhere ?? {}),
      ...(query.districtId ? { districtId: query.districtId } : {}),
      ...(query.ulbId ? { ulbId: query.ulbId } : {}),
      ...(query.wardId ? { wardId: query.wardId } : {}),
      ...(search
        ? {
            OR: [
              { propertyId: { contains: search, mode: "insensitive" } },
              { respondentName: { contains: search, mode: "insensitive" } },
              { parcelNumber: { contains: search, mode: "insensitive" } },
              { wardNumber: { contains: search, mode: "insensitive" } },
              { assignedTo: { fullName: { contains: search, mode: "insensitive" } } },
              { createdBy: { fullName: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    }
  }

  private registryTabWhere(status?: string): Prisma.SurveyWhereInput {
    switch (status) {
      case "pendingQc":
        return { surveyStatus: "SUBMITTED", qcStatus: "PENDING" }
      case "approved":
        return {
          OR: [{ qcStatus: "APPROVED" }, { surveyStatus: "APPROVED" }],
        }
      case "returned":
        return {
          OR: [{ surveyStatus: "REOPENED" }, { surveyStatus: "REJECTED" }, { qcStatus: "REJECTED" }],
        }
      case "parcelShared":
        // Placeholder until a parcel-shared field exists on Survey
        return { id: "__never__" }
      case "all":
        return {}
      case "pendingApproved":
      default:
        return {
          OR: [
            { surveyStatus: "SUBMITTED", qcStatus: "PENDING" },
            { qcStatus: "APPROVED" },
            { surveyStatus: "APPROVED" },
          ],
        }
    }
  }

  private async getRegistryCounts(user: AuthenticatedUser, query: QcRegistryQueryDto) {
    const base = this.registryBaseWhere(user, query)
    const [pendingApproved, pendingQc, approved, returned, all] = await Promise.all([
      this.prisma.db.survey.count({ where: { AND: [base, this.registryTabWhere("pendingApproved")] } }),
      this.prisma.db.survey.count({ where: { AND: [base, this.registryTabWhere("pendingQc")] } }),
      this.prisma.db.survey.count({ where: { AND: [base, this.registryTabWhere("approved")] } }),
      this.prisma.db.survey.count({ where: { AND: [base, this.registryTabWhere("returned")] } }),
      this.prisma.db.survey.count({ where: base }),
    ])
    return {
      pendingApproved,
      pendingQc,
      approved,
      returned,
      parcelShared: 0,
      all,
    }
  }

  private async resolveRegistryScopeLabel(query: QcRegistryQueryDto) {
    const [district, ulb, ward] = await Promise.all([
      query.districtId
        ? this.prisma.db.district.findUnique({ where: { id: query.districtId }, select: { name: true } })
        : null,
      query.ulbId ? this.prisma.db.ulb.findUnique({ where: { id: query.ulbId }, select: { name: true } }) : null,
      query.wardId
        ? this.prisma.db.ward.findUnique({
            where: { id: query.wardId },
            select: { wardName: true, wardNumber: true },
          })
        : null,
    ])

    if (!district && !ulb && !ward) return null

    const wardLabel = ward ? (ward.wardName?.startsWith("Ward") ? ward.wardName : `Ward ${ward.wardNumber}`) : null

    return {
      districtName: district?.name ?? null,
      ulbName: ulb?.name ?? null,
      wardName: wardLabel,
      label: [district?.name, ulb?.name, wardLabel].filter(Boolean).join(" - "),
    }
  }

  async listRegistry(user: AuthenticatedUser, query: QcRegistryQueryDto) {
    const { skip, take, page, limit } = getSkipTake(query)
    const base = this.registryBaseWhere(user, query)
    const where: Prisma.SurveyWhereInput = {
      AND: [base, this.registryTabWhere(query.status)],
    }

    const orderBy: Prisma.SurveyOrderByWithRelationInput =
      query.sortBy === "propertyId"
        ? { propertyId: query.sortOrder === "asc" ? "asc" : "desc" }
        : query.sortBy === "surveyStatus"
          ? { surveyStatus: query.sortOrder === "asc" ? "asc" : "desc" }
          : { createdAt: query.sortOrder === "asc" ? "asc" : "desc" }

    const [rows, total, counts, scope] = await Promise.all([
      this.prisma.db.survey.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          assignedTo: { select: { id: true, fullName: true } },
          createdBy: { select: { id: true, fullName: true } },
          ward: { select: { id: true, wardName: true, wardNumber: true } },
          ulb: { select: { id: true, name: true } },
          district: { select: { id: true, name: true } },
        },
      }),
      this.prisma.db.survey.count({ where }),
      this.getRegistryCounts(user, query),
      this.resolveRegistryScopeLabel(query),
    ])

    const items = rows.map((row) => ({
      id: row.id,
      propertyId: row.propertyId,
      status: displayQcStatus(row.surveyStatus, row.qcStatus),
      surveyStatus: row.surveyStatus,
      qcStatus: row.qcStatus,
      surveyorName: row.assignedTo?.fullName ?? row.createdBy.fullName,
      wardNumber: row.ward?.wardNumber ?? row.wardNumber ?? "—",
      parcelNumber: row.parcelNumber ?? "—",
      propertyUse: row.propertyUse,
      ownerName: row.respondentName?.trim() || "—",
      mobile: row.mobileNumber?.trim() || "—",
      date: formatRegistryDate(row.submittedAt ?? row.approvedAt ?? row.createdAt),
      createdAt: row.createdAt.toISOString(),
    }))

    return {
      ...toPaginatedResult(items, total, page, limit),
      counts,
      scope,
    }
  }

  async getMetrics(user: AuthenticatedUser, filters: QcFiltersDto) {
    const where = this.buildWhere(user, filters)
    const now = new Date()
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

    const [pending, inReview, approved, returned, submittedTotal, fieldDrafts, draftsSubmittedToday] =
      await Promise.all([
        this.prisma.db.survey.count({
          where: { ...where, surveyStatus: "SUBMITTED", qcStatus: "PENDING" },
        }),
        this.prisma.db.survey.count({
          where: { ...where, surveyStatus: "REOPENED" },
        }),
        this.prisma.db.survey.count({
          where: { ...where, qcStatus: "APPROVED" },
        }),
        this.prisma.db.survey.count({
          where: { ...where, surveyStatus: "REJECTED" },
        }),
        this.prisma.db.survey.count({
          where: { ...where, submittedAt: { not: null } },
        }),
        this.prisma.db.survey.count({
          where: { ...where, surveyStatus: "DRAFT" },
        }),
        this.prisma.db.survey.count({
          where: { ...where, submittedAt: { gte: startOfToday } },
        }),
      ])

    const pendingQcRemaining = pending + inReview
    const queueTotal = pending + inReview + approved
    const qcProgressPct = queueTotal > 0 ? Math.round((approved / queueTotal) * 100) : 0

    return {
      pipeline: {
        pending,
        inReview,
        approved,
        returned,
      },
      pendingQc: pending,
      pendingQcRemaining,
      submittedTotal,
      approvedQc: approved,
      queueTotal,
      qcProgressPct,
      fieldDrafts,
      draftsSubmittedToday,
    }
  }

  async getWards(user: AuthenticatedUser, filters: QcFiltersDto) {
    const f = this.resolveFilters(filters)
    if (!f.ulbId) return []

    const where = this.buildWhere(user, filters)

    const statusRows = await this.prisma.db.survey.groupBy({
      by: ["wardId", "surveyStatus"],
      where,
      _count: { _all: true },
    })

    const byWard = new Map<
      string,
      { totalProperty: number; fieldDrafts: number; qcPending: number; qcApproved: number }
    >()

    for (const row of statusRows) {
      const current = byWard.get(row.wardId) ?? {
        totalProperty: 0,
        fieldDrafts: 0,
        qcPending: 0,
        qcApproved: 0,
      }
      current.totalProperty += row._count._all
      if (row.surveyStatus === "DRAFT") current.fieldDrafts += row._count._all
      if (row.surveyStatus === "SUBMITTED") current.qcPending += row._count._all
      if (row.surveyStatus === "APPROVED") current.qcApproved += row._count._all
      byWard.set(row.wardId, current)
    }

    if (byWard.size === 0) return []

    const wards = await this.prisma.db.ward.findMany({
      where: { id: { in: [...byWard.keys()] } },
      select: { id: true, wardName: true, wardNumber: true },
      orderBy: { wardNumber: "asc" },
    })

    return wards.map((ward) => {
      const stats = byWard.get(ward.id)!
      const name = ward.wardName?.trim() || `Ward ${ward.wardNumber}`
      const padded = String(ward.wardNumber).padStart(2, "0")
      return {
        wardId: ward.id,
        wardName: name,
        wardNumber: ward.wardNumber,
        label: `Ward No. ${padded} — ${name.startsWith("Ward") ? name.replace(/^Ward\s*/i, "").trim() || name : name}`,
        totalProperty: stats.totalProperty,
        fieldDrafts: stats.fieldDrafts,
        qcPending: stats.qcPending,
        qcApproved: stats.qcApproved,
        pending: stats.qcPending,
      }
    })
  }

  async qcSoftDelete(id: string, changedBy: string) {
    const existing = await this.prisma.db.survey.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, surveyStatus: true },
    })
    if (!existing) throw new NotFoundException("Survey not found")

    return this.prisma.db.$transaction(async (tx) => {
      const survey = await tx.survey.update({
        where: { id },
        data: { deletedAt: new Date() },
      })
      await tx.surveyAudit.create({
        data: {
          surveyId: id,
          action: "DELETED",
          oldValue: { deletedAt: null, surveyStatus: existing.surveyStatus },
          newValue: { deletedAt: survey.deletedAt },
          changedBy,
        },
      })
      return survey
    })
  }

  async qcCorrectSurvey(id: string, patch: QcSurveyCorrectionDto, changedBy: string) {
    const existing = await this.prisma.db.survey.findFirst({
      where: { id, deletedAt: null },
      include: {
        floors: { orderBy: { position: "asc" } },
        coOwners: { orderBy: { ownerIndex: "asc" } },
        ward: { select: { id: true, wardName: true, wardNumber: true } },
        ulb: { select: { id: true, name: true, code: true } },
      },
    })
    if (!existing) throw new NotFoundException("Survey not found")

    const canCorrect = existing.surveyStatus === "SUBMITTED" && (existing.qcStatus === "PENDING" || !existing.qcStatus)
    if (!canCorrect) {
      throw new BadRequestException("QC corrections are only allowed while the survey is Pending QC")
    }

    let coOwnersPatch = patch.coOwners
    if (patch.fatherHusbandName !== undefined) {
      const base =
        coOwnersPatch ??
        existing.coOwners.map((o: CoOwner) => ({
          id: o.id,
          name: o.name,
          fatherOrHusbandName: o.fatherOrHusbandName ?? undefined,
          mobile: o.mobile ?? undefined,
          alternateMobile: o.alternateMobile ?? undefined,
        }))
      if (base.length > 0 && base[0]) {
        const first = base[0]
        coOwnersPatch = [
          {
            ...first,
            name: first.name ?? "Owner",
            fatherOrHusbandName: patch.fatherHusbandName,
          },
          ...base.slice(1),
        ]
      } else if (patch.fatherHusbandName.trim()) {
        coOwnersPatch = [
          {
            name: (patch.respondentName ?? existing.respondentName ?? "Owner").trim() || "Owner",
            fatherOrHusbandName: patch.fatherHusbandName,
          },
        ]
      }
    }

    const effectiveOwnership = patch.ownershipType ?? existing.ownershipType
    const effectiveCoOwners =
      coOwnersPatch ??
      existing.coOwners.map((o) => ({
        id: o.id,
        name: o.name,
        fatherOrHusbandName: o.fatherOrHusbandName ?? undefined,
        mobile: o.mobile ?? undefined,
        alternateMobile: o.alternateMobile ?? undefined,
      }))

    if (effectiveOwnership === OwnershipType.JOINT && effectiveCoOwners.length === 0) {
      throw new BadRequestException("JOINT ownership requires at least one co-owner")
    }

    const effectiveParcel = patch.parcelNumber !== undefined ? patch.parcelNumber : (existing.parcelNumber ?? "")
    const effectiveUnit = patch.unitSubNo !== undefined ? patch.unitSubNo : (existing.unitSubNo ?? "")
    const effectiveUse = patch.propertyUse !== undefined ? patch.propertyUse : existing.propertyUse
    const ulbCode = existing.ulbCode ?? existing.ulb?.code ?? ""
    const wardNo = existing.wardNumber ?? existing.ward?.wardNumber ?? ""

    let nextPropertyId = existing.propertyId
    if (ulbCode && wardNo && effectiveParcel && effectiveUnit && effectiveUse) {
      const formatted = formatPropertyId({
        ulbCode,
        wardNo,
        parcelNo: effectiveParcel,
        unitNo: effectiveUnit,
        propertyUse: effectiveUse,
      })
      if (formatted) nextPropertyId = formatted
    }

    if (nextPropertyId !== existing.propertyId) {
      const conflict = await this.prisma.db.survey.findFirst({
        where: {
          ulbId: existing.ulbId,
          propertyId: nextPropertyId,
          assessmentYear: patch.assessmentYear ?? existing.assessmentYear,
          deletedAt: null,
          NOT: { id: existing.id },
        },
        select: { id: true },
      })
      if (conflict) {
        throw new ConflictException(`Property ID ${nextPropertyId} already exists for this ULB and assessment year`)
      }
    }

    const scalarData: Prisma.SurveyUpdateInput = {}
    if (patch.respondentName !== undefined) scalarData.respondentName = patch.respondentName
    if (patch.mobileNumber !== undefined) scalarData.mobileNumber = patch.mobileNumber
    if (patch.alternateMobile !== undefined) scalarData.alternateMobile = patch.alternateMobile
    if (patch.relationshipWithOwner !== undefined) scalarData.relationshipWithOwner = patch.relationshipWithOwner
    if (patch.familySize !== undefined) scalarData.familySize = patch.familySize
    if (patch.houseDoorNo !== undefined) scalarData.houseDoorNo = patch.houseDoorNo
    if (patch.colony !== undefined) scalarData.colony = patch.colony
    if (patch.locality !== undefined) scalarData.locality = patch.locality
    if (patch.city !== undefined) scalarData.city = patch.city
    if (patch.pinCode !== undefined) scalarData.pinCode = patch.pinCode
    if (patch.sectorNo !== undefined) scalarData.sectorNo = patch.sectorNo
    if (patch.unitSubNo !== undefined) scalarData.unitSubNo = patch.unitSubNo
    if (patch.parcelNumber !== undefined) {
      const digits = patch.parcelNumber.replace(/\D/g, "")
      scalarData.parcelNumber = digits ? padParcelNo(digits) : patch.parcelNumber
    }
    if (patch.propertyIdOld !== undefined) scalarData.propertyIdOld = patch.propertyIdOld
    if (patch.constructedYear !== undefined) scalarData.constructedYear = patch.constructedYear
    if (patch.isSlum !== undefined) scalarData.isSlum = patch.isSlum
    if (patch.ownershipType !== undefined) scalarData.ownershipType = patch.ownershipType
    if (patch.propertyUse !== undefined) scalarData.propertyUse = patch.propertyUse
    if (patch.propertyType !== undefined) scalarData.propertyType = patch.propertyType
    if (patch.situation !== undefined) scalarData.situation = patch.situation
    if (patch.roadType !== undefined) scalarData.roadType = patch.roadType
    if (patch.taxRateZone !== undefined) scalarData.taxRateZone = patch.taxRateZone
    if (patch.assessmentYear !== undefined) scalarData.assessmentYear = patch.assessmentYear
    if (patch.plotAreaSqFt !== undefined) scalarData.plotAreaSqFt = patch.plotAreaSqFt
    if (patch.plinthAreaSqFt !== undefined) scalarData.plinthAreaSqFt = patch.plinthAreaSqFt
    if (patch.waterConnection !== undefined) scalarData.waterConnection = patch.waterConnection
    if (patch.sourceOfWater !== undefined) scalarData.sourceOfWater = patch.sourceOfWater
    if (patch.sanitationType !== undefined) scalarData.sanitationType = patch.sanitationType
    if (patch.solidWasteCollection !== undefined) scalarData.solidWasteCollection = patch.solidWasteCollection
    if (patch.latitude !== undefined) scalarData.latitude = patch.latitude
    if (patch.longitude !== undefined) scalarData.longitude = patch.longitude
    if (nextPropertyId !== existing.propertyId) {
      scalarData.propertyId = nextPropertyId
    }

    const oldValue = {
      propertyId: existing.propertyId,
      parcelNumber: existing.parcelNumber,
      respondentName: existing.respondentName,
      mobileNumber: existing.mobileNumber,
      alternateMobile: existing.alternateMobile,
      relationshipWithOwner: existing.relationshipWithOwner,
      familySize: existing.familySize,
      houseDoorNo: existing.houseDoorNo,
      colony: existing.colony,
      locality: existing.locality,
      city: existing.city,
      pinCode: existing.pinCode,
      sectorNo: existing.sectorNo,
      unitSubNo: existing.unitSubNo,
      propertyIdOld: existing.propertyIdOld,
      constructedYear: existing.constructedYear,
      isSlum: existing.isSlum,
      ownershipType: existing.ownershipType,
      propertyUse: existing.propertyUse,
      propertyType: existing.propertyType,
      situation: existing.situation,
      roadType: existing.roadType,
      taxRateZone: existing.taxRateZone,
      assessmentYear: existing.assessmentYear,
      plotAreaSqFt: existing.plotAreaSqFt != null ? Number(existing.plotAreaSqFt.toString()) : null,
      plinthAreaSqFt: existing.plinthAreaSqFt != null ? Number(existing.plinthAreaSqFt.toString()) : null,
      waterConnection: existing.waterConnection,
      sourceOfWater: existing.sourceOfWater,
      sanitationType: existing.sanitationType,
      solidWasteCollection: existing.solidWasteCollection,
      latitude: existing.latitude != null ? Number(existing.latitude.toString()) : null,
      longitude: existing.longitude != null ? Number(existing.longitude.toString()) : null,
      floors: existing.floors.map((f) => ({
        id: f.id,
        floorPosition: f.floorPosition,
        usageType: f.usageType,
        usageFactor: f.usageFactor,
        constructionType: f.constructionType,
        areaSqFt: f.areaSqFt != null ? Number(f.areaSqFt.toString()) : null,
      })),
      coOwners: existing.coOwners.map((o) => ({
        id: o.id,
        name: o.name,
        fatherOrHusbandName: o.fatherOrHusbandName,
        mobile: o.mobile,
        alternateMobile: o.alternateMobile,
        ownerIndex: o.ownerIndex,
      })),
    }

    return this.prisma.db.$transaction(async (tx) => {
      if (Object.keys(scalarData).length > 0) {
        await tx.survey.update({ where: { id }, data: scalarData })
      }

      if (patch.floors !== undefined) {
        await this.syncFloors(tx, id, patch.floors)

        const floors = await tx.floor.findMany({ where: { surveyId: id } })
        const totalBuilt = floors.reduce((sum, f) => {
          const area = f.areaSqFt != null ? Number(f.areaSqFt.toString()) : 0
          return sum + (Number.isNaN(area) ? 0 : area)
        }, 0)
        await tx.survey.update({
          where: { id },
          data: { totalBuiltAreaSqFt: totalBuilt },
        })
      }

      if (coOwnersPatch !== undefined) {
        await this.syncCoOwners(tx, id, coOwnersPatch)
      }

      await tx.surveyAudit.create({
        data: {
          surveyId: id,
          action: "survey.qc_corrected",
          oldValue: oldValue,
          newValue: {
            propertyId: nextPropertyId,
            patch: scalarData,
            floors: patch.floors ?? null,
            coOwners: coOwnersPatch ?? null,
          } as Prisma.InputJsonValue,
          changedBy,
        },
      })

      return tx.survey.findFirstOrThrow({
        where: { id },
        include: {
          floors: { orderBy: { position: "asc" } },
          photos: { orderBy: { createdAt: "asc" } },
          coOwners: { orderBy: { ownerIndex: "asc" } },
          createdBy: { select: { id: true, fullName: true, email: true } },
          assignedTo: { select: { id: true, fullName: true, email: true } },
          ward: { select: { id: true, wardName: true, wardNumber: true } },
          ulb: { select: { id: true, name: true } },
          district: { select: { id: true, name: true } },
          state: { select: { id: true, name: true } },
        },
      })
    })
  }

  private async syncFloors(tx: Prisma.TransactionClient, surveyId: string, floors: QcFloorInputDto[]) {
    const keptIds: string[] = []
    let position = 0
    for (const floor of floors) {
      const id = await this.upsertFloor(tx, surveyId, floor, position)
      if (id) keptIds.push(id)
      position += 1
    }

    await tx.floor.deleteMany({
      where: {
        surveyId,
        ...(keptIds.length > 0 ? { id: { notIn: keptIds } } : {}),
      },
    })
  }

  private async syncCoOwners(tx: Prisma.TransactionClient, surveyId: string, coOwners: QcCoOwnerInputDto[]) {
    const keptIds: string[] = []
    let ownerIndex = 0
    for (const owner of coOwners) {
      const data = {
        name: owner.name,
        fatherOrHusbandName: owner.fatherOrHusbandName ?? null,
        mobile: owner.mobile ?? null,
        alternateMobile: owner.alternateMobile ?? null,
        ownerIndex,
      }

      if (owner.id) {
        const existing = await tx.coOwner.findFirst({ where: { id: owner.id, surveyId } })
        if (existing) {
          await tx.coOwner.update({ where: { id: owner.id }, data })
          keptIds.push(owner.id)
          ownerIndex += 1
          continue
        }
      }

      const created = await tx.coOwner.create({
        data: { surveyId, ...data },
      })
      keptIds.push(created.id)
      ownerIndex += 1
    }

    await tx.coOwner.deleteMany({
      where: {
        surveyId,
        ...(keptIds.length > 0 ? { id: { notIn: keptIds } } : {}),
      },
    })
  }

  private async upsertFloor(
    tx: Prisma.TransactionClient,
    surveyId: string,
    floor: QcFloorInputDto,
    position: number
  ): Promise<string | null> {
    const data = {
      usageType: floor.usageType ?? null,
      usageFactor: floor.usageFactor ?? null,
      constructionType: floor.constructionType ?? null,
      areaSqFt: floor.areaSqFt ?? null,
      position,
    }

    if (floor.id) {
      const existing = await tx.floor.findFirst({ where: { id: floor.id, surveyId } })
      if (existing) {
        await tx.floor.update({
          where: { id: floor.id },
          data: {
            floorPosition: floor.floorPosition,
            ...data,
          },
        })
        return floor.id
      }
    }

    const upserted = await tx.floor.upsert({
      where: {
        surveyId_floorPosition: {
          surveyId,
          floorPosition: floor.floorPosition,
        },
      },
      create: {
        surveyId,
        floorPosition: floor.floorPosition,
        ...data,
      },
      update: data,
    })
    return upserted.id
  }
}
