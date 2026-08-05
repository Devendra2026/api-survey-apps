import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { normalizeWardNumber } from "@workspace/validation"
import { PrismaService } from "../prisma/prisma.service.js"

export type WardDedupeResult = {
  mode: "dry-run" | "apply"
  ulbs: number
  duplicateGroups: number
  surveysRemapped: number
  wardsSoftDeleted: number
  samples: Array<{
    ulb: string
    norm: string
    primary: { id: string; wardNumber: string; surveys: number }
    dupes: Array<{ id: string; wardNumber: string; surveys: number }>
  }>
}

export type WardSyncResult = {
  mode: "dry-run" | "apply"
  catalogSize: number
  created: number
  updated: number
  skipped: number
  missingUlbs: string[]
  wardCountMismatches: Array<{ ulb: string; nest: number; convex: number }>
}

export type EmptyStateCleanupResult = {
  mode: "dry-run" | "apply"
  deleted: Array<{ id: string; code: string; name: string }>
  skipped: Array<{ id: string; code: string; name: string; reason: string }>
}

type ConvexWardCatalogRow = {
  wardNo?: string
  wardCode?: string
  wardName?: string
  municipalityCode?: string
}

@Injectable()
export class WardAlignService {
  private readonly logger = new Logger(WardAlignService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async dedupeWards(apply: boolean, ulbCode?: string): Promise<WardDedupeResult> {
    const ulbs = await this.prisma.db.ulb.findMany({
      where: ulbCode ? { code: ulbCode } : undefined,
      orderBy: { code: "asc" },
      select: { id: true, code: true },
    })

    let duplicateGroups = 0
    let surveysRemapped = 0
    let wardsSoftDeleted = 0
    const samples: WardDedupeResult["samples"] = []

    for (const ulb of ulbs) {
      const wards = await this.prisma.db.ward.findMany({
        where: { ulbId: ulb.id, deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          wardNumber: true,
          createdAt: true,
          _count: { select: { surveys: { where: { deletedAt: null } } } },
        },
      })

      const byNorm = new Map<string, typeof wards>()
      for (const w of wards) {
        const key = normalizeWardNumber(w.wardNumber)
        const list = byNorm.get(key) ?? []
        list.push(w)
        byNorm.set(key, list)
      }

      for (const [norm, group] of byNorm) {
        if (group.length < 2) continue
        duplicateGroups += 1

        const sorted = [...group].sort((a, b) => {
          const aCanon = a.wardNumber === norm ? 0 : 1
          const bCanon = b.wardNumber === norm ? 0 : 1
          if (aCanon !== bCanon) return aCanon - bCanon
          if (b._count.surveys !== a._count.surveys) return b._count.surveys - a._count.surveys
          return a.createdAt.getTime() - b.createdAt.getTime()
        })
        const primary = sorted[0]!
        const dupes = sorted.slice(1)

        if (samples.length < 20) {
          samples.push({
            ulb: ulb.code,
            norm,
            primary: { id: primary.id, wardNumber: primary.wardNumber, surveys: primary._count.surveys },
            dupes: dupes.map((d) => ({ id: d.id, wardNumber: d.wardNumber, surveys: d._count.surveys })),
          })
        }

        if (!apply) continue

        await this.prisma.db.$transaction(async (tx) => {
          for (const dupe of dupes) {
            const remapped = await tx.survey.updateMany({
              where: { wardId: dupe.id, deletedAt: null },
              data: { wardId: primary.id, wardNumber: primary.wardNumber },
            })
            surveysRemapped += remapped.count
            await tx.ward.update({
              where: { id: dupe.id },
              data: { deletedAt: new Date(), status: "DISABLED" },
            })
            wardsSoftDeleted += 1
          }
          if (primary.wardNumber !== norm) {
            await tx.ward.update({ where: { id: primary.id }, data: { wardNumber: norm } })
          }
        })
      }
    }

    return {
      mode: apply ? "apply" : "dry-run",
      ulbs: ulbs.length,
      duplicateGroups,
      surveysRemapped,
      wardsSoftDeleted,
      samples,
    }
  }

  async syncWardsFromConvex(apply: boolean): Promise<WardSyncResult> {
    const siteUrl = this.config.get<string>("CONVEX_SITE_URL")?.trim().replace(/\/+$/, "")
    const etlSecret = this.config.get<string>("ETL_CONVEX_SECRET")?.trim()
    if (!siteUrl || !etlSecret) {
      throw new ServiceUnavailableException("CONVEX_SITE_URL / ETL_CONVEX_SECRET not configured")
    }

    const res = await fetch(`${siteUrl}/etl/list-ward-catalog`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-ETL-Secret": etlSecret,
      },
      body: "{}",
    })
    if (!res.ok) {
      const body = await res.text()
      this.logger.error(`Convex list-ward-catalog failed: ${res.status} ${body}`)
      throw new BadRequestException(`Convex ward catalog failed (${res.status})`)
    }

