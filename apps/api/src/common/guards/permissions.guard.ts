import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { IS_PUBLIC_KEY } from "../decorators/public.decorator.js"
import { PERMISSIONS_KEY } from "../decorators/require-permission.decorator.js"
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

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!required?.length) return true

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>()
    const user = request.user
    if (!user) {
      throw new ForbiddenException("Authentication required")
    }

    const hasAll = required.every((p) => user.permissions.includes(p))
    if (!hasAll) {
      this.logger.warn(
        `Authorization denied user=${user.id} required=${required.join(",")} has=${user.permissions.join(",")}`
      )
      throw new ForbiddenException(`Missing permission: ${required.join(", ")}`)
    }

    return true
  }
}
