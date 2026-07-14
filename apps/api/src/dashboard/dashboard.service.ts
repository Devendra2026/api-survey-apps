import { Injectable } from "@nestjs/common"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { DashboardRepository } from "./dashboard.repository.js"

export type QueueHealth = "Backlogged" | "Elevated" | "Healthy"

@Injectable()
export class DashboardService {
  constructor(private readonly dashboardRepository: DashboardRepository) {}

  async getSummary(user: AuthenticatedUser) {
    const legacy = await this.dashboardRepository.getSummary(user)

    const draft = legacy.byStatus.DRAFT ?? 0
    const pendingQc = legacy.qcStatus.PENDING ?? legacy.pendingApproval ?? 0
    const approvedQc = legacy.qcStatus.APPROVED ?? 0
    const rejections = legacy.qcStatus.REJECTED ?? legacy.rejected ?? 0
    const reviewed = approvedQc + rejections
    const rejectionRate = reviewed > 0 ? Math.round((rejections / reviewed) * 1000) / 10 : 0
    const queueHealth = this.resolveQueueHealth(pendingQc, approvedQc)

    return {
      totalSurveys: legacy.total,
      draft,
      pendingQc,
      createdToday: legacy.today.created,
      createdTodaySubmitted: legacy.today.submitted,
      approvedQc,
      rejections,
      rejectionRate,
      queueHealth,
      ...legacy,
    }
  }

  getOrganization(user: AuthenticatedUser) {
    return this.dashboardRepository.getOrganization(user)
  }

  getAnalytics(user: AuthenticatedUser) {
    return this.dashboardRepository.getAnalytics(user)
  }

  private resolveQueueHealth(pendingQc: number, approvedQc: number): QueueHealth {
    if (pendingQc === 0) return "Healthy"
    if (pendingQc > approvedQc) return "Backlogged"
    if (pendingQc > 100) return "Elevated"
    return "Healthy"
  }
}
