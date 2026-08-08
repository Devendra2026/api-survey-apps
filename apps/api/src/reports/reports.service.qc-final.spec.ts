import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { BadRequestException } from "@nestjs/common"
import { JobStatus } from "@workspace/database"
import { ReportsService } from "./reports.service.js"

describe("ReportsService qc_final / survey_data enqueue", () => {
  const reportsRepository = { exportSurveys: jest.fn(), surveyReport: jest.fn() }
  const prisma = {
    db: {
      exportJob: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      securityAudit: { create: jest.fn() },
      ward: { findUnique: jest.fn() },
      ulb: { findUnique: jest.fn() },
      district: { findUnique: jest.fn() },
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

  it("rejects qc_final without wardId", async () => {
    await expect(service.enqueueExport(user, "xlsx", "qc_final", {})).rejects.toThrow(BadRequestException)
    expect(jobsService.enqueueExport).not.toHaveBeenCalled()
  })

  it("rejects survey_data without wardId", async () => {
    await expect(service.enqueueExport(user, "xlsx", "survey_data", {})).rejects.toThrow(BadRequestException)
    expect(jobsService.enqueueExport).not.toHaveBeenCalled()
  })

  it("forces qcStatus=APPROVED when enqueuing qc_final with ward", async () => {
    const result = await service.enqueueExport(user, "xlsx", "qc_final", {
      wardId: "ward-1",
      qcStatus: "PENDING",
    })
    expect(result).toEqual({ jobId: "job-1", status: JobStatus.QUEUED })
    expect(jobsService.enqueueExport).toHaveBeenCalledWith(
      expect.objectContaining({
        reportType: "qc_final",
        format: "xlsx",
        filters: { wardId: "ward-1", qcStatus: "APPROVED" },
      })
    )
  })

  it("strips qcStatus when enqueuing survey_data", async () => {
    await service.enqueueExport(user, "xlsx", "survey_data", { wardId: "ward-1", qcStatus: "PENDING" })
    expect(jobsService.enqueueExport).toHaveBeenCalledWith(
      expect.objectContaining({
        reportType: "survey_data",
        filters: { wardId: "ward-1" },
      })
    )
  })

  it("passes enableAutoFilter for survey_data and qc_final", async () => {
    await service.enqueueExport(user, "xlsx", "survey_data", { wardId: "ward-1" }, { enableAutoFilter: true })
    expect(jobsService.enqueueExport).toHaveBeenCalledWith(
      expect.objectContaining({
        reportType: "survey_data",
        enableAutoFilter: true,
      })
    )

    await service.enqueueExport(user, "xlsx", "qc_final", { wardId: "ward-1" }, { enableAutoFilter: true })
    expect(jobsService.enqueueExport).toHaveBeenCalledWith(
      expect.objectContaining({
        reportType: "qc_final",
        enableAutoFilter: true,
      })
    )

    await service.enqueueExport(user, "xlsx", "ulb", {}, { enableAutoFilter: true })
    expect(jobsService.enqueueExport).toHaveBeenCalledWith(
      expect.not.objectContaining({
        enableAutoFilter: true,
      })
    )
  })
})
