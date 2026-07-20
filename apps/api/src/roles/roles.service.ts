import { Injectable, Logger } from "@nestjs/common"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { PrismaService } from "../prisma/prisma.service.js"
import type {
  AssignPermissionDto,
  CloneRoleDto,
  CreateRoleDto,
  SetRolePermissionsDto,
  UpdateRoleDto,
} from "./dto/role.dto.js"
import { RolesRepository } from "./roles.repository.js"

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name)

  constructor(
    private readonly rolesRepository: RolesRepository,
    private readonly prisma: PrismaService
  ) {}

  findAll(query: PaginationQueryDto) {
    return this.rolesRepository.findAll(query)
  }

  findById(id: string) {
    return this.rolesRepository.findById(id)
  }

  create(dto: CreateRoleDto) {
    return this.rolesRepository.create(dto)
  }

  update(id: string, dto: UpdateRoleDto) {
    return this.rolesRepository.update(id, dto)
  }

  delete(id: string) {
    return this.rolesRepository.delete(id)
  }

  assignPermission(dto: AssignPermissionDto) {
    this.logger.log(`Permission change assign role=${dto.roleId} permission=${dto.permissionId}`)
    return this.rolesRepository.assignPermission(dto)
  }

  removePermission(roleId: string, permissionId: string) {
    this.logger.log(`Permission change remove role=${roleId} permission=${permissionId}`)
    return this.rolesRepository.removePermission(roleId, permissionId)
  }

  async setPermissions(roleId: string, dto: SetRolePermissionsDto, actor: AuthenticatedUser) {
    const result = await this.rolesRepository.setPermissions(roleId, dto, {
      id: actor.id,
      fullName: actor.fullName,
      email: actor.email,
    })
    this.logger.log(`Permission matrix sync role=${roleId} by=${actor.id}`)
    return result
  }

  clone(id: string, dto: CloneRoleDto) {
    this.logger.log(`Clone role source=${id} name=${dto.name}`)
    return this.rolesRepository.clone(id, dto)
  }

  listAudits(roleId: string) {
    return this.rolesRepository.listAudits(roleId)
  }

  async listUsersForRole(roleId: string) {
    await this.rolesRepository.findById(roleId)
    return this.prisma.db.userTenantRole.findMany({
      where: { roleId, isActive: true },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            isActive: true,
            lastLoginAt: true,
          },
        },
        state: { select: { name: true } },
        district: { select: { name: true } },
        ulb: { select: { name: true } },
        ward: { select: { wardNumber: true, wardName: true } },
      },
      orderBy: { assignedAt: "desc" },
      take: 100,
    })
  }
}
