import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { NotFoundException } from "@nestjs/common"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { hashUlbApiKey } from "../common/utils/ulb-api-key.util.js"
import { UlbsRepository } from "./ulbs.repository.js"

describe("UlbsRepository API keys", () => {
  const ulbFindFirst = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const apiKeyFindFirst = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const updateMany = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const create = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const transaction = jest.fn<(fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>>(async (fn) =>
    fn({
      ulbApiKey: { updateMany, create },
    })
  )

  const prisma = {
    db: {
      ulb: { findFirst: ulbFindFirst },
      ulbApiKey: { findFirst: apiKeyFindFirst },
      $transaction: transaction,
    },
  }

  const globalUser: AuthenticatedUser = {
    id: "u1",
    clerkUserId: "c1",
    email: "admin@test.com",
    fullName: "Admin",
    phone: null,
    isActive: true,
    permissions: ["settings:manage"],
    tenantRoles: [
      {
        id: "tr1",
        roleId: "r1",
        roleName: "ADMIN",
        permissions: ["settings:manage"],
        stateId: null,
        districtId: null,
        ulbId: null,
        wardId: null,
        isActive: true,
      },
    ],
  }

  let repo: UlbsRepository

  beforeEach(() => {
    jest.clearAllMocks()
    ulbFindFirst.mockResolvedValue({ id: "ulb-1", name: "Etah" })
    repo = new UlbsRepository(prisma as never)
  })

  it("returns null when no active key exists", async () => {
    apiKeyFindFirst.mockResolvedValue(null)
    await expect(repo.getCurrentApiKey("ulb-1", globalUser)).resolves.toBeNull()
  })

  it("never selects rawKey or keyHash for current metadata", async () => {
    apiKeyFindFirst.mockResolvedValue({ keyPrefix: "ulb_live_abcdef", createdAt: new Date(), isActive: true })
    await repo.getCurrentApiKey("ulb-1", globalUser)
    expect(apiKeyFindFirst).toHaveBeenCalledWith({
      where: { ulbId: "ulb-1", isActive: true },
      select: { keyPrefix: true, createdAt: true, isActive: true },
    })
  })

  it("rotates by revoking the active key then inserting a hashed key", async () => {
    const createdAt = new Date("2026-08-14T10:00:00.000Z")
    create.mockImplementation((args: unknown) => {
      const data = (args as { data: { keyHash: string; keyPrefix: string } }).data
      return Promise.resolve({ createdAt, keyHash: data.keyHash, keyPrefix: data.keyPrefix })
    })

    const result = await repo.rotateApiKey("ulb-1", globalUser)
    expect(result.rawKey.startsWith("ulb_live_")).toBe(true)
    expect(result.keyPrefix).toBe(result.rawKey.slice(0, 16))
    expect(result.ulbId).toBe("ulb-1")
    expect(updateMany).toHaveBeenCalledWith({
      where: { ulbId: "ulb-1", isActive: true },
      data: expect.objectContaining({ isActive: false }),
    })
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ulbId: "ulb-1",
        createdById: "u1",
        keyHash: hashUlbApiKey(result.rawKey),
        keyPrefix: result.keyPrefix,
      }),
    })
  })

  it("404s rotate when the ULB is out of tenant scope", async () => {
    ulbFindFirst.mockResolvedValue(null)
    await expect(repo.rotateApiKey("ulb-hidden", globalUser)).rejects.toBeInstanceOf(NotFoundException)
    expect(transaction).not.toHaveBeenCalled()
  })
})
