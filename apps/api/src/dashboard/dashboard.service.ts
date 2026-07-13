import { Injectable } from "@nestjs/common"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { DashboardRepository } from "./dashboard.repository.js"

@Injectable()
export class DashboardService {
  constructor(private readonly dashboardRepository: DashboardRepository) {}

  getSummary(user: AuthenticatedUser) {
    return this.dashboardRepository.getSummary(user)
  }
}
