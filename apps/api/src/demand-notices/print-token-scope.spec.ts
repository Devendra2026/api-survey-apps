import { describe, expect, it, jest } from "@jest/globals"
import { NotFoundException, UnauthorizedException } from "@nestjs/common"
import type { ConfigService } from "@nestjs/config"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import type { PrismaService } from "../prisma/prisma.service.js"
import type { StorageService } from "../storage/storage.service.js"
import { DemandNoticesService } from "./demand-notices.service.js"
import { signPrintToken } from "./lib/print-token.js"

const SECRET = "test-print-secret"

function makeService(wards: Record<string, { ulbId: string; districtId: string; stateId: string }>) {
  const prisma = {
    db: {
      ward: {
        findFirst: jest.fn(({ where }: { where: { id: string } }) => {
          const ward = wards[where.id]
          return Promise.resolve(
            ward
              ? {
                  id: where.id,
                  ulbId: ward.ulbId,
                  ulb: { districtId: ward.districtId, district: { stateId: ward.stateId } },
                }
              : null
          )
        }),
      },
    },
  } as unknown as PrismaService
  const config = { get: (key: string) => (key === "DEMAND_NOTICE_PRINT_SECRET" ? SECRET : undefined) } as ConfigService
  const service = new DemandNoticesService(prisma, {} as StorageService, config)
  return service
}

function wardUser(wardId: string): AuthenticatedUser {
  return {
    id: "u1",
    clerkUserId: "user_1",
    email: "u1@example.com",
    fullName: "U1",
    phone: null,
    isActive: true,
    permissions: ["report:export"],
    tenantRoles: [
      {
        id: "tr1",
        roleId: "r1",
        roleName: "QC_SUPERVISOR",
        permissions: ["report:export"],
        stateId: "st1",
        districtId: "d1",
        ulbId: "ulb1",
        wardId,
        isActive: true,
      },
    ],
  }
}

const exp = () => Date.now() + 60_000

describe("demand-notice print token scope", () => {
  const wards = {
    wardA: { ulbId: "ulb1", districtId: "d1", stateId: "st1" },
    wardB: { ulbId: "ulb2", districtId: "d2", stateId: "st1" },
  }

  it("rejects a ward-only token on the single-survey route", async () => {
    const service = makeService(wards)
    const token = signPrintToken({ wardId: "wardA", exp: exp() }, SECRET)
    await expect(service.getDocumentByPrintToken("any-survey", token)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it("rejects a survey-only token on the ward route", async () => {
    const service = makeService(wards)
    const token = signPrintToken({ surveyId: "s1", exp: exp() }, SECRET)
    await expect(service.listWardDocumentsByPrintToken("wardB", undefined, token)).rejects.toBeInstanceOf(
      UnauthorizedException
    )
  })

  it("rejects an assessment year that differs from the token", async () => {
    const service = makeService(wards)
    const token = signPrintToken({ wardId: "wardA", assessmentYearId: "ay1", exp: exp() }, SECRET)
    await expect(service.listWardDocumentsByPrintToken("wardA", "ay2", token)).rejects.toBeInstanceOf(
      UnauthorizedException
    )
  })

  it("refuses to mint a ward token outside the caller's tenant scope", async () => {
    const service = makeService(wards)
    await expect(service.mintPrintToken({ wardId: "wardB" }, wardUser("wardA"))).rejects.toBeInstanceOf(
      NotFoundException
    )
  })

  it("mints a ward token inside the caller's tenant scope", async () => {
    const service = makeService(wards)
    const result = await service.mintPrintToken({ wardId: "wardA" }, wardUser("wardA"))
    expect(typeof result.token).toBe("string")
  })
})
