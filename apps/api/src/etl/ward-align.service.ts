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

export type AlignWardsPipelineResult = {
  mode: "dry-run" | "apply"
  ok: boolean
  steps: {
    dedupe: {
      duplicateGroups: number
      wardsSoftDeleted: number
      surveysRemapped: number
      samples: WardDedupeResult["samples"]
    }
    sync: {
      catalogSize: number
      created: number
      updated: number
      merged: number
      skipped: number
      missingUlbs: string[]
      conflicts: string[]
    }
    cleanup: {
      deleted: EmptyStateCleanupResult["deleted"]
      skipped: EmptyStateCleanupResult["skipped"]
    }
    verify: {
      matchedUlbCount: number
      catalogSize: number
      mismatchedUlbs: Array<{ ulb: string; nest: number; convex: number }>
    }
  }
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

function isPrismaRecordNotFound(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2025") {
    return true
  }
  if (error instanceof Error && /Record to (update|delete) not found/i.test(error.message)) {
    return true
  }
  return false
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
      // Sequential: concurrent merges in the same ULB can hit P2025 (record already soft-deleted)
      // which the old global filter mislabeled as "duplicate code or name".
      for (const op of mergeOps) {
        let remappedTotal = 0
        try {
          await this.prisma.db.$transaction(async (tx) => {
            for (const dupeId of op.dupeIds) {
              const remapped = await tx.survey.updateMany({
                where: { wardId: dupeId, deletedAt: null },
                data: { wardId: op.primaryId, wardNumber: op.norm },
              })
              remappedTotal += remapped.count
              await tx.ward.update({
                where: { id: dupeId },
                data: { deletedAt: new Date(), status: "DISABLED", wardCode: null },
              })
            }
            if (op.primaryNumber !== op.norm) {
              await tx.ward.update({ where: { id: op.primaryId }, data: { wardNumber: op.norm } })
            }
          })
        } catch (error) {
          if (isPrismaRecordNotFound(error) || isPrismaUniqueViolation(error)) {
            this.logger.warn(
              `dedupe merge skipped primary=${op.primaryId} norm=${op.norm}: ${
                error instanceof Error ? error.message.slice(0, 160) : String(error)
              }`
            )
            continue
          }
          throw error
        }
        op.remapped = remappedTotal
      }
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
        data: { deletedAt: new Date(), status: "DISABLED", wardCode: null },
      })
    })
  }

  /**
   * Apply one ward upsert safely: clear/merge collisions, never throw unique conflicts upward.
   */
  private async upsertWardSafe(args: {
    ulbId: string
    ulbCode: string
    wardNumber: string
    wardName: string
    wardCode: string
    matchId: string | null
  }): Promise<{ action: "updated" | "created" | "skipped" | "merged"; conflict?: string }> {
    const { ulbId, ulbCode, wardNumber, wardName, wardCode } = args
    let matchId = args.matchId

    const activeOthers = await this.prisma.db.ward.findMany({
      where: {
        ulbId,
        deletedAt: null,
        ...(matchId ? { id: { not: matchId } } : {}),
      },
      select: { id: true, wardNumber: true, wardCode: true },
    })

    // Prefer an existing row by normalized number or code when creating.
    if (!matchId) {
      const byCode = wardCode ? activeOthers.find((w) => w.wardCode === wardCode) : undefined
      const byNorm = activeOthers.find((w) => normalizeWardNumber(w.wardNumber) === wardNumber)
      matchId = byCode?.id ?? byNorm?.id ?? null
    }

    const normClashes = activeOthers.filter(
      (w) =>
        w.id !== matchId &&
        (normalizeWardNumber(w.wardNumber) === wardNumber || (wardCode !== "" && w.wardCode === wardCode))
    )

    if (matchId) {
      for (const clash of normClashes) {
        await this.mergeWardInto(matchId, clash.id, wardNumber)
      }

      if (wardCode) {
        await this.prisma.db.ward.updateMany({
          where: { ulbId, deletedAt: null, wardCode, id: { not: matchId } },
          data: { wardCode: null },
        })
      }

      try {
        await this.prisma.db.ward.update({
          where: { id: matchId },
          data: {
            wardNumber,
            wardName,
            ...(wardCode ? { wardCode } : {}),
            status: "ACTIVE",
            deletedAt: null,
          },
        })
        return { action: normClashes.length > 0 ? "merged" : "updated" }
      } catch (error) {
        if (!isPrismaUniqueViolation(error)) throw error
        const msg = `ULB ${ulbCode} ward ${wardNumber}${wardCode ? ` (${wardCode})` : ""}: unique conflict on update (skipped)`
        this.logger.warn(msg)
        return { action: "skipped", conflict: msg }
      }
    }

    try {
      await this.prisma.db.ward.create({
        data: {
          ulbId,
          wardNumber,
          wardName,
          ...(wardCode ? { wardCode } : {}),
          status: "ACTIVE",
        },
      })
      return { action: "created" }
    } catch (error) {
      if (!isPrismaUniqueViolation(error)) throw error

      const existing = await this.prisma.db.ward.findFirst({
        where: {
          ulbId,
          deletedAt: null,
          OR: [{ wardNumber }, ...(wardCode ? ([{ wardCode }] as const) : [])],
        },
        select: { id: true },
      })
      if (existing) {
        return this.upsertWardSafe({
          ulbId,
          ulbCode,
          wardNumber,
          wardName,
          wardCode,
          matchId: existing.id,
        })
      }

      const soft = await this.prisma.db.ward.findFirst({
        where: {
          ulbId,
          deletedAt: { not: null },
          OR: [{ wardNumber }, ...(wardCode ? ([{ wardCode }] as const) : [])],
        },
        orderBy: { deletedAt: "desc" },
        select: { id: true },
      })
      if (soft) {
        try {
          await this.prisma.db.ward.update({
            where: { id: soft.id },
            data: {
              wardNumber,
              wardName,
              ...(wardCode ? { wardCode } : {}),
              status: "ACTIVE",
              deletedAt: null,
            },
          })
          return { action: "updated" }
        } catch (reviveErr) {
          if (!isPrismaUniqueViolation(reviveErr)) throw reviveErr
        }
      }

      const msg = `ULB ${ulbCode} ward ${wardNumber}${wardCode ? ` (${wardCode})` : ""}: unique conflict on create (skipped)`
      this.logger.warn(msg)
      return { action: "skipped", conflict: msg }
    }
  }

  async syncWardsFromConvex(apply: boolean, opts?: { skipPreDedupe?: boolean }): Promise<WardSyncResult> {
    const siteUrl = this.config.get<string>("CONVEX_SITE_URL")?.trim().replace(/\/+$/, "")
    const etlSecret = this.config.get<string>("ETL_CONVEX_SECRET")?.trim()
    if (!siteUrl || !etlSecret) {
      throw new ServiceUnavailableException("CONVEX_SITE_URL / ETL_CONVEX_SECRET not configured")
    }

    if (apply && !opts?.skipPreDedupe) {
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
      // Sequential safe upserts — never abort the pipeline on unique conflicts.
      const seenFrom = new Set<string>()
      const mergedAway = new Map<string, string>() // fromId → intoId
      const uniqueMerges = merges.filter((m) => {
        if (seenFrom.has(m.fromId) || m.intoId === m.fromId) return false
        seenFrom.add(m.fromId)
        mergedAway.set(m.fromId, m.intoId)
        return true
      })
      for (const m of uniqueMerges) {
        try {
          await this.mergeWardInto(m.intoId, m.fromId, m.wardNumber)
        } catch (error) {
          if (isPrismaUniqueViolation(error) || isPrismaRecordNotFound(error)) {
            conflicts.push(
              `merge ${m.fromId}→${m.intoId}: ${isPrismaRecordNotFound(error) ? "missing" : "unique"} (continued)`
            )
            continue
          }
          throw error
        }
      }

      const resolveKeepId = (id: string): string => {
        let cur = id
        const guard = new Set<string>()
        while (mergedAway.has(cur) && !guard.has(cur)) {
          guard.add(cur)
          cur = mergedAway.get(cur)!
        }
        return cur
      }

      created = 0
      updated = 0
      merged = uniqueMerges.length
      skipped = 0

      for (const u of updates) {
        const result = await this.upsertWardSafe({
          ulbId: u.ulbId,
          ulbCode: u.ulbCode,
          wardNumber: u.wardNumber,
          wardName: u.wardName,
          wardCode: u.wardCode ?? "",
          matchId: resolveKeepId(u.id),
        })
        if (result.conflict) conflicts.push(result.conflict)
        if (result.action === "updated" || result.action === "merged") updated += 1
        else if (result.action === "created") created += 1
        else skipped += 1
      }

      const ulbCodeById = new Map(ulbs.map((u) => [u.id, u.code]))
      for (const c of creates) {
        const ulbCode = ulbCodeById.get(c.ulbId) ?? c.ulbId
        const result = await this.upsertWardSafe({
          ulbId: c.ulbId,
          ulbCode,
          wardNumber: c.wardNumber,
          wardName: c.wardName,
          wardCode: c.wardCode ?? "",
          matchId: null,
        })
        if (result.conflict) conflicts.push(result.conflict)
        if (result.action === "created") created += 1
        else if (result.action === "updated" || result.action === "merged") updated += 1
        else skipped += 1
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

  /**
   * After Align creates replacement wards / soft-deletes dupes, surveys may still
   * reference inactive ward IDs. Remap them onto the active ward with the same
   * normalized number in that ULB so Command Center / QC ward filters work.
   */
  async remapOrphanedSurveys(apply: boolean): Promise<{ surveyed: number; remapped: number; groups: number }> {
    const activeWards = await this.prisma.db.ward.findMany({
      where: { deletedAt: null, status: "ACTIVE" },
      select: { id: true, ulbId: true, wardNumber: true },
    })
    const activeByUlbNorm = new Map<string, string>()
    for (const w of activeWards) {
      const norm = normalizeWardNumber(w.wardNumber)
      if (!norm) continue
      const key = `${w.ulbId}:${norm}`
      if (!activeByUlbNorm.has(key)) activeByUlbNorm.set(key, w.id)
    }

    const inactiveWards = await this.prisma.db.ward.findMany({
      where: { OR: [{ deletedAt: { not: null } }, { status: "DISABLED" }] },
      select: { id: true, ulbId: true, wardNumber: true },
    })

    type RemapOp = { fromId: string; intoId: string; wardNumber: string }
    const ops: RemapOp[] = []
    for (const w of inactiveWards) {
      const norm = normalizeWardNumber(w.wardNumber)
      if (!norm) continue
      const intoId = activeByUlbNorm.get(`${w.ulbId}:${norm}`)
      if (!intoId || intoId === w.id) continue
      ops.push({ fromId: w.id, intoId, wardNumber: norm })
    }

    let remapped = 0
    let surveyed = 0
    if (!apply) {
      for (const op of ops) {
        const count = await this.prisma.db.survey.count({
          where: { wardId: op.fromId, deletedAt: null },
        })
        surveyed += count
      }
      return { surveyed, remapped: 0, groups: ops.length }
    }

    for (const op of ops) {
      const result = await this.prisma.db.survey.updateMany({
        where: { wardId: op.fromId, deletedAt: null },
        data: { wardId: op.intoId, wardNumber: op.wardNumber },
      })
      remapped += result.count
      surveyed += result.count
    }

    if (remapped > 0) {
      this.logger.log(`remapOrphanedSurveys: remapped=${remapped} from ${ops.length} inactive ward(s)`)
    }
    return { surveyed, remapped, groups: ops.length }
  }

  /**
   * One-shot pipeline: dedupe → sync (no double-dedupe) → orphan remap → cleanup empty UP shells → verify counts.
   * Dry-run when apply=false; writes when apply=true.
   */
  async alignWardsWithConvex(apply: boolean): Promise<AlignWardsPipelineResult> {
    const mode = apply ? "apply" : "dry-run"
    this.logger.log(`alignWardsWithConvex start mode=${mode}`)

    try {
      const dedupe = await this.dedupeWards(apply)
      const sync = await this.syncWardsFromConvex(apply, { skipPreDedupe: true })
      const orphans = await this.remapOrphanedSurveys(apply)
      const cleanup = await this.cleanupEmptyDuplicateStates(apply)

      const mismatchedUlbs = sync.wardCountMismatches
      const nestUlbCount = await this.prisma.db.ulb.count()
      const matchedUlbCount = Math.max(0, nestUlbCount - mismatchedUlbs.length)

      const ok = mismatchedUlbs.length === 0 && sync.conflicts.length === 0 && sync.missingUlbs.length === 0

      this.logger.log(
        `alignWardsWithConvex done mode=${mode} ok=${ok} mismatches=${mismatchedUlbs.length} conflicts=${sync.conflicts.length} orphanRemapped=${orphans.remapped}`
      )

      return {
        mode,
        ok,
        steps: {
          dedupe: {
            duplicateGroups: dedupe.duplicateGroups,
            wardsSoftDeleted: dedupe.wardsSoftDeleted,
            surveysRemapped: dedupe.surveysRemapped + orphans.remapped,
            samples: dedupe.samples,
          },
          sync: {
            catalogSize: sync.catalogSize,
            created: sync.created,
            updated: sync.updated,
            merged: sync.merged,
            skipped: sync.skipped,
            missingUlbs: sync.missingUlbs,
            conflicts: sync.conflicts,
          },
          cleanup: {
            deleted: cleanup.deleted,
            skipped: cleanup.skipped,
          },
          verify: {
            matchedUlbCount,
            catalogSize: sync.catalogSize,
            mismatchedUlbs,
          },
        },
      }
    } catch (error) {
      // Never surface raw Prisma / unique toasts for this pipeline — return structured failure.
      const detail = error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240)
      this.logger.warn(`alignWardsWithConvex failed mode=${mode} unique=${isPrismaUniqueViolation(error)}: ${detail}`)
      return {
        mode,
        ok: false,
        steps: {
          dedupe: { duplicateGroups: 0, wardsSoftDeleted: 0, surveysRemapped: 0, samples: [] },
          sync: {
            catalogSize: 0,
            created: 0,
            updated: 0,
            merged: 0,
            skipped: 0,
            missingUlbs: [],
            conflicts: [
              isPrismaUniqueViolation(error)
                ? "A duplicate ward number/code was found mid-run. Retry Align once — conflicts are merged automatically."
                : `Align aborted: ${detail}`,
            ],
          },
          cleanup: { deleted: [], skipped: [] },
          verify: { matchedUlbCount: 0, catalogSize: 0, mismatchedUlbs: [] },
        },
      }
    }
  }
}
