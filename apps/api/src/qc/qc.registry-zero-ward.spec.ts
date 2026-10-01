import { describe, expect, it, jest } from "@jest/globals"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { QcRepository } from "./qc.repository.js"

describe("QcRepository.listRegistry Zero Ward", () => {
  it("returns a survey whose current ward is a soft-deleted Zero Ward", async () => {
    const row = {
      id: "survey-z",
      propertyId: "800726-000-00010-001-R",
      ulbCode: "800726",
      wardNumber: "1",
      parcelNumber: "00010",
      unitSubNo: "001",
      propertyUse: "R",
      surveyStatus: "SUBMITTED",
      qcStatus: "PENDING",
      respondentName: "Owner",
      mobileNumber: null,
      submittedAt: null,
      approvedAt: null,
      createdAt: new Date("2026-10-01T00:00:00.000Z"),
      assignedTo: null,
      createdBy: { id: "u1", fullName: "Surveyor" },
      ward: { id: "zero-old", wardName: "Zero Ward", wardNumber: "0", kind: "ZERO", deletedAt: new Date() },
      originalWard: { id: "ward-1", wardName: "One", wardNumber: "1", kind: "GEOGRAPHIC" },
      ulb: { id: "ulb-1", name: "ULB", code: "800726" },
      district: { id: "d1", name: "District" },
      coOwners: [],
    }
    const findMany = jest.fn().mockResolvedValue([row] as never)
    const count = jest.fn().mockResolvedValue(1 as never)
    const prisma = {
      db: {
        survey: { findMany, count },
        ulb: { findUnique: jest.fn().mockResolvedValue({ name: "ULB" } as never) },
        district: { findUnique: jest.fn().mockResolvedValue({ name: "District" } as never) },
        ward: { findUnique: jest.fn() },
      },
    }
    const surveysService = {
      ensureFormulaPropertyId: jest.fn((input: { propertyId: string }) => Promise.resolve(input)),
    }
    const repo = new QcRepository(prisma as never, { listScopedWards: jest.fn() } as never, surveysService as never)
    const user = {
      id: "u1",
      tenantRoles: [
        {
          id: "tr1",
          roleId: "r1",
          roleName: "ADMIN",
          permissions: [],
          stateId: null,
          districtId: null,
          ulbId: null,
          wardId: null,
          isActive: true,
        },
      ],
    } as AuthenticatedUser

    const result = await repo.listRegistry(user, { ulbId: "ulb-1", page: 1, limit: 20 })

    const where = findMany.mock.calls[0]?.[0] as { where: { AND: Array<Record<string, unknown>> } }
    expect(where.where.AND[0]).toEqual(expect.objectContaining({ deletedAt: null, ulbId: "ulb-1" }))
    expect(where.where.AND[0]).not.toHaveProperty("ward")
    expect(result.items[0]?.id).toBe("survey-z")
  })
})
