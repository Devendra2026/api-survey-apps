import { ConflictException, Injectable } from "@nestjs/common"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { ConfigAuditService } from "../config-audit/config-audit.service.js"
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

  async create(dto: CreateStateDto, user: AuthenticatedUser) {
    const existing = await this.statesRepository.findByCode(dto.code)
    if (existing) {
      // Grant access so a scoped admin who couldn't "see" UP can open it after this attempt
      await this.statesRepository.ensureCreatorStateAccess(user, existing.id)
      throw new ConflictException(
        `State code "${dto.code}" already exists (${existing.name}). Refresh Master Data and add districts/wards under it.`
      )
    }

    const created = await this.statesRepository.create(dto)
    await this.statesRepository.ensureCreatorStateAccess(user, created.id)
    await this.audit.log({
      entityType: "state",
      entityId: created.id,
      action: "CREATE",
      newValue: created,
      actorId: user.id,
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
