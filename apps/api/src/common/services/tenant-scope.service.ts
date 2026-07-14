import { Injectable } from "@nestjs/common"
import { PrismaService } from "../../prisma/prisma.service.js"
import type {
  AuthenticatedUser,
  TenantRoleAssignment,
  TenantScope,
} from "../interfaces/authenticated-user.interface.js"
import { resolveTenantScope } from "../utils/tenant-scope.util.js"

@Injectable()
export class TenantScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async loadUserContext(userId: string): Promise<{
    permissions: string[]
    tenantRoles: TenantRoleAssignment[]
    scope: TenantScope
  }> {
    const assignments = await this.prisma.db.userTenantRole.findMany({
      where: { userId, isActive: true },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    })

    const permissionSet = new Set<string>()
    const tenantRoles: TenantRoleAssignment[] = assignments.map((a) => {
      const permissions = a.role.permissions.map((rp) => rp.permission.name)
      for (const name of permissions) permissionSet.add(name)
      return {
        id: a.id,
        roleId: a.roleId,
        roleName: a.role.name,
        permissions,
        stateId: a.stateId,
        districtId: a.districtId,
        ulbId: a.ulbId,
        wardId: a.wardId,
        isActive: a.isActive,
      }
    })

    return {
      permissions: [...permissionSet],
      tenantRoles,
      scope: resolveTenantScope(tenantRoles),
    }
  }

  getScopeFromUser(user: AuthenticatedUser): TenantScope {
    return resolveTenantScope(user.tenantRoles)
  }
}
