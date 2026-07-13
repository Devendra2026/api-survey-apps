import { Injectable } from "@nestjs/common"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { NotificationsRepository } from "./notifications.repository.js"

@Injectable()
export class NotificationsService {
  constructor(private readonly notificationsRepository: NotificationsRepository) {}

  findAll(user: AuthenticatedUser, query: PaginationQueryDto) {
    return this.notificationsRepository.findForUser(user, query)
  }

  getUnreadCount(user: AuthenticatedUser) {
    return this.notificationsRepository.countUnread(user)
  }
}
