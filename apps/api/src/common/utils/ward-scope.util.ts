import { NotFoundException } from "@nestjs/common"
import type { PrismaService } from "../../prisma/prisma.service.js"
import type { AuthenticatedUser } from "../interfaces/authenticated-user.interface.js"
import { canAccessTenant, resolveTenantScope } from "./tenant-scope.util.js"

type WardLookup = Pick<PrismaService["db"], "ward">

/**
 * Throws NotFound unless the ward exists and sits inside the user's tenant scope.
 * Use before handing out anything that is later read without a session (print tokens, PDF jobs).
 */
export async function assertWardInUserScope(db: WardLookup, user: AuthenticatedUser, wardId: string): Promise<void> {
  const scope = resolveTenantScope(user.tenantRoles)
  const ward = await db.ward.findFirst({
    where: { id: wardId, deletedAt: null },
    select: { id: true, ulbId: true, ulb: { select: { districtId: true, district: { select: { stateId: true } } } } },
  })
  if (!ward) throw new NotFoundException("Ward not found")
  if (scope.isGlobal) return
  const allowed = canAccessTenant(scope, {
    wardId: ward.id,
    ulbId: ward.ulbId,
    districtId: ward.ulb.districtId,
    stateId: ward.ulb.district.stateId,
  })
  if (!allowed) throw new NotFoundException("Ward not found")
}
