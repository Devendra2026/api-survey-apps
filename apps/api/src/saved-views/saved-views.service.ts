import { BadRequestException, Injectable } from "@nestjs/common"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import type { CreateSavedViewDto, SavedViewQueryDto, UpdateSavedViewDto } from "./dto/saved-view.dto.js"
import { SavedViewsRepository } from "./saved-views.repository.js"

@Injectable()
export class SavedViewsService {
  constructor(private readonly savedViewsRepository: SavedViewsRepository) {}

  list(query: SavedViewQueryDto, user: AuthenticatedUser) {
    return this.savedViewsRepository.list(user.id, query.entity ?? "surveys")
  }

  create(dto: CreateSavedViewDto, user: AuthenticatedUser) {
    if (!dto.filters || typeof dto.filters !== "object" || Array.isArray(dto.filters)) {
      throw new BadRequestException("filters must be an object")
    }
    return this.savedViewsRepository.create(user.id, dto)
  }

  update(id: string, dto: UpdateSavedViewDto, user: AuthenticatedUser) {
    return this.savedViewsRepository.update(id, user.id, dto)
  }

  remove(id: string, user: AuthenticatedUser) {
    return this.savedViewsRepository.remove(id, user.id)
  }
}
