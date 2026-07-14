import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import type { Prisma } from "@workspace/database"
import { PrismaService } from "../prisma/prisma.service.js"
import type { CreateSavedViewDto, UpdateSavedViewDto } from "./dto/saved-view.dto.js"

@Injectable()
export class SavedViewsRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string, entity: string) {
    return this.prisma.db.savedView.findMany({
      where: { userId, entity },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    })
  }

  async findOwned(id: string, userId: string) {
    const view = await this.prisma.db.savedView.findFirst({
      where: { id, userId },
    })
    if (!view) throw new NotFoundException("Saved view not found")
    return view
  }

  async create(userId: string, dto: CreateSavedViewDto) {
    const entity = dto.entity ?? "surveys"
    try {
      return await this.prisma.db.$transaction(async (tx) => {
        if (dto.isDefault) {
          await tx.savedView.updateMany({
            where: { userId, entity, isDefault: true },
            data: { isDefault: false },
          })
        }
        return tx.savedView.create({
          data: {
            userId,
            name: dto.name,
            entity,
            filters: dto.filters as Prisma.InputJsonValue,
            ...(dto.columns !== undefined ? { columns: dto.columns as Prisma.InputJsonValue } : {}),
            sortBy: dto.sortBy,
            sortOrder: dto.sortOrder,
            isDefault: dto.isDefault ?? false,
          },
        })
      })
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002") {
        throw new BadRequestException("A saved view with this name already exists")
      }
      throw error
    }
  }

  async update(id: string, userId: string, dto: UpdateSavedViewDto) {
    const existing = await this.findOwned(id, userId)
    return this.prisma.db.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.savedView.updateMany({
          where: { userId, entity: existing.entity, isDefault: true, NOT: { id } },
          data: { isDefault: false },
        })
      }
      return tx.savedView.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.filters !== undefined ? { filters: dto.filters as Prisma.InputJsonValue } : {}),
          ...(dto.columns !== undefined ? { columns: dto.columns as Prisma.InputJsonValue } : {}),
          ...(dto.sortBy !== undefined ? { sortBy: dto.sortBy } : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
        },
      })
    })
  }

  async remove(id: string, userId: string) {
    await this.findOwned(id, userId)
    await this.prisma.db.savedView.delete({ where: { id } })
    return { id, deleted: true }
  }
}
