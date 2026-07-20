import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import type { Prisma } from "@workspace/database"
import { ConfigAuditService } from "../config-audit/config-audit.service.js"
import { PrismaService } from "../prisma/prisma.service.js"
import type {
  BulkStatusDto,
  CloneReferenceEntryDto,
  CreateReferenceEntryDto,
  UpdateReferenceEntryDto,
} from "./dto/reference-catalog.dto.js"

@Injectable()
export class ReferenceCatalogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: ConfigAuditService
  ) {}

  listCategories() {
    return this.prisma.db.referenceCategory.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { entries: true } },
        entries: {
          where: { status: "ACTIVE" },
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: { updatedAt: true, updatedBy: true },
        },
      },
    })
  }

  async listEntries(categoryCode: string, query: { search?: string; status?: string; page?: number; limit?: number }) {
    const category = await this.prisma.db.referenceCategory.findUnique({
      where: { code: categoryCode },
    })
    if (!category) throw new NotFoundException("Category not found")

    const page = query.page ?? 1
    const limit = Math.min(query.limit ?? 50, 200)
    const skip = (page - 1) * limit

    const where: Prisma.ReferenceEntryWhereInput = {
      categoryId: category.id,
      ...(query.status ? { status: query.status as "ACTIVE" | "DISABLED" | "ARCHIVED" } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { code: { contains: query.search, mode: "insensitive" } },
              { description: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    }

    const [items, total] = await Promise.all([
      this.prisma.db.referenceEntry.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        skip,
        take: limit,
      }),
      this.prisma.db.referenceEntry.count({ where }),
    ])

    return {
      category,
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }
  }

  async createEntry(dto: CreateReferenceEntryDto, actorId?: string) {
    const category = await this.prisma.db.referenceCategory.findUnique({
      where: { code: dto.categoryCode },
    })
    if (!category) throw new NotFoundException("Category not found")

    const entry = await this.prisma.db.referenceEntry.create({
      data: {
        categoryId: category.id,
        code: dto.code.toUpperCase().replace(/\s+/g, "_"),
        name: dto.name,
        description: dto.description,
        value: dto.value,
        sortOrder: dto.sortOrder ?? 0,
        createdBy: actorId,
        updatedBy: actorId,
      },
    })

    await this.audit.log({
      entityType: "ReferenceEntry",
      entityId: entry.id,
      action: "CREATE",
      newValue: entry,
      actorId,
    })

    return entry
  }

  async updateEntry(id: string, dto: UpdateReferenceEntryDto, actorId?: string) {
    const existing = await this.prisma.db.referenceEntry.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException("Entry not found")

    const entry = await this.prisma.db.referenceEntry.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        value: dto.value,
        status: dto.status,
        sortOrder: dto.sortOrder,
        version: { increment: 1 },
        updatedBy: actorId,
      },
    })

    await this.audit.log({
      entityType: "ReferenceEntry",
      entityId: entry.id,
      action: "UPDATE",
      oldValue: existing,
      newValue: entry,
      reason: dto.reason,
      actorId,
    })

    return entry
  }

  async cloneEntry(id: string, dto: CloneReferenceEntryDto, actorId?: string) {
    const existing = await this.prisma.db.referenceEntry.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException("Entry not found")

    const code = (dto.code ?? `${existing.code}_COPY`).toUpperCase().replace(/\s+/g, "_")
    const entry = await this.prisma.db.referenceEntry.create({
      data: {
        categoryId: existing.categoryId,
        code,
        name: dto.name ?? `${existing.name} (Copy)`,
        description: existing.description,
        value: existing.value,
        sortOrder: existing.sortOrder + 1,
        createdBy: actorId,
        updatedBy: actorId,
      },
    })

    await this.audit.log({
      entityType: "ReferenceEntry",
      entityId: entry.id,
      action: "CLONE",
      oldValue: { sourceId: existing.id },
      newValue: entry,
      actorId,
    })

    return entry
  }

  async bulkStatus(dto: BulkStatusDto, actorId?: string) {
    if (!dto.ids.length) throw new BadRequestException("No entry ids provided")

    const result = await this.prisma.db.referenceEntry.updateMany({
      where: { id: { in: dto.ids } },
      data: {
        status: dto.status,
        updatedBy: actorId,
      },
    })

    for (const id of dto.ids) {
      await this.audit.log({
        entityType: "ReferenceEntry",
        entityId: id,
        action: "BULK_STATUS",
        newValue: { status: dto.status },
        reason: dto.reason,
        actorId,
      })
    }

    return { updated: result.count }
  }
}
