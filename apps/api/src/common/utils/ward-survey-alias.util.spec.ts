import { describe, expect, it, jest } from "@jest/globals"
import { resolveWardIdAliases } from "./ward-survey-alias.util.js"

describe("resolveWardIdAliases", () => {
  it("does not alias a Ward 1 catalog row into Ward 7 when denormalized wardNumber is 7", async () => {
    const wardFindMany = jest.fn().mockResolvedValue([] as never)
    const surveyFindMany = jest.fn().mockResolvedValue([
      {
        wardId: "ward-1-fk",
        ward: { wardNumber: "1" },
      },
    ] as never)
    const prisma = {
      db: {
        ward: { findMany: wardFindMany },
        survey: { findMany: surveyFindMany },
      },
    }

    const aliases = await resolveWardIdAliases(prisma as never, "ulb-1", [{ id: "ward-7", wardNumber: "7" }])

    expect(aliases.has("ward-1-fk")).toBe(false)
    expect(surveyFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          ward: { select: { wardNumber: true } },
        }),
      })
    )
  })

  it("aliases a leftover ward when the live catalog number matches the active ward", async () => {
    const prisma = {
      db: {
        ward: { findMany: jest.fn().mockResolvedValue([] as never) },
        survey: {
          findMany: jest.fn().mockResolvedValue([
            {
              wardId: "leftover-1",
              ward: { wardNumber: "01" },
            },
          ] as never),
        },
      },
    }

    const aliases = await resolveWardIdAliases(prisma as never, "ulb-1", [{ id: "ward-1", wardNumber: "1" }])

    expect(aliases.get("leftover-1")).toBe("ward-1")
  })
})
