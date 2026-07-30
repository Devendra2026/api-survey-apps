import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { ConflictException, NotFoundException } from "@nestjs/common"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { WardsRepository } from "./wards.repository.js"

describe("WardsRepository soft delete and duplicate names", () => {
  const findFirst = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const findMany = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const count = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const create = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const update = jest.fn<(...args: unknown[]) => Promise<unknown>>()

  const prisma = {
    db: {
      ward: {
        findFirst,
        findMany,
        count,
        create,
        update,
      },
    },
  }

  let repo: WardsRepository

  const admin: AuthenticatedUser = {
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

  beforeEach(() => {
    findFirst.mockReset()
    findMany.mockReset()
    count.mockReset()
    create.mockReset()
    update.mockReset()
    repo = new WardsRepository(prisma as never)
  })

  it("soft-deletes by setting deletedAt", async () => {
    findFirst.mockResolvedValueOnce({ id: "ward1", ulbId: "ulb1", wardName: "Abhimanyu", deletedAt: null })
    update.mockResolvedValueOnce({ id: "ward1", deletedAt: new Date("2026-07-30T00:00:00.000Z") })

    const result = await repo.delete("ward1", admin)

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "ward1", deletedAt: null }),
      })
    )
    expect(update).toHaveBeenCalledWith({
      where: { id: "ward1" },
      data: { deletedAt: expect.any(Date) },
    })
    expect(result.deletedAt).toBeTruthy()
  })

  it("rejects create when an active ward with the same name exists (case-insensitive)", async () => {
    findFirst.mockResolvedValueOnce({ id: "existing" })

    await expect(repo.create({ ulbId: "ulb1", wardNumber: "10", wardName: "abhimanyu" })).rejects.toBeInstanceOf(
      ConflictException
    )

    expect(create).not.toHaveBeenCalled()
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ulbId: "ulb1",
          deletedAt: null,
          wardName: { equals: "abhimanyu", mode: "insensitive" },
        }),
      })
    )
  })

  it("allows create when only a soft-deleted ward has the same name", async () => {
    findFirst.mockResolvedValueOnce(null)
    create.mockResolvedValueOnce({ id: "ward-new", ulbId: "ulb1", wardNumber: "10", wardName: "Abhimanyu" })

    await expect(repo.create({ ulbId: "ulb1", wardNumber: "10", wardName: "Abhimanyu" })).resolves.toEqual(
      expect.objectContaining({ id: "ward-new" })
    )

    expect(create).toHaveBeenCalled()
  })

  it("rejects rename to another active ward name", async () => {
    findFirst
      .mockResolvedValueOnce({ id: "ward1", ulbId: "ulb1", wardName: "Old", deletedAt: null })
      .mockResolvedValueOnce({ id: "ward2" })

    await expect(repo.update("ward1", { wardName: "Abhimanyu" }, admin)).rejects.toBeInstanceOf(ConflictException)
    expect(update).not.toHaveBeenCalled()
  })

  it("throws NotFound when deleting an already soft-deleted ward", async () => {
    findFirst.mockResolvedValueOnce(null)
    await expect(repo.delete("ward1", admin)).rejects.toBeInstanceOf(NotFoundException)
    expect(update).not.toHaveBeenCalled()
  })
})
