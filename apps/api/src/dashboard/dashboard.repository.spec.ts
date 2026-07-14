import { DashboardRepository } from "./dashboard.repository.js"

describe("DashboardRepository", () => {
  const prisma = {
    db: {
      survey: {
        count: () => Promise.resolve(12),
        groupBy: (args: { by: string[] }) => {
          if (args.by.includes("qcStatus")) {
            return Promise.resolve([
              { qcStatus: "PENDING", _count: { _all: 3 } },
              { qcStatus: "APPROVED", _count: { _all: 7 } },
              { qcStatus: "REJECTED", _count: { _all: 2 } },
            ])
          }
          return Promise.resolve([])
        },
        findMany: () => Promise.resolve([]),
        aggregate: () => Promise.resolve({ _avg: { gpsAccuracyMeters: { toNumber: () => 6.4 } } }),
      },
      user: { findMany: () => Promise.resolve([]) },
      ward: { findMany: () => Promise.resolve([]) },
      district: { findMany: () => Promise.resolve([]) },
      ulb: { findMany: () => Promise.resolve([]) },
      importJob: {
        findMany: () => Promise.resolve([{ id: "import-1", status: "PROCESSING", originalName: "batch.xlsx" }]),
      },
      exportJob: {
        findMany: () =>
          Promise.resolve([{ id: "export-1", status: "QUEUED", reportType: "survey-data", format: "XLSX" }]),
      },
    },
  }

  const repo = new DashboardRepository(prisma as never)
  const user = {
    id: "user-1",
    tenantRoles: [
      {
        id: "role-1",
        roleId: "role",
        roleName: "ADMIN",
        permissions: ["dashboard:view"],
        stateId: null,
        districtId: null,
        ulbId: null,
        wardId: null,
        isActive: true,
      },
    ],
  } as never

  it("returns QC, GPS, and current-user job signals alongside survey totals", async () => {
    const summary = await repo.getSummary(user)

    expect(summary.qcStatus).toEqual({ PENDING: 3, APPROVED: 7, REJECTED: 2 })
    expect(summary.gps).toEqual({ averageAccuracyMeters: 6.4 })
    expect(summary.jobs.imports).toEqual([{ id: "import-1", status: "PROCESSING", originalName: "batch.xlsx" }])
    expect(summary.jobs.exports).toEqual([
      { id: "export-1", status: "QUEUED", reportType: "survey-data", format: "XLSX" },
    ])
  })
})
