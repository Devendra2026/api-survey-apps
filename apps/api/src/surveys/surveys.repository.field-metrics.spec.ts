import { afterEach, describe, expect, it, jest } from "@jest/globals"
import { Logger } from "@nestjs/common"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { SurveysRepository } from "./surveys.repository.js"

const todayStart = new Date("2026-09-27T00:00:00.000Z")

const user: AuthenticatedUser = {
  id: "user-1",
  clerkUserId: "clerk_1",
  email: "surveyor@example.com",
  fullName: "Surveyor",
  phone: null,
  isActive: true,
  permissions: ["survey:view"],
  tenantRoles: [
    {
      id: "tr1",
      roleId: "r1",
      roleName: "SURVEYOR",
      isActive: true,
      permissions: ["survey:view"],
      stateId: null,
      districtId: null,
      ulbId: null,
      wardId: null,
    },
  ],
}

function statusRow(wardId: string | null, count: number) {
  return {
    wardId,
    assignedToId: user.id,
    surveyStatus: "IN_PROGRESS" as const,
    qcStatus: "PENDING" as const,
    _count: { _all: count },
  }
}

describe("SurveysRepository.fieldMetrics", () => {
  const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined)

  afterEach(() => {
    warn.mockClear()
  })

  function makeRepo(statusRows: ReturnType<typeof statusRow>[]) {
    const groupBy = jest.fn()
    groupBy.mockResolvedValueOnce(statusRows)
    groupBy.mockResolvedValueOnce([])
    groupBy.mockResolvedValueOnce([])
    const wardCatalog = [
      {
        id: "cmrytcbsw002fxgfnrfin23nx",
        wardNumber: "1",
        wardName: "One",
        ulb: { name: "Nagar Palika" },
      },
      {
        id: "cmuicx8df0035dgfn71unbq8j",
        wardNumber: "2",
        wardName: "Two",
        ulb: { name: "Nagar Palika" },
      },
      { id: "w1", wardNumber: "1", wardName: "Ward 1", ulb: { name: "ULB" } },
    ]
    const wardFindMany = jest.fn((args: { where: { id: { in: string[] } } }) =>
      Promise.resolve(wardCatalog.filter((ward) => args.where.id.in.includes(ward.id)))
    )
    const prisma = {
      db: {
        survey: {
          groupBy,
          count: jest.fn().mockResolvedValue(0),
        },
        ward: { findMany: wardFindMany },
      },
    }
    return { repo: new SurveysRepository(prisma as never), wardFindMany }
  }

  it("looks up only non-null ward ids and keeps their ULB names", async () => {
    const { repo, wardFindMany } = makeRepo([
      statusRow("cmrytcbsw002fxgfnrfin23nx", 2),
      statusRow("cmuicx8df0035dgfn71unbq8j", 1),
      statusRow(null, 4),
    ])
    const result = await repo.fieldMetrics(user, { scope: "self", todayStart })
    expect(wardFindMany).toHaveBeenCalledWith({
      where: { id: { in: ["cmrytcbsw002fxgfnrfin23nx", "cmuicx8df0035dgfn71unbq8j"] } },
      select: { id: true, wardNumber: true, wardName: true, ulb: { select: { name: true } } },
    })
    expect(result.wards).toEqual([
      { id: "cmrytcbsw002fxgfnrfin23nx", wardNumber: "1", wardName: "One", ulbName: "Nagar Palika" },
      { id: "cmuicx8df0035dgfn71unbq8j", wardNumber: "2", wardName: "Two", ulbName: "Nagar Palika" },
    ])
    expect(warn).toHaveBeenCalledWith("fieldMetrics: 4 surveys grouped with a null wardId (scope=self)")
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/mobile|password|token|propertyId/i)
  })

  it("deduplicates ward ids before the ward lookup", async () => {
    const { repo, wardFindMany } = makeRepo([statusRow("w1", 2), statusRow("w1", 3)])
    await repo.fieldMetrics(user, { scope: "self", todayStart })
    expect(wardFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["w1"] } },
      })
    )
    expect(warn).not.toHaveBeenCalled()
  })

  it("does not query wards when every grouped ward id is null", async () => {
    const { repo, wardFindMany } = makeRepo([statusRow(null, 6)])
    const result = await repo.fieldMetrics(user, { scope: "self", todayStart })
    expect(wardFindMany).not.toHaveBeenCalled()
    expect(result.wards).toEqual([])
    expect(warn).toHaveBeenCalledWith("fieldMetrics: 6 surveys grouped with a null wardId (scope=self)")
  })
})
