import { ForbiddenException, Injectable } from "@nestjs/common"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { userHasAdminRole } from "../common/utils/tenant-scope.util.js"
import type { CreateWardDto, UpdateWardDto } from "../states/dto/geo.dto.js"
import { WardsRepository } from "./wards.repository.js"

@Injectable()
export class WardsService {
  constructor(private readonly wardsRepository: WardsRepository) {}

  findAll(query: PaginationQueryDto, user: AuthenticatedUser, ulbId?: string) {
    return this.wardsRepository.findAll(query, user, ulbId)
  }

  findById(id: string, user: AuthenticatedUser) {
    return this.wardsRepository.findById(id, user)
  }

  create(dto: CreateWardDto) {
    return this.wardsRepository.create(dto)
  }

  update(id: string, dto: UpdateWardDto, user: AuthenticatedUser) {
    return this.wardsRepository.update(id, dto, user)
  }

  delete(id: string, user: AuthenticatedUser) {
    if (!userHasAdminRole(user)) {
      throw new ForbiddenException("Only Admin users can delete wards")
    }
    return this.wardsRepository.delete(id, user)
  }
}
