import { BadRequestException, ConflictException, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common"
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
  merged: number
  skipped: number
  missingUlbs: string[]
  wardCountMismatches: Array<{ ulb: string; nest: number; convex: number }>
  conflicts: string[]
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

type ActiveWard = {
  id: string
  ulbId: string
  wardNumber: string
  wardCode: string | null
  wardName: string
}

function isPrismaUniqueViolation(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002") {
    return true
  }
  if (error instanceof Error && /Unique constraint failed/i.test(error.message)) {
    return true
  }
  return false
}

async function mapPool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
  if (items.length === 0) return
  const n = Math.max(1, concurrency)
  let i = 0
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const idx = i
      i += 1
      await fn(items[idx]!)
    }
  })
  await Promise.all(workers)
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
    const ulbById = new Map(ulbs.map((u) => [u.id, u.code]))

    // One query for all active wards (was N queries per ULB).
    const wards = await this.prisma.db.ward.findMany({
      where: {
        deletedAt: null,
        ...(ulbCode ? { ulbId: { in: ulbs.map((u) => u.id) } } : {}),
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        ulbId: true,
        wardNumber: true,
        createdAt: true,
        _count: { select: { surveys: { where: { deletedAt: null } } } },
      },
    })

    const byUlb = new Map<string, typeof wards>()
    for (const w of wards) {
      const list = byUlb.get(w.ulbId) ?? []
      list.push(w)
      byUlb.set(w.ulbId, list)
    }

    let duplicateGroups = 0
    let surveysRemapped = 0
    let wardsSoftDeleted = 0
    const samples: WardDedupeResult["samples"] = []

    type MergeOp = {
      primaryId: string
      primaryNumber: string
      norm: string
      dupeIds: string[]
      remapped: number
    }
    const mergeOps: MergeOp[] = []

    for (const ulb of ulbs) {
      const ulbWards = byUlb.get(ulb.id) ?? []
      const byNorm = new Map<string, typeof ulbWards>()
      for (const w of ulbWards) {
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
            ulb: ulbById.get(ulb.id) ?? ulb.code,
            norm,
            primary: { id: primary.id, wardNumber: primary.wardNumber, surveys: primary._count.surveys },
            dupes: dupes.map((d) => ({ id: d.id, wardNumber: d.wardNumber, surveys: d._count.surveys })),
          })
        }

        mergeOps.push({
          primaryId: primary.id,
          primaryNumber: primary.wardNumber === norm ? primary.wardNumber : norm,
          norm,
          dupeIds: dupes.map((d) => d.id),
          remapped: 0,
        })
      }
    }

    if (apply && mergeOps.length > 0) {
      await mapPool(mergeOps, 8, async (op) => {
        let remappedTotal = 0
        await this.prisma.db.$transaction(async (tx) => {
          for (const dupeId of op.dupeIds) {
            const remapped = await tx.survey.updateMany({
              where: { wardId: dupeId, deletedAt: null },
              data: { wardId: op.primaryId, wardNumber: op.norm },
            })
            remappedTotal += remapped.count
            await tx.ward.update({
              where: { id: dupeId },
              data: { deletedAt: new Date(), status: "DISABLED" },
            })
          }
          if (op.primaryNumber !== op.norm) {
            await tx.ward.update({ where: { id: op.primaryId }, data: { wardNumber: op.norm } })
          }
        })
        op.remapped = remappedTotal
      })
      for (const op of mergeOps) {
        wardsSoftDeleted += op.dupeIds.length
        surveysRemapped += op.remapped
      }
    } else if (!apply) {
      for (const op of mergeOps) {
        wardsSoftDeleted += op.dupeIds.length
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

  private async mergeWardInto(intoId: string, fromId: string, canonicalNumber: string): Promise<void> {
    if (intoId === fromId) return
    await this.prisma.db.$transaction(async (tx) => {
      await tx.survey.updateMany({
        where: { wardId: fromId, deletedAt: null },
        data: { wardId: intoId, wardNumber: canonicalNumber },
      })
      await tx.ward.update({
        where: { id: fromId },
        data: { deletedAt: new Date(), status: "DISABLED" },
      })
    })
  }

  async syncWardsFromConvex(apply: boolean): Promise<WardSyncResult> {
    const siteUrl = this.config.get<string>("CONVEX_SITE_URL")?.trim().replace(/\/+$/, "")
    const etlSecret = this.config.get<string>("ETL_CONVEX_SECRET")?.trim()
    if (!siteUrl || !etlSecret) {
      throw new ServiceUnavailableException("CONVEX_SITE_URL / ETL_CONVEX_SECRET not configured")
    }

    if (apply) {
      const dedupe = await this.dedupeWards(true)
      this.logger.log(
        `Pre-sync dedupe: groups=${dedupe.duplicateGroups} softDeleted=${dedupe.wardsSoftDeleted} remapped=${dedupe.surveysRemapped}`
      )
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

    // Batch load: all ULBs + all active wards once (was 2 queries × catalog size).
    const [ulbs, allWards] = await Promise.all([
      this.prisma.db.ulb.findMany({ select: { id: true, code: true } }),
      this.prisma.db.ward.findMany({
        where: { deletedAt: null },
        select: { id: true, ulbId: true, wardNumber: true, wardCode: true, wardName: true },
      }),
    ])

    const ulbByCode = new Map(ulbs.map((u) => [u.code, u.id]))
    const wardsByUlb = new Map<string, ActiveWard[]>()
    for (const w of allWards) {
      const list = wardsByUlb.get(w.ulbId) ?? []
      list.push(w)
      wardsByUlb.set(w.ulbId, list)
    }

    let created = 0
    let updated = 0
    let merged = 0
    let skipped = 0
    const missingUlbs = new Set<string>()
    const conflicts: string[] = []

    type CreateOp = {
      ulbId: string
      wardNumber: string
      wardName: string
      wardCode?: string
    }
    type UpdateOp = {
      id: string
      ulbId: string
      wardNumber: string
      wardName: string
      wardCode?: string
      ulbCode: string
    }
    type MergePlan = { intoId: string; fromId: string; wardNumber: string; ulbId: string }

    const creates: CreateOp[] = []
    const updates: UpdateOp[] = []
    const merges: MergePlan[] = []

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
      const ulbId = ulbByCode.get(ulbCode)
      if (!ulbId) {
        missingUlbs.add(ulbCode)
        skipped += 1
        continue
      }

      const active = wardsByUlb.get(ulbId) ?? []
      const byCode = wardCode ? (active.find((w) => w.wardCode === wardCode) ?? null) : null
      const byNumber = active.find((w) => normalizeWardNumber(w.wardNumber) === wardNumber) ?? null

      if (byCode && byNumber && byCode.id !== byNumber.id) {
        merges.push({ intoId: byCode.id, fromId: byNumber.id, wardNumber, ulbId })
        const idx = active.findIndex((w) => w.id === byNumber.id)
        if (idx >= 0) active.splice(idx, 1)
        merged += 1
      }

      const match =
        (wardCode ? active.find((w) => w.wardCode === wardCode) : null) ??
        active.find((w) => normalizeWardNumber(w.wardNumber) === wardNumber) ??
        null

      if (match) {
        const numberClash = active.find((w) => w.id !== match.id && normalizeWardNumber(w.wardNumber) === wardNumber)
        const codeClash = wardCode !== "" ? active.find((w) => w.id !== match.id && w.wardCode === wardCode) : null
        if (numberClash || codeClash) {
          const drop = numberClash ?? codeClash!
          merges.push({ intoId: match.id, fromId: drop.id, wardNumber, ulbId })
          const idx = active.findIndex((w) => w.id === drop.id)
          if (idx >= 0) active.splice(idx, 1)
          merged += 1
        }

        const needsUpdate =
          match.wardNumber !== wardNumber ||
          (wardCode !== "" && match.wardCode !== wardCode) ||
          match.wardName !== wardName

        if (!needsUpdate) {
          skipped += 1
          continue
        }

        updates.push({
          id: match.id,
          ulbId,
          wardNumber,
          wardName,
          ...(wardCode ? { wardCode } : {}),
          ulbCode,
        })
        // Keep in-memory view consistent for later catalog rows in same ULB.
        match.wardNumber = wardNumber
        match.wardName = wardName
        if (wardCode) match.wardCode = wardCode
        updated += 1
        continue
      }

      creates.push({
        ulbId,
        wardNumber,
        wardName,
        ...(wardCode ? { wardCode } : {}),
      })
      // Placeholder so later rows in same ULB don't try to create again.
      active.push({
        id: `pending:${ulbId}:${wardNumber}`,
        ulbId,
        wardNumber,
        wardCode: wardCode || null,
        wardName,
      })
      wardsByUlb.set(ulbId, active)
      created += 1
    }

    if (apply) {
      // Deduplicate merge plans (same fromId only once).
      const seenFrom = new Set<string>()
      const uniqueMerges = merges.filter((m) => {
        if (seenFrom.has(m.fromId) || m.intoId === m.fromId) return false
        seenFrom.add(m.fromId)
        return true
      })

      await mapPool(uniqueMerges, 8, async (m) => {
        await this.mergeWardInto(m.intoId, m.fromId, m.wardNumber)
      })

      // Clear colliding wardCodes in one pass per update target (dedupe by ulb+code).
      const clearKeys = new Map<string, { ulbId: string; wardCode: string; keepId: string }>()
      for (const u of updates) {
        if (!u.wardCode) continue
        clearKeys.set(`${u.ulbId}:${u.wardCode}`, { ulbId: u.ulbId, wardCode: u.wardCode, keepId: u.id })
      }
      await mapPool([...clearKeys.values()], 16, async (c) => {
        await this.prisma.db.ward.updateMany({
          where: {
            ulbId: c.ulbId,
            deletedAt: null,
            wardCode: c.wardCode,
            id: { not: c.keepId },
          },
          data: { wardCode: null },
        })
      })

      await mapPool(updates, 24, async (u) => {
        try {
          await this.prisma.db.ward.update({
            where: { id: u.id },
            data: {
              wardNumber: u.wardNumber,
              wardName: u.wardName,
              ...(u.wardCode ? { wardCode: u.wardCode } : {}),
            },
          })
        } catch (error) {
          if (isPrismaUniqueViolation(error)) {
            const msg = `ULB ${u.ulbCode} ward ${u.wardNumber}${u.wardCode ? ` (${u.wardCode})` : ""}: unique conflict on update`
            this.logger.warn(msg)
            conflicts.push(msg)
            throw new ConflictException(
              `Ward sync blocked on ULB ${u.ulbCode}: duplicate ward number/code for ${u.wardNumber}. Run Dedupe Wards (apply) first, then retry Sync.`
            )
          }
          throw error
        }
      })

      // Batch creates (much faster than one insert per ward).
      const CHUNK = 100
      for (let i = 0; i < creates.length; i += CHUNK) {
        const chunk = creates.slice(i, i + CHUNK)
        try {
          await this.prisma.db.ward.createMany({
            data: chunk.map((c) => ({
              ulbId: c.ulbId,
              wardNumber: c.wardNumber,
              wardName: c.wardName,
              ...(c.wardCode ? { wardCode: c.wardCode } : {}),
              status: "ACTIVE" as const,
            })),
            skipDuplicates: true,
          })
        } catch (error) {
          if (isPrismaUniqueViolation(error)) {
            // Fallback: create one-by-one so one bad row doesn't abort the chunk.
            for (const c of chunk) {
              try {
                await this.prisma.db.ward.create({
                  data: {
                    ulbId: c.ulbId,
                    wardNumber: c.wardNumber,
                    wardName: c.wardName,
                    ...(c.wardCode ? { wardCode: c.wardCode } : {}),
                    status: "ACTIVE",
                  },
                })
              } catch (rowErr) {
                if (isPrismaUniqueViolation(rowErr)) {
                  conflicts.push(`ULB ${c.ulbId} ward ${c.wardNumber}: unique conflict on create (skipped)`)
                  skipped += 1
                  created = Math.max(0, created - 1)
                  continue
                }
                throw rowErr
              }
            }
          } else {
            throw error
          }
        }
      }
    }

    // Recount from DB after writes (or from memory for dry-run).
    const nestCounts = apply
      ? await this.prisma.db.ulb.findMany({
          select: {
            code: true,
            _count: { select: { wards: { where: { deletedAt: null } } } },
          },
          orderBy: { code: "asc" },
        })
      : ulbs.map((u) => ({
          code: u.code,
          _count: { wards: (wardsByUlb.get(u.id) ?? []).filter((w) => !w.id.startsWith("pending:")).length },
        }))

    // For dry-run nest counts include planned creates already pushed as pending — recount properly:
    if (!apply) {
      for (const u of nestCounts as Array<{ code: string; _count: { wards: number } }>) {
        const ulbId = ulbByCode.get(u.code)
        if (!ulbId) continue
        const list = wardsByUlb.get(ulbId) ?? []
        u._count.wards = list.length
      }
    }

    const convexByUlb = new Map<string, number>()
    for (const row of catalog) {
      const c = String(row.municipalityCode || "").trim()
      if (!c) continue
      convexByUlb.set(c, (convexByUlb.get(c) ?? 0) + 1)
    }

    const wardCountMismatches: WardSyncResult["wardCountMismatches"] = []
    for (const row of nestCounts) {
      const convexCount = convexByUlb.get(row.code) ?? 0
      const nest = row._count.wards
      if (convexCount !== nest) {
        wardCountMismatches.push({ ulb: row.code, nest, convex: convexCount })
      }
    }

    return {
      mode: apply ? "apply" : "dry-run",
      catalogSize: catalog.length,
      created,
      updated,
      merged,
      skipped,
      missingUlbs: [...missingUlbs],
      wardCountMismatches,
      conflicts,
    }
  }

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
