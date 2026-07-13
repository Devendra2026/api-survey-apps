import { Injectable, Logger } from "@nestjs/common"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AssignPermissionDto, CreateRoleDto, UpdateRoleDto } from "./dto/role.dto.js"
import { RolesRepository } from "./roles.repository.js"

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name)

  constructor(private readonly rolesRepository: RolesRepository) {}

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
}
