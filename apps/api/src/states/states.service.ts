import { Injectable } from "@nestjs/common"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import type { CreateStateDto, UpdateStateDto } from "./dto/geo.dto.js"
import { StatesRepository } from "./states.repository.js"

@Injectable()
export class StatesService {
  constructor(private readonly statesRepository: StatesRepository) {}

  findAll(query: PaginationQueryDto, user: AuthenticatedUser) {
    return this.statesRepository.findAll(query, user)
  }

  findById(id: string, user: AuthenticatedUser) {
    return this.statesRepository.findById(id, user)
  }

  create(dto: CreateStateDto) {
    return this.statesRepository.create(dto)
  }

  update(id: string, dto: UpdateStateDto, user: AuthenticatedUser) {
    return this.statesRepository.update(id, dto, user)
  }

  delete(id: string, user: AuthenticatedUser) {
    return this.statesRepository.delete(id, user)
  }
}
