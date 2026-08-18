import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common"
import { PhotoType } from "@workspace/database"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import type { CreatePhotoDto, UpdatePhotoDto } from "../floors/dto/related.dto.js"
import { StorageService } from "../storage/storage.service.js"
import { SurveysService } from "../surveys/surveys.service.js"
import { PhotosRepository } from "./photos.repository.js"

@Injectable()
export class PhotosService {
  private readonly logger = new Logger(PhotosService.name)

  constructor(
    private readonly photosRepository: PhotosRepository,
    private readonly surveysService: SurveysService,
    private readonly storageService: StorageService
  ) {}

  async findAll(query: PaginationQueryDto, user: AuthenticatedUser, surveyId?: string) {
    if (!surveyId) {
      throw new BadRequestException("surveyId query parameter is required")
    }
    await this.surveysService.assertReadableSurvey(surveyId, user)
    return this.photosRepository.findAll(query, surveyId)
  }

  async findById(id: string, user: AuthenticatedUser) {
    const photo = await this.photosRepository.findById(id)
    await this.surveysService.assertReadableSurvey(photo.surveyId, user)
    return photo
  }

  async getDownloadUrl(id: string, user: AuthenticatedUser, expiresInSeconds = 900) {
    const photo = await this.photosRepository.findById(id)
    await this.surveysService.assertReadableSurvey(photo.surveyId, user)
    if (photo.objectKey) {
      const url = await this.storageService.getPresignedDownloadUrl(photo.objectKey, expiresInSeconds)
      return { photoId: photo.id, url, expiresInSeconds }
    }

    const fallback = [photo.sourceUrl, photo.url].find((value) => /^https?:\/\//i.test((value ?? "").trim()))
    if (fallback) {
      return { photoId: photo.id, url: fallback.trim(), expiresInSeconds: 0 }
    }

    throw new BadRequestException("Photo is not stored in private object storage")
  }

  async getFileStream(id: string, user: AuthenticatedUser) {
    const photo = await this.photosRepository.findById(id)
    await this.surveysService.assertReadableSurvey(photo.surveyId, user)
    if (!photo.objectKey) {
      throw new NotFoundException("Photo file is not stored in object storage")
    }

    const file = await this.storageService.getObjectStream(photo.objectKey)
    return {
      stream: file.body,
      contentType: file.contentType ?? photo.mimeType ?? "application/octet-stream",
      contentLength: file.contentLength,
    }
  }

  async create(dto: CreatePhotoDto, user: AuthenticatedUser) {
    await this.surveysService.assertEditableSurvey(dto.surveyId, user)
    return this.photosRepository.create(dto)
  }

  async upload(
    surveyId: string,
    photoType: PhotoType,
    file: Express.Multer.File,
    user: AuthenticatedUser,
    meta?: { width?: number; height?: number; capturedAt?: string }
  ) {
    if (!file) throw new BadRequestException("Image file is required")
    const survey = await this.surveysService.assertEditableSurvey(surveyId, user)

    const uploaded = await this.storageService.uploadImage({
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalName: file.originalname,
      stateId: survey.stateId,
      districtId: survey.districtId,
      ulbId: survey.ulbId,
      wardId: survey.wardId,
      surveyId,
    })

    try {
      const photo = await this.photosRepository.create({
        surveyId,
        photoType,
        url: uploaded.url,
        width: meta?.width,
        height: meta?.height,
        sizeKB: uploaded.sizeKB,
        storageProvider: uploaded.provider,
        bucket: uploaded.bucket,
        objectKey: uploaded.key,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
        checksum: uploaded.checksum,
        etag: uploaded.etag,
        capturedAt: meta?.capturedAt,
      })
      this.logger.log(`Photo uploaded survey=${surveyId} type=${photoType}`)
      return photo
    } catch (err) {
      await this.storageService.deleteObject(uploaded.key)
      throw err
    }
  }

  async update(id: string, dto: UpdatePhotoDto, user: AuthenticatedUser) {
    const photo = await this.photosRepository.findById(id)
    await this.surveysService.assertEditableSurvey(photo.surveyId, user)
    return this.photosRepository.update(id, dto)
  }

  async replace(
    id: string,
    file: Express.Multer.File,
    user: AuthenticatedUser,
    meta?: { photoType?: PhotoType; width?: number; height?: number; capturedAt?: string }
  ) {
    if (!file) throw new BadRequestException("Image file is required")
    const existing = await this.photosRepository.findById(id)
    const survey = await this.surveysService.assertEditableSurvey(existing.surveyId, user)

    const uploaded = await this.storageService.uploadImage({
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalName: file.originalname,
      stateId: survey.stateId,
      districtId: survey.districtId,
      ulbId: survey.ulbId,
      wardId: survey.wardId,
      surveyId: existing.surveyId,
    })

    try {
      const photo = await this.photosRepository.update(id, {
        photoType: meta?.photoType,
        url: uploaded.url,
        width: meta?.width,
        height: meta?.height,
        sizeKB: uploaded.sizeKB,
        storageProvider: uploaded.provider,
        bucket: uploaded.bucket,
        objectKey: uploaded.key,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
        checksum: uploaded.checksum,
        etag: uploaded.etag,
        capturedAt: meta?.capturedAt,
      })
      await this.storageService.deleteObject(existing.objectKey ?? existing.url)
      return photo
    } catch (err) {
      await this.storageService.deleteObject(uploaded.key)
      throw err
    }
  }

  async delete(id: string, user: AuthenticatedUser) {
    const photo = await this.photosRepository.findById(id)
    await this.surveysService.assertEditableSurvey(photo.surveyId, user)
    const deleted = await this.photosRepository.delete(id)
    await this.storageService.deleteObject(photo.objectKey ?? photo.url)
    return deleted
  }
}
