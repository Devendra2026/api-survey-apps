import { BadRequestException } from "@nestjs/common"
import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { JobStatus } from "@workspace/database"
import { ReportsService } from "./reports.service.js"

describe("ReportsService district_ward_zip", () => {
  const reportsRepository = { exportSurveys: jest.fn(), surveyReport: jest.fn() }
  const prisma = {
    db: {
      exportJob: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      securityAudit: { create: jest.fn() },
      $transaction: jest.fn(),
    },
  }
  const jobsService = { enqueueExport: jest.fn() }
  const storageService = { getPresignedDownloadUrl: jest.fn() }

  const user = {
    id: "user-1",
    tenantRoles: [],
  } as never

  let service: ReportsService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new ReportsService(
      reportsRepository as never,
      prisma as never,
      jobsService as never,
      storageService as never
    )
    prisma.db.exportJob.create.mockResolvedValue({ id: "job-1", status: JobStatus.QUEUED })
    jobsService.enqueueExport.mockResolvedValue(undefined)
    prisma.db.securityAudit.create.mockResolvedValue({})
  })

  it("rejects district_ward_zip without districtId", async () => {
    await expect(service.enqueueExport(user, "xlsx", "district_ward_zip", {})).rejects.toThrow(BadRequestException)
    expect(jobsService.enqueueExport).not.toHaveBeenCalled()
  })

  it("rejects sync district_ward_zip", () => {
    expect(() => service.exportSync(user, "xlsx", "district_ward_zip", { districtId: "d1" })).toThrow(
      BadRequestException
    )
  })

  it("enqueues district_ward_zip when districtId is present", async () => {
    const result = await service.enqueueExport(user, "xlsx", "district_ward_zip", { districtId: "district-1" })
    expect(result).toEqual({ jobId: "job-1", status: JobStatus.QUEUED })
    expect(jobsService.enqueueExport).toHaveBeenCalledWith(
      expect.objectContaining({
        reportType: "district_ward_zip",
        format: "xlsx",
        filters: { districtId: "district-1" },
      })
    )
  })
})
