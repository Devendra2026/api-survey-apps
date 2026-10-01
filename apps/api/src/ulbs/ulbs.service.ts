import { Injectable } from "@nestjs/common"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { createZeroWard } from "../common/services/zero-ward.service.js"
import { PrismaService } from "../prisma/prisma.service.js"
import type { CreateUlbDto, UpdateUlbDto } from "../states/dto/geo.dto.js"
import { UlbsRepository } from "./ulbs.repository.js"

@Injectable()
export class UlbsService {
  constructor(
    private readonly ulbsRepository: UlbsRepository,
    private readonly prisma: PrismaService
  ) {}

  findAll(query: PaginationQueryDto, user: AuthenticatedUser, districtId?: string) {
    return this.ulbsRepository.findAll(query, user, districtId)
  }

  findById(id: string, user: AuthenticatedUser) {
    return this.ulbsRepository.findById(id, user)
  }

  create(dto: CreateUlbDto, user: AuthenticatedUser) {
    return this.ulbsRepository.create(dto, user)
  }

  update(id: string, dto: UpdateUlbDto, user: AuthenticatedUser) {
    return this.ulbsRepository.update(id, dto, user)
  }

  delete(id: string, user: AuthenticatedUser) {
    return this.ulbsRepository.delete(id, user)
  }

  getCurrentApiKey(id: string, user: AuthenticatedUser) {
    return this.ulbsRepository.getCurrentApiKey(id, user)
  }

  rotateApiKey(id: string, user: AuthenticatedUser) {
    return this.ulbsRepository.rotateApiKey(id, user)
  }

  createZeroWard(ulbId: string, user: AuthenticatedUser) {
    return this.ulbsRepository.findById(ulbId, user).then(() => createZeroWard(this.prisma.db, ulbId))
  }
}
