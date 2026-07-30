import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { IS_PUBLIC_KEY } from "../decorators/public.decorator.js"
import { ANY_PERMISSIONS_KEY, PERMISSIONS_KEY } from "../decorators/require-permission.decorator.js"
import type { AuthenticatedUser } from "../interfaces/authenticated-user.interface.js"

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name)

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const anyRequired = this.reflector.getAllAndOverride<string[]>(ANY_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    const allRequired = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!anyRequired?.length && !allRequired?.length) return true

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>()
    const user = request.user
    if (!user) {
      throw new ForbiddenException("Authentication required")
    }

    if (anyRequired?.length) {
      const hasAny = anyRequired.some((p) => user.permissions.includes(p))
      if (!hasAny) {
        this.logger.warn(
          `Authorization denied user=${user.id} requiredAny=${anyRequired.join(",")} has=${user.permissions.join(",")}`
        )
        throw new ForbiddenException(`Missing permission: one of ${anyRequired.join(", ")}`)
      }
    }

    if (allRequired?.length) {
      const hasAll = allRequired.every((p) => user.permissions.includes(p))
      if (!hasAll) {
        this.logger.warn(
          `Authorization denied user=${user.id} required=${allRequired.join(",")} has=${user.permissions.join(",")}`
        )
        throw new ForbiddenException(`Missing permission: ${allRequired.join(", ")}`)
      }
    }

    return true
  }
}
