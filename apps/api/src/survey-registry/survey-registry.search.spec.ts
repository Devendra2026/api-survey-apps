import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { SurveyRegistryRepository } from "./survey-registry.repository.js"

function getSearchOr(findMany: jest.Mock): Array<Record<string, unknown>> {
  const call = findMany.mock.calls[0]?.[0] as {
    where: { AND: Array<{ OR?: unknown[] }> }
  }
  const base = call.where.AND[0]
  return (base?.OR ?? []) as Array<Record<string, unknown>>
}

describe("SurveyRegistryRepository list search", () => {
  const user: AuthenticatedUser = {
    id: "u1",
    clerkUserId: "c1",
    email: "survey@test.com",
    fullName: "Survey Admin",
    phone: null,
    isActive: true,
    permissions: ["survey:view"],
    tenantRoles: [
      {
        id: "tr1",
        roleId: "r1",
        roleName: "ADMIN",
        permissions: ["survey:view"],
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
  let repo: SurveyRegistryRepository

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
    repo = new SurveyRegistryRepository(prisma as never)
  })

  it("all / omitted searchField uses propertyId, owner, and parcel only (no surveyor)", async () => {
    findMany.mockResolvedValue([] as never)
    count.mockResolvedValue(0 as never)

    await repo.list(user, { search: "00001", page: 1, limit: 50 })

    const or = getSearchOr(findMany)
    expect(or).toEqual(
      expect.arrayContaining([
        { propertyId: { contains: "00001", mode: "insensitive" } },
        { respondentName: { contains: "00001", mode: "insensitive" } },
        { coOwners: { some: { name: { contains: "00001", mode: "insensitive" } } } },
        { parcelNumber: { contains: "00001", mode: "insensitive" } },
        {
          parcelNumber: {
            in: expect.arrayContaining(["1", "01", "001", "0001", "00001"]),
          },
        },
      ])
    )
    expect(or.some((c) => "assignedTo" in c)).toBe(false)
    expect(or.some((c) => "createdBy" in c)).toBe(false)
  })

  it("searchField=owner matches respondentName and coOwners only", async () => {
    findMany.mockResolvedValue([] as never)
    count.mockResolvedValue(0 as never)

    await repo.list(user, { search: "Ram", searchField: "owner", page: 1, limit: 50 })

    expect(getSearchOr(findMany)).toEqual([
      { respondentName: { contains: "Ram", mode: "insensitive" } },
      { coOwners: { some: { name: { contains: "Ram", mode: "insensitive" } } } },
    ])
  })

  it("searchField=parcel matches parcel contains and variants", async () => {
    findMany.mockResolvedValue([] as never)
    count.mockResolvedValue(0 as never)

    await repo.list(user, { search: "00001", searchField: "parcel", page: 1, limit: 50 })

    const or = getSearchOr(findMany)
    expect(or).toEqual(
      expect.arrayContaining([
        { parcelNumber: { contains: "00001", mode: "insensitive" } },
        {
          parcelNumber: {
            in: expect.arrayContaining(["1", "01", "001", "0001", "00001"]),
          },
        },
      ])
    )
    expect(or.some((c) => "propertyId" in c)).toBe(false)
    expect(or.some((c) => "respondentName" in c)).toBe(false)
  })

  it("searchField=propertyId matches propertyId only", async () => {
    findMany.mockResolvedValue([] as never)
    count.mockResolvedValue(0 as never)

    await repo.list(user, {
      search: "801262",
      searchField: "propertyId",
      page: 1,
      limit: 50,
    })

    expect(getSearchOr(findMany)).toEqual([{ propertyId: { contains: "801262", mode: "insensitive" } }])
  })

  it("empty search does not add OR text filter", async () => {
    findMany.mockResolvedValue([] as never)
    count.mockResolvedValue(0 as never)

    await repo.list(user, { page: 1, limit: 50, tab: "all" })

    expect(getSearchOr(findMany)).toEqual([])
    // findMany + page count + 6 tab counts (no search → counts run)
    expect(count).toHaveBeenCalledTimes(7)
  })

  it("mixed-case search still uses insensitive contains", async () => {
    findMany.mockResolvedValue([] as never)
    count.mockResolvedValue(0 as never)

    await repo.list(user, { search: "RaM", searchField: "owner", page: 1, limit: 50 })

    expect(getSearchOr(findMany)).toEqual([
      { respondentName: { contains: "RaM", mode: "insensitive" } },
      { coOwners: { some: { name: { contains: "RaM", mode: "insensitive" } } } },
    ])
  })

  it("skips tab counts when search is set (only page total count)", async () => {
    findMany.mockResolvedValue([] as never)
    count.mockResolvedValue(0 as never)

    const result = await repo.list(user, { search: "Ram", page: 1, limit: 50, tab: "all" })

    expect(result.counts).toBeNull()
    expect(count).toHaveBeenCalledTimes(1)
  })

  it("sortBy=parcelNumber orders by parcelNumber asc with id tie-breaker", async () => {
    findMany.mockResolvedValue([] as never)
    count.mockResolvedValue(0 as never)

    await repo.list(user, { page: 1, limit: 50, sortBy: "parcelNumber", sortOrder: "asc" })

    const call = findMany.mock.calls[0]?.[0] as { orderBy: unknown }
    expect(call.orderBy).toEqual([{ parcelNumber: { sort: "asc", nulls: "last" } }, { id: "asc" }])
  })
})
