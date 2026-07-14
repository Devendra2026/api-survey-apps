import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import { PhotoType } from "@workspace/database"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import { buildOrderBy, getSkipTake, toPaginatedResult } from "../common/utils/pagination.util.js"
import type { CreatePhotoDto, UpdatePhotoDto } from "../floors/dto/related.dto.js"
import { PrismaService } from "../prisma/prisma.service.js"

@Injectable()
export class PhotosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationQueryDto, surveyId?: string) {
    const { skip, take, page, limit } = getSkipTake(query)
    const where = surveyId ? { surveyId } : {}
    const [items, total] = await Promise.all([
      this.prisma.db.photo.findMany({
        where,
        skip,
        take,
        orderBy: buildOrderBy(query.sortBy, query.sortOrder, ["createdAt", "photoType"]),
      }),
      this.prisma.db.photo.count({ where }),
    ])
    return toPaginatedResult(items, total, page, limit)
  }

  async findById(id: string) {
    const photo = await this.prisma.db.photo.findUnique({ where: { id } })
    if (!photo) throw new NotFoundException("Photo not found")
    return photo
  }

  async create(data: CreatePhotoDto) {
    if (data.photoType === PhotoType.FRONT) {
      const existingFront = await this.prisma.db.photo.findFirst({
        where: { surveyId: data.surveyId, photoType: PhotoType.FRONT },
      })
      if (existingFront) {
        throw new BadRequestException("A FRONT photo already exists for this survey")
      }
    }

    if (data.width != null && data.width <= 0) {
      throw new BadRequestException("Invalid image width")
    }
    if (data.height != null && data.height <= 0) {
      throw new BadRequestException("Invalid image height")
    }

    return this.prisma.db.photo.create({
      data: {
        surveyId: data.surveyId,
        photoType: data.photoType,
        url: data.url,
        width: data.width,
        height: data.height,
        sizeKB: data.sizeKB,
        storageProvider: data.storageProvider,
        bucket: data.bucket,
        objectKey: data.objectKey,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
        checksum: data.checksum,
        etag: data.etag,
        capturedAt: data.capturedAt ? new Date(data.capturedAt) : undefined,
      },
    })
  }

  async update(id: string, data: UpdatePhotoDto) {
    const existing = await this.findById(id)
    if (data.photoType === PhotoType.FRONT && existing.photoType !== PhotoType.FRONT) {
      const front = await this.prisma.db.photo.findFirst({
        where: { surveyId: existing.surveyId, photoType: PhotoType.FRONT, NOT: { id } },
      })
      if (front) {
        throw new BadRequestException("A FRONT photo already exists for this survey")
      }
    }

    return this.prisma.db.photo.update({
      where: { id },
      data: {
        photoType: data.photoType,
        url: data.url,
        width: data.width,
        height: data.height,
        sizeKB: data.sizeKB,
        storageProvider: data.storageProvider,
        bucket: data.bucket,
        objectKey: data.objectKey,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
        checksum: data.checksum,
        etag: data.etag,
        capturedAt: data.capturedAt ? new Date(data.capturedAt) : undefined,
      },
    })
  }

  async delete(id: string) {
    await this.findById(id)
    return this.prisma.db.photo.delete({ where: { id } })
  }
}
