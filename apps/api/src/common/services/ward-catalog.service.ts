import { Injectable } from "@nestjs/common"
import { sortWardsByNumberAsc } from "@workspace/validation"
import { PrismaService } from "../../prisma/prisma.service.js"
import type { AuthenticatedUser } from "../interfaces/authenticated-user.interface.js"
import { resolveTenantScope } from "../utils/tenant-scope.util.js"

export type ScopedWard = {
  id: string
  wardName: string
  wardNumber: string
}

@Injectable()
export class WardCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Active (non-soft-deleted) wards of a ULB, narrowed to the user's tenant scope.
   * Returns an empty list when the ULB is unknown or outside the user's scope.
   *
   * Both Command Centers list wards from this catalog rather than from survey rows,
   * so wards with no surveys yet still render (with zeroed metrics).
   * Order is numeric ascending (`2` before `10`), not string lexicographic.
   */
  async listScopedWards(user: AuthenticatedUser, ulbId: string): Promise<ScopedWard[]> {
    const [catalog, ulb] = await Promise.all([
      this.prisma.db.ward.findMany({
        where: { ulbId, status: "ACTIVE", deletedAt: null },
        select: { id: true, wardName: true, wardNumber: true },
      }),
      this.prisma.db.ulb.findUnique({
        where: { id: ulbId },
        select: { districtId: true, district: { select: { stateId: true } } },
      }),
    ])

    if (!ulb || catalog.length === 0) return []

    const scope = resolveTenantScope(user.tenantRoles)
    let scoped: ScopedWard[]
    if (scope.isGlobal) {
      scoped = catalog
    } else if (scope.wardIds.length) {
      const ownWards = catalog.filter((ward) => scope.wardIds.includes(ward.id))
      scoped = ownWards.length
        ? ownWards
        : scope.ulbIds.includes(ulbId) ||
            scope.districtIds.includes(ulb.districtId) ||
            scope.stateIds.includes(ulb.district.stateId)
          ? catalog
          : []
    } else {
      const canSeeUlb =
        scope.ulbIds.includes(ulbId) ||
        scope.districtIds.includes(ulb.districtId) ||
        scope.stateIds.includes(ulb.district.stateId)
      scoped = canSeeUlb ? catalog : []
    }

    return sortWardsByNumberAsc(scoped)
  }
}
