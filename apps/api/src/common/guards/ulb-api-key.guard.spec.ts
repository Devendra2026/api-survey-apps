import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { UnauthorizedException } from "@nestjs/common"
import { GeoEntityStatus } from "@workspace/database"
import { hashUlbApiKey } from "../utils/ulb-api-key.util.js"
import { UlbApiKeyGuard } from "./ulb-api-key.guard.js"

describe("UlbApiKeyGuard", () => {
  const findUnique = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const prisma = { db: { ulbApiKey: { findUnique } } }
  const guard = new UlbApiKeyGuard(prisma as never)

  const makeContext = (headers: Record<string, string | string[] | undefined>) => {
    const request: { headers: Record<string, string | string[] | undefined>; ulbId?: string } = { headers }
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      request,
    }
  }

  beforeEach(() => {
    findUnique.mockReset()
  })

  it("rejects a missing header", async () => {
    await expect(guard.canActivate(makeContext({}) as never)).rejects.toBeInstanceOf(UnauthorizedException)
    await expect(guard.canActivate(makeContext({}) as never)).rejects.toThrow("Invalid API key")
  })

  it("rejects an unknown key", async () => {
    findUnique.mockResolvedValue(null)
    await expect(guard.canActivate(makeContext({ "x-api-key": "ulb_live_nope" }) as never)).rejects.toThrow(
      "Invalid API key"
    )
    expect(findUnique).toHaveBeenCalledWith({
      where: { keyHash: hashUlbApiKey("ulb_live_nope") },
      select: {
        ulbId: true,
        isActive: true,
        ulb: { select: { status: true } },
      },
    })
  })

  it("rejects a revoked key", async () => {
    findUnique.mockResolvedValue({
      ulbId: "ulb-1",
      isActive: false,
      ulb: { status: GeoEntityStatus.ACTIVE },
    })
    await expect(guard.canActivate(makeContext({ "x-api-key": "ulb_live_revoked" }) as never)).rejects.toThrow(
      "Invalid API key"
    )
  })

  it("rejects an inactive ULB", async () => {
    findUnique.mockResolvedValue({
      ulbId: "ulb-1",
      isActive: true,
      ulb: { status: GeoEntityStatus.DISABLED },
    })
    await expect(guard.canActivate(makeContext({ "x-api-key": "ulb_live_ok" }) as never)).rejects.toThrow(
      "Invalid API key"
    )
  })

  it("sets ulbId for an active key on an active ULB", async () => {
    findUnique.mockResolvedValue({
      ulbId: "ulb-1",
      isActive: true,
      ulb: { status: GeoEntityStatus.ACTIVE },
    })
    const ctx = makeContext({ "x-api-key": "  ulb_live_ok  " })
    await expect(guard.canActivate(ctx as never)).resolves.toBe(true)
    expect(ctx.request.ulbId).toBe("ulb-1")
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { keyHash: hashUlbApiKey("ulb_live_ok") } })
    )
  })
})
