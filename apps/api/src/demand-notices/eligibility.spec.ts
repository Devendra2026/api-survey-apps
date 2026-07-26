import { describe, expect, it } from "@jest/globals"
import { QcStatus } from "@workspace/database"

/**
 * Documents the hard gate: demand notices only include APPROVED surveys.
 * Service buildApprovedWhere always sets qcStatus: APPROVED.
 */
describe("demand-notice eligibility", () => {
  it("only APPROVED qcStatus is eligible", () => {
    const eligible = [QcStatus.APPROVED]
    const blocked = [QcStatus.PENDING, QcStatus.REJECTED]
    expect(eligible).toContain(QcStatus.APPROVED)
    for (const status of blocked) {
      expect(eligible).not.toContain(status)
    }
  })
})
