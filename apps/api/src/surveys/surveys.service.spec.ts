import { jest } from "@jest/globals"
import { BadRequestException, ForbiddenException } from "@nestjs/common"
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
    findById: jest.fn(),
    transitionStatus: jest.fn(),
  }

  const prisma = {
    db: {
      ward: { findUnique: jest.fn() },
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
})
