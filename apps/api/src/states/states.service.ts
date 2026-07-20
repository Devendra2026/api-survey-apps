import { Injectable } from "@nestjs/common"
import { ConfigAuditService } from "../config-audit/config-audit.service.js"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import type { CreateStateDto, UpdateStateDto } from "./dto/geo.dto.js"
import { StatesRepository } from "./states.repository.js"

@Injectable()
export class StatesService {
  constructor(
    private readonly statesRepository: StatesRepository,
    private readonly audit: ConfigAuditService
  ) {}

  findAll(query: PaginationQueryDto, user: AuthenticatedUser) {
    return this.statesRepository.findAll(query, user)
  }

  findById(id: string, user: AuthenticatedUser) {
    return this.statesRepository.findById(id, user)
  }

  async create(dto: CreateStateDto, actorId?: string) {
    const created = await this.statesRepository.create(dto)
    await this.audit.log({
      entityType: "state",
      entityId: created.id,
      action: "CREATE",
      newValue: created,
      actorId,
    })
    return created
  }

  async update(id: string, dto: UpdateStateDto, user: AuthenticatedUser) {
    const old = await this.statesRepository.findById(id, user)
    const updated = await this.statesRepository.update(id, dto, user)
    await this.audit.log({
      entityType: "state",
      entityId: id,
      action: "UPDATE",
      oldValue: old,
      newValue: updated,
      actorId: user.id,
    })
    return updated
  }

  async delete(id: string, user: AuthenticatedUser) {
    const old = await this.statesRepository.findById(id, user)
    const deleted = await this.statesRepository.delete(id, user)
    await this.audit.log({
      entityType: "state",
      entityId: id,
      action: "DELETE",
      oldValue: old,
      actorId: user.id,
    })
    return deleted
  }
}
