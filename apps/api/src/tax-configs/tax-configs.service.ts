import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import { ConfigAuditService } from "../config-audit/config-audit.service.js"
import { PrismaService } from "../prisma/prisma.service.js"
import type {
  BulkApplyTaxConfigDto,
  PublishTaxConfigDto,
  RollbackTaxConfigDto,
  TaxPreviewDto,
  UpdateTaxConfigParamsDto,
  UpsertTaxCellDto,
} from "./dto/tax-config.dto.js"

function toNumber(value: { toString(): string } | number | string): number {
  return typeof value === "number" ? value : Number(value)
}

@Injectable()
export class TaxConfigsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: ConfigAuditService
  ) {}

  private include = {
    cells: {
      include: {
        roadWidthEntry: true,
        constructionEntry: true,
      },
    },
    assessmentYear: true,
    ward: {
      include: {
        ulb: {
          include: {
            district: { include: { state: true } },
          },
        },
      },
    },
  } as const

  async getOrCreate(wardId: string, assessmentYearId: string, actorId?: string) {
    const existing = await this.prisma.db.taxConfig.findUnique({
      where: { wardId_assessmentYearId: { wardId, assessmentYearId } },
      include: this.include,
    })
    if (existing) return existing

    const ward = await this.prisma.db.ward.findUnique({ where: { id: wardId } })
    if (!ward) throw new NotFoundException("Ward not found")

    const ay = await this.prisma.db.referenceEntry.findUnique({ where: { id: assessmentYearId } })
    if (!ay) throw new NotFoundException("Assessment year not found")

    const created = await this.prisma.db.taxConfig.create({
      data: {
        wardId,
        assessmentYearId,
        status: "DRAFT",
      },
      include: this.include,
    })

    await this.ensureMatrixCells(created.id)

    const full = await this.prisma.db.taxConfig.findUniqueOrThrow({
      where: { id: created.id },
      include: this.include,
    })

    await this.audit.log({
      entityType: "TaxConfig",
      entityId: full.id,
      action: "CREATE",
      newValue: { wardId, assessmentYearId },
      actorId,
    })

    return full
  }

  private async ensureMatrixCells(taxConfigId: string) {
    const [roads, constructions] = await Promise.all([
      this.prisma.db.referenceEntry.findMany({
        where: { category: { code: "TAX_RATE_ZONE" }, status: "ACTIVE" },
        orderBy: { sortOrder: "asc" },
      }),
      this.prisma.db.referenceEntry.findMany({
        where: { category: { code: "CONSTRUCTION_TYPE" }, status: "ACTIVE" },
        orderBy: { sortOrder: "asc" },
      }),
    ])

    for (const road of roads) {
      for (const construction of constructions) {
        await this.prisma.db.taxRateCell.upsert({
          where: {
            taxConfigId_roadWidthEntryId_constructionEntryId: {
              taxConfigId,
              roadWidthEntryId: road.id,
              constructionEntryId: construction.id,
            },
          },
          create: {
            taxConfigId,
            roadWidthEntryId: road.id,
            constructionEntryId: construction.id,
            annualRatePerSqFt: 0,
          },
          update: {},
        })
      }
    }
  }

  async updateParams(id: string, dto: UpdateTaxConfigParamsDto, actorId?: string) {
    const existing = await this.prisma.db.taxConfig.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException("Tax config not found")
    if (existing.status === "ARCHIVED") {
      throw new BadRequestException("Cannot edit archived tax config")
    }

    const updated = await this.prisma.db.taxConfig.update({
      where: { id },
      data: {
        propertyTaxPct: dto.propertyTaxPct,
        waterTaxPct: dto.waterTaxPct,
        drainageTaxPct: dto.drainageTaxPct,
        penaltyPct: dto.penaltyPct,
        assessablePct: dto.assessablePct,
        status: "DRAFT",
      },
      include: this.include,
    })

    await this.audit.log({
      entityType: "TaxConfig",
      entityId: id,
      action: "UPDATE_PARAMS",
      oldValue: existing,
      newValue: updated,
      reason: dto.reason,
      actorId,
    })

    return updated
  }

  async upsertCells(id: string, cells: UpsertTaxCellDto[], actorId?: string) {
    const existing = await this.prisma.db.taxConfig.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException("Tax config not found")

    for (const cell of cells) {
      await this.prisma.db.taxRateCell.upsert({
        where: {
          taxConfigId_roadWidthEntryId_constructionEntryId: {
            taxConfigId: id,
            roadWidthEntryId: cell.roadWidthEntryId,
            constructionEntryId: cell.constructionEntryId,
          },
        },
        create: {
          taxConfigId: id,
          roadWidthEntryId: cell.roadWidthEntryId,
          constructionEntryId: cell.constructionEntryId,
          annualRatePerSqFt: cell.annualRatePerSqFt,
        },
        update: {
          annualRatePerSqFt: cell.annualRatePerSqFt,
        },
      })
    }

    await this.prisma.db.taxConfig.update({
      where: { id },
      data: { status: "DRAFT" },
    })

    await this.audit.log({
      entityType: "TaxConfig",
      entityId: id,
      action: "UPSERT_CELLS",
      newValue: { cells },
      actorId,
    })

    return this.prisma.db.taxConfig.findUniqueOrThrow({
      where: { id },
      include: this.include,
    })
  }

  private async listActiveUlbWards(ulbId: string) {
    const ulb = await this.prisma.db.ulb.findUnique({ where: { id: ulbId } })
    if (!ulb) throw new NotFoundException("ULB not found")

    return this.prisma.db.ward.findMany({
      where: { ulbId, deletedAt: null, status: "ACTIVE" },
      orderBy: { wardNumber: "asc" },
      select: { id: true },
    })
  }

  /**
   * Apply rate cells to every ward in a ULB in one request (avoids client-side N×GET/PUT storms / 429).
   * - copy: apply `cells` to all wards except `sourceWardId`
   * - zero: reset all wards' matrices to 0
   */
  async bulkApply(dto: BulkApplyTaxConfigDto, actorId?: string): Promise<{ updated: number }> {
    const wards = await this.listActiveUlbWards(dto.ulbId)
    if (wards.length === 0) return { updated: 0 }

    if (dto.mode === "copy") {
      if (!dto.sourceWardId) throw new BadRequestException("sourceWardId is required for copy mode")
      if (!dto.cells?.length) throw new BadRequestException("cells are required for copy mode")

      const targets = wards.filter((w) => w.id !== dto.sourceWardId)
      for (const ward of targets) {
        const config = await this.getOrCreate(ward.id, dto.assessmentYearId, actorId)
        await this.upsertCells(config.id, dto.cells, actorId)
      }
      return { updated: targets.length }
    }

    let updated = 0
    for (const ward of wards) {
      const config = await this.getOrCreate(ward.id, dto.assessmentYearId, actorId)
      const zeroCells: UpsertTaxCellDto[] = config.cells.map((c) => ({
        roadWidthEntryId: c.roadWidthEntryId,
        constructionEntryId: c.constructionEntryId,
        annualRatePerSqFt: 0,
      }))
      await this.upsertCells(config.id, zeroCells, actorId)
      updated += 1
    }
    return { updated }
  }

  /** First ward config in the ULB (excluding one ward) that already has any positive rate cell. */
  async firstWithRates(ulbId: string, assessmentYearId: string, excludeWardId?: string) {
    const wards = await this.listActiveUlbWards(ulbId)
    for (const ward of wards) {
      if (excludeWardId && ward.id === excludeWardId) continue
      const config = await this.prisma.db.taxConfig.findUnique({
        where: { wardId_assessmentYearId: { wardId: ward.id, assessmentYearId } },
        include: this.include,
      })
      if (!config) continue
      const hasRates = config.cells.some((c) => toNumber(c.annualRatePerSqFt) > 0)
      if (hasRates) return config
    }
    return null
  }

  async preview(dto: TaxPreviewDto) {
    const config = await this.getOrCreate(dto.wardId, dto.assessmentYearId)
    const cell = config.cells.find(
      (c) => c.roadWidthEntryId === dto.roadWidthEntryId && c.constructionEntryId === dto.constructionEntryId
    )
    const annualRate = cell ? toNumber(cell.annualRatePerSqFt) : 0
    const assessablePct = toNumber(config.assessablePct) / 100
    const propertyTaxPct = toNumber(config.propertyTaxPct) / 100
    const waterTaxPct = toNumber(config.waterTaxPct) / 100
    const drainageTaxPct = toNumber(config.drainageTaxPct) / 100
    const penaltyPct = toNumber(config.penaltyPct) / 100

    const grossAlv = dto.areaSqFt * annualRate
    const assessableAlv = grossAlv * assessablePct
    const propertyTax = assessableAlv * propertyTaxPct
    const waterTax = assessableAlv * waterTaxPct
    const drainageTax = assessableAlv * drainageTaxPct
    const penalty = propertyTax * penaltyPct
    const demand = propertyTax + waterTax + drainageTax + penalty

    return {
      inputs: dto,
      rates: {
        annualRate,
        assessablePct: toNumber(config.assessablePct),
        propertyTaxPct: toNumber(config.propertyTaxPct),
        waterTaxPct: toNumber(config.waterTaxPct),
        drainageTaxPct: toNumber(config.drainageTaxPct),
        penaltyPct: toNumber(config.penaltyPct),
      },
      calculation: {
        grossAlv,
        assessableAlv,
        propertyTax,
        waterTax,
        drainageTax,
        penalty,
        demand,
      },
      formulas: [
        "Gross ALV = Area × Annual Rate",
        "Assessable ALV = Gross ALV × Assessable %",
        "Property Tax = Assessable ALV × Property Tax %",
        "Water Tax = Assessable ALV × Water Tax %",
        "Drainage Tax = Assessable ALV × Drainage Tax %",
        "Penalty = Property Tax × Penalty %",
        "Demand = Property + Water + Drainage + Penalty",
      ],
    }
  }

  async listVersions(taxConfigId: string) {
    return this.prisma.db.taxConfigVersion.findMany({
      where: { taxConfigId },
      orderBy: { version: "desc" },
    })
  }

  async publish(id: string, dto: PublishTaxConfigDto, actorId?: string) {
    const config = await this.prisma.db.taxConfig.findUnique({
      where: { id },
      include: this.include,
    })
    if (!config) throw new NotFoundException("Tax config not found")

    const nextVersion = config.version + (config.status === "PUBLISHED" ? 1 : 0)
    const snapshot = {
      params: {
        propertyTaxPct: toNumber(config.propertyTaxPct),
        waterTaxPct: toNumber(config.waterTaxPct),
        drainageTaxPct: toNumber(config.drainageTaxPct),
        penaltyPct: toNumber(config.penaltyPct),
        assessablePct: toNumber(config.assessablePct),
      },
      cells: config.cells.map((c) => ({
        roadWidthEntryId: c.roadWidthEntryId,
        constructionEntryId: c.constructionEntryId,
        annualRatePerSqFt: toNumber(c.annualRatePerSqFt),
      })),
    }

    const versionRow = await this.prisma.db.taxConfigVersion.create({
      data: {
        taxConfigId: id,
        version: nextVersion || config.version,
        snapshot,
        reason: dto.reason,
        createdBy: actorId,
      },
    })

    const published = await this.prisma.db.taxConfig.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        version: versionRow.version,
        publishedAt: new Date(),
        publishedBy: actorId,
        changeReason: dto.reason,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : undefined,
      },
      include: this.include,
    })

    await this.audit.log({
      entityType: "TaxConfig",
      entityId: id,
      action: "PUBLISH",
      newValue: { version: versionRow.version },
      reason: dto.reason,
      actorId,
    })

    return published
  }

  async rollback(id: string, dto: RollbackTaxConfigDto, actorId?: string) {
    const version = await this.prisma.db.taxConfigVersion.findUnique({
      where: { id: dto.versionId },
    })
    if (!version || version.taxConfigId !== id) {
      throw new NotFoundException("Version not found")
    }

    const snapshot = version.snapshot as {
      params: {
        propertyTaxPct: number
        waterTaxPct: number
        drainageTaxPct: number
        penaltyPct: number
        assessablePct: number
      }
      cells: Array<{
        roadWidthEntryId: string
        constructionEntryId: string
        annualRatePerSqFt: number
      }>
    }

    await this.prisma.db.taxConfig.update({
      where: { id },
      data: {
        status: "DRAFT",
        propertyTaxPct: snapshot.params.propertyTaxPct,
        waterTaxPct: snapshot.params.waterTaxPct,
        drainageTaxPct: snapshot.params.drainageTaxPct,
        penaltyPct: snapshot.params.penaltyPct,
        assessablePct: snapshot.params.assessablePct,
        changeReason: dto.reason ?? `Rollback to v${version.version}`,
      },
    })

    for (const cell of snapshot.cells) {
      await this.prisma.db.taxRateCell.upsert({
        where: {
          taxConfigId_roadWidthEntryId_constructionEntryId: {
            taxConfigId: id,
            roadWidthEntryId: cell.roadWidthEntryId,
            constructionEntryId: cell.constructionEntryId,
          },
        },
        create: {
          taxConfigId: id,
          roadWidthEntryId: cell.roadWidthEntryId,
          constructionEntryId: cell.constructionEntryId,
          annualRatePerSqFt: cell.annualRatePerSqFt,
        },
        update: { annualRatePerSqFt: cell.annualRatePerSqFt },
      })
    }

    await this.audit.log({
      entityType: "TaxConfig",
      entityId: id,
      action: "ROLLBACK",
      newValue: { versionId: version.id, version: version.version },
      reason: dto.reason,
      actorId,
    })

    return this.prisma.db.taxConfig.findUniqueOrThrow({
      where: { id },
      include: this.include,
    })
  }
}
