import { ForbiddenException, Injectable, Logger } from "@nestjs/common"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { canAccessTenant, resolveTenantScope } from "../common/utils/tenant-scope.util.js"
import type { AssignTenantRoleDto, CreateUserDto, SyncUserDto, UpdateUserDto } from "./dto/user.dto.js"
import { UsersRepository } from "./users.repository.js"

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name)

  constructor(private readonly usersRepository: UsersRepository) {}

  findAll(query: PaginationQueryDto) {
    return this.usersRepository.findAll(query)
  }

  findById(id: string) {
    return this.usersRepository.findById(id)
  }

  getMe(user: AuthenticatedUser) {
    return this.usersRepository.findById(user.id)
  }

  async sync(user: AuthenticatedUser, dto: SyncUserDto) {
    this.logger.log(`User sync ${user.clerkUserId}`)
    return this.usersRepository.update(user.id, {
      fullName: dto.fullName,
      phone: dto.phone,
    })
  }

  create(dto: CreateUserDto) {
    return this.usersRepository.create(dto)
  }

  update(id: string, dto: UpdateUserDto) {
    return this.usersRepository.update(id, dto)
  }

  async assignTenantRole(dto: AssignTenantRoleDto, actor: AuthenticatedUser) {
    const actorScope = resolveTenantScope(actor.tenantRoles)
    const isGlobalAssignment = !dto.stateId && !dto.districtId && !dto.ulbId && !dto.wardId

    if (isGlobalAssignment && !actorScope.isGlobal) {
      throw new ForbiddenException("Only global admins can assign roles without tenant scope")
    }

    if (!isGlobalAssignment) {
      if (
        !canAccessTenant(actorScope, {
          stateId: dto.stateId,
          districtId: dto.districtId,
          ulbId: dto.ulbId,
          wardId: dto.wardId,
        })
      ) {
        throw new ForbiddenException("Cannot assign roles outside your tenant scope")
      }
    }

    this.logger.log(`Role assignment user=${dto.userId} role=${dto.roleId} by=${actor.id}`)
    return this.usersRepository.assignTenantRole(dto, actor.id)
  }

  deactivateTenantRole(id: string) {
    return this.usersRepository.deactivateTenantRole(id)
  }
}
