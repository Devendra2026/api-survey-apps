import { describe, expect, it } from "@jest/globals"
import { DashboardService } from "./dashboard.service.js"

describe("DashboardService KPI mapping", () => {
  it("uses bucket pendingQc (SUBMITTED+PENDING) not raw qcStatus.PENDING", async () => {
    const repo = {
      getSummary: () =>
        Promise.resolve({
          total: 100,
          byStatus: { DRAFT: 20, SUBMITTED: 50, APPROVED: 30 },
          qcStatus: { PENDING: 45, APPROVED: 50, REJECTED: 5 },
          buckets: {
            fieldDraft: 20,
            pendingQc: 25,
            approved: 50,
            returned: 5,
            rework: 0,
            total: 100,
          },
          today: { created: 1, submitted: 1, approved: 0 },
          pendingApproval: 25,
          rejected: 5,
        }),
    }
    const service = new DashboardService(repo as never)
    const summary = await service.getSummary({} as never)
    expect(summary.draft).toBe(20)
    expect(summary.pendingQc).toBe(25)
    expect(summary.approvedQc).toBe(50)
    expect(summary.rejections).toBe(5)
    expect(summary.draft + summary.pendingQc + summary.approvedQc + summary.rejections).toBe(100)
  })
})
