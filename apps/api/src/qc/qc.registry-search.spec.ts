import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { QcRepository } from "./qc.repository.js"

describe("QcRepository listRegistry search", () => {
  const user: AuthenticatedUser = {
    id: "u1",
    clerkUserId: "c1",
    email: "qc@test.com",
    fullName: "QC",
    phone: null,
    isActive: true,
    permissions: ["survey:approve"],
    tenantRoles: [
      {
        id: "tr1",
        roleId: "r1",
        roleName: "QC_SUPERVISOR",
        permissions: ["survey:approve"],
        stateId: null,
        districtId: null,
        ulbId: null,
        wardId: null,
        isActive: true,
      },
    ],
  }

  let findMany: jest.Mock
  let count: jest.Mock
  let repo: QcRepository

  beforeEach(() => {
    findMany = jest.fn()
    count = jest.fn()
    const prisma = {
      db: {
        survey: { findMany, count },
        district: { findUnique: jest.fn() },
        ulb: { findUnique: jest.fn() },
        ward: { findUnique: jest.fn() },
      },
    }
    const wardCatalog = { listScopedWards: jest.fn<() => Promise<unknown[]>>(() => Promise.resolve([])) }
    repo = new QcRepository(prisma as never, wardCatalog as never)
  })

  it("includes parcelNumber in-variants and coOwners.some.name in search OR", async () => {
    findMany.mockResolvedValue([] as never)
    count.mockResolvedValue(0 as never)

    await repo.listRegistry(user, { search: "00001", page: 1, limit: 50 })

    expect(findMany).toHaveBeenCalled()
    const call = findMany.mock.calls[0]?.[0] as {
      where: { AND: Array<{ OR?: unknown[] }> }
    }
    const base = call.where.AND[0]
    const or = base?.OR as Array<Record<string, unknown>>
    expect(or).toEqual(
      expect.arrayContaining([
        { parcelNumber: { contains: "00001", mode: "insensitive" } },
        {
          parcelNumber: {
            in: expect.arrayContaining(["1", "01", "001", "0001", "00001"]),
          },
        },
        { coOwners: { some: { name: { contains: "00001", mode: "insensitive" } } } },
      ])
    )
  })

  it("maps ownerName from primary co-owner, not respondentName", async () => {
    findMany.mockResolvedValue([
      {
        id: "s1",
        propertyId: "801262-008-00001-001-M",
        surveyStatus: "SUBMITTED",
        qcStatus: "PENDING",
        parcelNumber: "00001",
        wardNumber: "08",
        propertyUse: "MIX_PROPERTY",
        respondentName: "Kishan",
        mobileNumber: "8273955117",
        submittedAt: new Date("2026-01-01"),
        approvedAt: null,
        createdAt: new Date("2026-01-01"),
        assignedTo: { id: "u2", fullName: "Surveyor" },
        createdBy: { id: "u1", fullName: "QC" },
        ward: { id: "w1", wardName: "Ward 08", wardNumber: "08" },
        ulb: { id: "ulb1", name: "Etah" },
        district: { id: "d1", name: "Etah" },
        coOwners: [{ name: "Ramjeet Shaky" }],
      },
    ] as never)
    count.mockResolvedValue(1 as never)

    const result = await repo.listRegistry(user, { search: "00001", page: 1, limit: 50, status: "all" })

    expect(result.items[0]?.ownerName).toBe("Ramjeet Shaky")
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          coOwners: { select: { name: true }, orderBy: { ownerIndex: "asc" }, take: 1 },
        }),
      })
    )
  })

  it("falls back to respondentName when no co-owners", async () => {
    findMany.mockResolvedValue([
      {
        id: "s1",
        propertyId: "801262-008-00001-001-M",
        surveyStatus: "SUBMITTED",
        qcStatus: "PENDING",
        parcelNumber: "00001",
        wardNumber: "08",
        propertyUse: "RESIDENTIAL",
        respondentName: "Kishan",
        mobileNumber: null,
        submittedAt: null,
        approvedAt: null,
        createdAt: new Date("2026-01-01"),
        assignedTo: null,
        createdBy: { id: "u1", fullName: "QC" },
        ward: null,
        ulb: null,
        district: null,
        coOwners: [],
      },
    ] as never)
    count.mockResolvedValue(1 as never)

    const result = await repo.listRegistry(user, { page: 1, limit: 50, status: "all" })
    expect(result.items[0]?.ownerName).toBe("Kishan")
  })
})
