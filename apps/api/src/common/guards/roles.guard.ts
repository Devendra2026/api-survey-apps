import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { IS_PUBLIC_KEY } from "../decorators/public.decorator.js"
import { ROLES_KEY } from "../decorators/require-permission.decorator.js"
import type { AuthenticatedUser } from "../interfaces/authenticated-user.interface.js"

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [context.getHandler(), context.getClass()])
    if (!required?.length) return true

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>()
    const user = request.user
    if (!user) throw new ForbiddenException("Authentication required")

    const roleNames = user.tenantRoles.filter((r) => r.isActive).map((r) => r.roleName)
    const ok = required.some((r) => roleNames.includes(r))
    if (!ok) {
      throw new ForbiddenException(`Required role: ${required.join(" | ")}`)
    }
    return true
  }
}
