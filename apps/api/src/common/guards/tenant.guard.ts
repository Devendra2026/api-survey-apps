import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common"
import type { AuthenticatedUser } from "../interfaces/authenticated-user.interface.js"
import { canAccessTenant, resolveTenantScope } from "../utils/tenant-scope.util.js"

/**
 * Optional body/params geo check when stateId/districtId/ulbId/wardId are present.
 * Controllers should still enforce tenant filtering in repositories.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser
      body?: Record<string, unknown>
      params?: Record<string, string>
      query?: Record<string, unknown>
    }>()

    const user = request.user
    if (!user) return true

    const scope = resolveTenantScope(user.tenantRoles)
    if (scope.isGlobal) return true

    const geo = {
      stateId: (request.body?.stateId ?? request.query?.stateId ?? request.params?.stateId) as string | undefined,
      districtId: (request.body?.districtId ?? request.query?.districtId ?? request.params?.districtId) as
        string | undefined,
      ulbId: (request.body?.ulbId ?? request.query?.ulbId ?? request.params?.ulbId) as string | undefined,
      wardId: (request.body?.wardId ?? request.query?.wardId ?? request.params?.wardId) as string | undefined,
    }

    const hasAnyGeo = Boolean(geo.stateId || geo.districtId || geo.ulbId || geo.wardId)
    if (!hasAnyGeo) return true

    if (!canAccessTenant(scope, geo)) {
      throw new ForbiddenException("Access denied for the requested tenant scope")
    }

    return true
  }
}
