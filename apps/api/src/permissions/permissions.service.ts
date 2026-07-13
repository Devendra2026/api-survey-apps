import { Injectable } from "@nestjs/common"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { CreatePermissionDto, UpdatePermissionDto } from "../roles/dto/role.dto.js"
import { PermissionsRepository } from "./permissions.repository.js"

@Injectable()
export class PermissionsService {
  constructor(private readonly permissionsRepository: PermissionsRepository) {}

  findAll(query: PaginationQueryDto) {
    return this.permissionsRepository.findAll(query)
  }

  findById(id: string) {
    return this.permissionsRepository.findById(id)
  }

  create(dto: CreatePermissionDto) {
    return this.permissionsRepository.create(dto)
  }

  update(id: string, dto: UpdatePermissionDto) {
    return this.permissionsRepository.update(id, dto)
  }

  delete(id: string) {
    return this.permissionsRepository.delete(id)
  }
}
