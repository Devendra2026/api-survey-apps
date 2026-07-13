import { Injectable } from "@nestjs/common"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import type { CreateDistrictDto, UpdateDistrictDto } from "../states/dto/geo.dto.js"
import { DistrictsRepository } from "./districts.repository.js"

@Injectable()
export class DistrictsService {
  constructor(private readonly districtsRepository: DistrictsRepository) {}

  findAll(query: PaginationQueryDto, user: AuthenticatedUser, stateId?: string) {
    return this.districtsRepository.findAll(query, user, stateId)
  }

  findById(id: string, user: AuthenticatedUser) {
    return this.districtsRepository.findById(id, user)
  }

  create(dto: CreateDistrictDto) {
    return this.districtsRepository.create(dto)
  }

  update(id: string, dto: UpdateDistrictDto, user: AuthenticatedUser) {
    return this.districtsRepository.update(id, dto, user)
  }

  delete(id: string, user: AuthenticatedUser) {
    return this.districtsRepository.delete(id, user)
  }
}
