import { expect, jest } from "@jest/globals"
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common"
import { PhotoType } from "@workspace/database"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { SurveysService } from "./surveys.service.js"

describe("SurveysService workflow", () => {
  const user: AuthenticatedUser = {
    id: "user1",
    clerkUserId: "clerk1",
    email: "u@test.com",
    fullName: "User",
    phone: null,
    isActive: true,
    permissions: [
      "survey:submit",
      "survey:approve",
      "survey:reject",
      "survey:update",
      "survey:create",
      "survey:assign",
    ],
    tenantRoles: [
      {
        id: "tr1",
        roleId: "r1",
        roleName: "SURVEYOR",
        permissions: ["survey:submit", "survey:update", "survey:create", "survey:view"],
        stateId: null,
        districtId: null,
        ulbId: null,
        wardId: null,
        isActive: true,
      },
    ],
  }

  const reviewer: AuthenticatedUser = {
    ...user,
    id: "reviewer1",
    clerkUserId: "clerk-reviewer",
    email: "qc@test.com",
    permissions: ["survey:approve", "survey:reject", "survey:view"],
    tenantRoles: [
      {
        id: "tr2",
        roleId: "r2",
        roleName: "QC_SUPERVISOR",
        permissions: ["survey:approve", "survey:reject", "survey:view"],
        stateId: null,
        districtId: null,
        ulbId: null,
        wardId: null,
        isActive: true,
      },
    ],
  }

  const baseSurvey = {
    id: "s1",
    createdById: "user1",
    assignedToId: "user1",
    surveyStatus: "DRAFT" as const,
    propertyId: "P1",
    ownershipType: "INDIVIDUAL" as const,
    propertyUse: "RESIDENTIAL" as const,
    propertyType: "RESIDENTIAL_SELF" as const,
    latitude: 27.56,
    longitude: 78.65,
    gpsCoordinates: null,
    floors: [{ id: "f1" }],
    photos: [{ id: "ph1", photoType: PhotoType.FRONT }],
    coOwners: [],
  }

  const repo = {
    findById: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    update: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    transitionStatus: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
  }

  const prisma = {
    db: {
      ward: { findUnique: jest.fn<(...args: unknown[]) => Promise<unknown>>() },
      survey: { findFirst: jest.fn<(...args: unknown[]) => Promise<unknown>>() },
    },
  }

  const jobs = { enqueueExport: jest.fn() }
  const storage = { isConfigured: jest.fn().mockReturnValue(false), getPresignedDownloadUrl: jest.fn() }
  const service = new SurveysService(
    repo as never,
    prisma as never,
    jobs as never,
    storage as never,
    {
      get: () => undefined,
    } as never
  )

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("rejects submit without FRONT photo", async () => {
    repo.findById.mockResolvedValue({ ...baseSurvey, photos: [] })
    await expect(service.submit("s1", user)).rejects.toThrow(BadRequestException)
  })

  it("rejects submit by non-creator and non-assignee", async () => {
    repo.findById.mockResolvedValue({ ...baseSurvey, createdById: "other", assignedToId: "other" })
    await expect(service.submit("s1", user)).rejects.toThrow(ForbiddenException)
  })

  it("submits when rules pass", async () => {
    repo.findById.mockResolvedValue(baseSurvey)
    repo.transitionStatus.mockResolvedValue({ survey: { ...baseSurvey, surveyStatus: "SUBMITTED" } })
    const result = await service.submit("s1", user)
    expect(repo.transitionStatus).toHaveBeenCalledWith(
      expect.objectContaining({ to: "SUBMITTED", action: "SUBMITTED" })
    )
    expect(result.surveyStatus).toBe("SUBMITTED")
  })

  it("requires co-owners for JOINT ownership", async () => {
    repo.findById.mockResolvedValue({
      ...baseSurvey,
      ownershipType: "JOINT",
      coOwners: [],
    })
    await expect(service.submit("s1", user)).rejects.toThrow(BadRequestException)
  })

  it("approves only SUBMITTED surveys", async () => {
    repo.findById.mockResolvedValue({ ...baseSurvey, surveyStatus: "DRAFT" })
    await expect(service.approve("s1", reviewer)).rejects.toThrow(BadRequestException)
  })

  it("blocks self-approval", async () => {
    repo.findById.mockResolvedValue({ ...baseSurvey, surveyStatus: "SUBMITTED" })
    await expect(service.approve("s1", user)).rejects.toThrow(ForbiddenException)
  })

  it("allows ADMIN to approve their own survey", async () => {
    const admin: AuthenticatedUser = {
      ...user,
      permissions: ["survey:approve", "survey:reject", "survey:view"],
      tenantRoles: [
        {
          id: "tr-admin",
          roleId: "r-admin",
          roleName: "ADMIN",
          permissions: ["survey:approve", "survey:reject", "survey:view"],
          stateId: null,
          districtId: null,
          ulbId: null,
          wardId: null,
          isActive: true,
        },
      ],
    }
    repo.findById.mockResolvedValue({ ...baseSurvey, surveyStatus: "SUBMITTED" })
    repo.transitionStatus.mockResolvedValue({
      survey: { ...baseSurvey, surveyStatus: "APPROVED" },
    })
    const result = await service.approve("s1", admin)
    expect(repo.transitionStatus).toHaveBeenCalledWith(expect.objectContaining({ to: "APPROVED", action: "APPROVED" }))
    expect(result.surveyStatus).toBe("APPROVED")
  })

  it("allows ADMIN to reject their own survey", async () => {
    const admin: AuthenticatedUser = {
      ...user,
      permissions: ["survey:approve", "survey:reject", "survey:view"],
      tenantRoles: [
        {
          id: "tr-admin",
          roleId: "r-admin",
          roleName: "ADMIN",
          permissions: ["survey:approve", "survey:reject", "survey:view"],
          stateId: null,
          districtId: null,
          ulbId: null,
          wardId: null,
          isActive: true,
        },
      ],
    }
    repo.findById.mockResolvedValue({ ...baseSurvey, surveyStatus: "SUBMITTED" })
    repo.transitionStatus.mockResolvedValue({
      survey: { ...baseSurvey, surveyStatus: "REJECTED" },
    })
    const result = await service.reject("s1", { qcRemarks: "Incomplete" }, admin)
    expect(repo.transitionStatus).toHaveBeenCalledWith(expect.objectContaining({ to: "REJECTED", action: "REJECTED" }))
    expect(result.surveyStatus).toBe("REJECTED")
  })

  it("rejects SUBMITTED into REJECTED", async () => {
    repo.findById.mockResolvedValue({ ...baseSurvey, surveyStatus: "SUBMITTED" })
    repo.transitionStatus.mockResolvedValue({
      survey: { ...baseSurvey, surveyStatus: "REJECTED" },
    })
    const result = await service.reject("s1", { qcRemarks: "Incomplete" }, reviewer)
    expect(repo.transitionStatus).toHaveBeenCalledWith(expect.objectContaining({ to: "REJECTED", action: "REJECTED" }))
    expect(result.surveyStatus).toBe("REJECTED")
  })

  it("reopens REJECTED surveys", async () => {
    repo.findById.mockResolvedValue({ ...baseSurvey, surveyStatus: "REJECTED" })
    repo.transitionStatus.mockResolvedValue({
      survey: { ...baseSurvey, surveyStatus: "REOPENED" },
    })
    const result = await service.reopen("s1", user)
    expect(repo.transitionStatus).toHaveBeenCalledWith(expect.objectContaining({ to: "REOPENED", action: "REOPENED" }))
    expect(result.surveyStatus).toBe("REOPENED")
  })

  it("reports every missing submit requirement at once", async () => {
    repo.findById.mockResolvedValue({ ...baseSurvey, photos: [], floors: [], latitude: null, longitude: null })
    const error = await service.submit("s1", user).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(BadRequestException)
    const body = (error as BadRequestException).getResponse()
    expect(body).toEqual(
      expect.objectContaining({
        errors: [
          "Survey requires at least one floor",
          "Survey requires at least one FRONT photo",
          "Survey requires GPS latitude and longitude",
        ],
      })
    )
    expect(repo.transitionStatus).not.toHaveBeenCalled()
  })

  it("does not transition again when the survey is already SUBMITTED (double submit)", async () => {
    repo.findById.mockResolvedValue({ ...baseSurvey, surveyStatus: "SUBMITTED" })
    await expect(service.submit("s1", user)).rejects.toThrow("Cannot submit survey in status SUBMITTED")
    expect(repo.transitionStatus).not.toHaveBeenCalled()
  })

  it("surfaces the conditional-update loss when a concurrent submit wins", async () => {
    repo.findById.mockResolvedValue(baseSurvey)
    repo.transitionStatus.mockRejectedValue(new NotFoundException("Survey not found or not in status DRAFT"))
    await expect(service.submit("s1", user)).rejects.toBeInstanceOf(NotFoundException)
    expect(repo.transitionStatus).toHaveBeenCalledWith(expect.objectContaining({ id: "s1", from: "DRAFT" }))
  })

  it("writes structured QC remarks on reject alongside the summary", async () => {
    repo.findById.mockResolvedValue({ ...baseSurvey, surveyStatus: "SUBMITTED" })
    repo.transitionStatus.mockResolvedValue({ survey: { ...baseSurvey, surveyStatus: "REJECTED" } })
    await service.reject(
      "s1",
      {
        qcRemarks: " Fix owner and photo ",
        corrections: [
          { section: "owner", field: " Mobile number ", reason: "Incorrect" },
          { section: "photos", reason: "Unclear", note: "Retake front photo in daylight" },
        ],
      },
      reviewer
    )
    expect(repo.transitionStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "SUBMITTED",
        to: "REJECTED",
        extra: expect.objectContaining({ qcRemarks: " Fix owner and photo ", qcStatus: "REJECTED" }),
        createQcRemarks: [
          { body: "Fix owner and photo", section: null, field: null, reason: null },
          { body: "Mobile number: Incorrect", section: "owner", field: "Mobile number", reason: "Incorrect" },
          { body: "Retake front photo in daylight", section: "photos", field: null, reason: "Unclear" },
        ],
      })
    )
  })

  it("resubmits a correction on the same survey id and resolves open remarks", async () => {
    repo.findById.mockResolvedValue({ ...baseSurvey, surveyStatus: "REOPENED" })
    repo.transitionStatus.mockResolvedValue({ survey: { ...baseSurvey, surveyStatus: "SUBMITTED" } })
    const result = await service.submit("s1", user)
    expect(repo.transitionStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "s1",
        from: "REOPENED",
        to: "SUBMITTED",
        resolveOpenQcRemarks: true,
        extra: expect.objectContaining({ qcStatus: "PENDING", qcRemarks: null }),
      })
    )
    expect(result.id).toBe("s1")
  })

  it("does not resolve remarks on a first submit", async () => {
    repo.findById.mockResolvedValue(baseSurvey)
    repo.transitionStatus.mockResolvedValue({ survey: { ...baseSurvey, surveyStatus: "SUBMITTED" } })
    await service.submit("s1", user)
    expect(repo.transitionStatus).toHaveBeenCalledWith(expect.objectContaining({ resolveOpenQcRemarks: false }))
  })

  it("derives Property ID from the ward saved in the same update", async () => {
    const survey = {
      ...baseSurvey,
      surveyStatus: "IN_PROGRESS" as const,
      propertyId: "TEMP-MOBILE-ABC",
      stateId: "state-1",
      districtId: "dist-1",
      ulbId: "ulb-1",
      wardId: "ward-1",
      ulbCode: "801262",
      wardNumber: "1",
      parcelNumber: "747",
      unitSubNo: "1",
      propertyUse: "COMMERCIAL" as const,
      assessmentYear: "AY_2026_2027" as const,
      ward: { id: "ward-1", wardNumber: "1", kind: "GEOGRAPHIC" },
      ulb: { code: "801262" },
    }
    repo.findById.mockResolvedValue(survey)
    prisma.db.ward.findUnique.mockResolvedValue({
      id: "ward-2",
      wardNumber: "7",
      kind: "GEOGRAPHIC",
      ulbId: "ulb-1",
      ulb: { districtId: "dist-1", district: { stateId: "state-1" } },
    })
    prisma.db.survey.findFirst.mockResolvedValue(null)
    repo.update.mockResolvedValue({ ...survey, propertyId: "801262-007-00747-001-C", wardId: "ward-2" })
    await service.update(
      "s1",
      { wardId: "ward-2", parcelNumber: "747", unitSubNo: "1", propertyId: "client-must-not-win" },
      user
    )
    expect(repo.update).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({
        wardId: "ward-2",
        wardNumber: "7",
        propertyId: "801262-007-00747-001-C",
      })
    )
    const written = repo.update.mock.calls[0]?.[1] as { propertyId?: string }
    expect(written.propertyId).not.toBe("client-must-not-win")
  })

  it("leaves the stored Property ID unchanged until property use is present", async () => {
    const survey = {
      ...baseSurvey,
      surveyStatus: "IN_PROGRESS" as const,
      propertyId: "TEMP-MOBILE-ABC",
      stateId: "state-1",
      districtId: "dist-1",
      ulbId: "ulb-1",
      wardId: "ward-1",
      ulbCode: "801262",
      wardNumber: "1",
      parcelNumber: null,
      unitSubNo: null,
      propertyUse: null,
      assessmentYear: "AY_2026_2027" as const,
      ward: { id: "ward-1", wardNumber: "1", kind: "GEOGRAPHIC" },
      ulb: { code: "801262" },
    }
    repo.findById.mockResolvedValue(survey)
    repo.update.mockResolvedValue(survey)
    await service.update("s1", { parcelNumber: "747", unitSubNo: "1", sectorNo: "3", isSlum: false }, user)
    const written = repo.update.mock.calls[0]?.[1] as { propertyId?: string; sectorNo?: string; isSlum?: boolean }
    expect(written.propertyId).toBeUndefined()
    expect(written.sectorNo).toBe("3")
    expect(written.isSlum).toBe(false)
  })

  it("denies team field metrics without survey:assign or survey:approve", async () => {
    const surveyorOnly: AuthenticatedUser = { ...user, tenantRoles: [user.tenantRoles[0]!] }
    await expect(service.fieldMetrics({ scope: "team" }, surveyorOnly)).rejects.toBeInstanceOf(ForbiddenException)
  })
})
