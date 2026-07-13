import { Injectable } from "@nestjs/common"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import type { CreateUlbDto, UpdateUlbDto } from "../states/dto/geo.dto.js"
import { UlbsRepository } from "./ulbs.repository.js"

@Injectable()
export class UlbsService {
  constructor(private readonly ulbsRepository: UlbsRepository) {}

  findAll(query: PaginationQueryDto, user: AuthenticatedUser, districtId?: string) {
    return this.ulbsRepository.findAll(query, user, districtId)
  }

  findById(id: string, user: AuthenticatedUser) {
    return this.ulbsRepository.findById(id, user)
  }

  create(dto: CreateUlbDto) {
    return this.ulbsRepository.create(dto)
  }

  update(id: string, dto: UpdateUlbDto, user: AuthenticatedUser) {
    return this.ulbsRepository.update(id, dto, user)
  }

  delete(id: string, user: AuthenticatedUser) {
    return this.ulbsRepository.delete(id, user)
  }
}