    const payload = (await res.json()) as { wards?: ConvexWardCatalogRow[] }
    const catalog = payload.wards
    if (!Array.isArray(catalog)) {
      throw new BadRequestException("Unexpected Convex ward catalog response")
    }

    let created = 0
    let updated = 0
    let skipped = 0
    const missingUlbs = new Set<string>()

    for (const row of catalog) {
      const wardNumber = normalizeWardNumber(String(row.wardNo ?? ""))
      if (!wardNumber) {
        skipped += 1
        continue
      }
      const wardCode = String(row.wardCode || "")
        .trim()
        .toUpperCase()
      const wardName = String(row.wardName || `Ward ${wardNumber}`).trim()
      const ulbCode = String(row.municipalityCode || "").trim()

      const ulb = await this.prisma.db.ulb.findFirst({
        where: { code: ulbCode },
        select: { id: true },
      })
      if (!ulb) {
        missingUlbs.add(ulbCode)
        skipped += 1
        continue
      }

      const active = await this.prisma.db.ward.findMany({
        where: { ulbId: ulb.id, deletedAt: null },
        select: { id: true, wardNumber: true, wardCode: true, wardName: true },
      })
      const match =
        active.find((w) => (wardCode && w.wardCode === wardCode) || normalizeWardNumber(w.wardNumber) === wardNumber) ??
        null

      if (match) {
        const needsUpdate =
          match.wardNumber !== wardNumber || (wardCode && match.wardCode !== wardCode) || match.wardName !== wardName
        if (needsUpdate) {
          if (apply) {
            await this.prisma.db.ward.update({
              where: { id: match.id },
              data: {
                wardNumber,
                wardName,
                ...(wardCode ? { wardCode } : {}),
              },
            })
          }
          updated += 1
        } else {
          skipped += 1
        }
        continue
      }

      if (apply) {
        await this.prisma.db.ward.create({
          data: {
            ulbId: ulb.id,
            wardNumber,
            wardName,
            ...(wardCode ? { wardCode } : {}),
            status: "ACTIVE",
          },
        })
      }
      created += 1
    }

    const nestCounts = await this.prisma.db.ulb.findMany({
      select: {
        code: true,
        _count: { select: { wards: { where: { deletedAt: null } } } },
      },
      orderBy: { code: "asc" },
    })

    const convexByUlb = new Map<string, number>()
    for (const row of catalog) {
      const c = String(row.municipalityCode || "").trim()
      if (!c) continue
      convexByUlb.set(c, (convexByUlb.get(c) ?? 0) + 1)
    }

    const wardCountMismatches: WardSyncResult["wardCountMismatches"] = []
    for (const row of nestCounts) {
      const convexCount = convexByUlb.get(row.code) ?? 0
      if (convexCount !== row._count.wards) {
        wardCountMismatches.push({ ulb: row.code, nest: row._count.wards, convex: convexCount })
      }
    }

    return {
      mode: apply ? "apply" : "dry-run",
      catalogSize: catalog.length,
      created,
      updated,
      skipped,
      missingUlbs: [...missingUlbs],
      wardCountMismatches,
    }
  }

  /** Remove empty duplicate UP shells; never touches states that still have districts. */
  async cleanupEmptyDuplicateStates(apply: boolean): Promise<EmptyStateCleanupResult> {
    const codes = ["01", "UP", "UP-01"]
    const states = await this.prisma.db.state.findMany({
      where: { code: { in: codes } },
      select: {
        id: true,
        code: true,
        name: true,
        _count: { select: { districts: true, surveys: true } },
      },
    })

    const deleted: EmptyStateCleanupResult["deleted"] = []
    const skipped: EmptyStateCleanupResult["skipped"] = []

    for (const state of states) {
      if (state._count.districts > 0) {
        skipped.push({
          id: state.id,
          code: state.code,
          name: state.name,
          reason: `${state._count.districts} district(s)`,
        })
        continue
      }
      if (state._count.surveys > 0) {
        skipped.push({
          id: state.id,
          code: state.code,
          name: state.name,
          reason: `${state._count.surveys} survey(s)`,
        })
        continue
      }

      if (apply) {
        await this.prisma.db.userTenantRole.deleteMany({ where: { stateId: state.id } })
        await this.prisma.db.state.delete({ where: { id: state.id } })
      }
      deleted.push({ id: state.id, code: state.code, name: state.name })
    }

    return { mode: apply ? "apply" : "dry-run", deleted, skipped }
  }
}
