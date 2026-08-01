import { BadRequestException, Injectable } from "@nestjs/common"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { SurveysService } from "../surveys/surveys.service.js"
import type { CreateFloorDto, UpdateFloorDto } from "./dto/related.dto.js"
import { FloorsRepository } from "./floors.repository.js"

@Injectable()
export class FloorsService {
  constructor(
    private readonly floorsRepository: FloorsRepository,
    private readonly surveysService: SurveysService
  ) {}

  async findAll(query: PaginationQueryDto, user: AuthenticatedUser, surveyId?: string) {
    if (!surveyId) {
      throw new BadRequestException("surveyId query parameter is required")
    }
    await this.surveysService.assertReadableSurvey(surveyId, user)
    return this.floorsRepository.findAll(query, surveyId)
  }

  async findById(id: string, user: AuthenticatedUser) {
    const floor = await this.floorsRepository.findById(id)
    await this.surveysService.assertReadableSurvey(floor.surveyId, user)
    return floor
  }

  async create(dto: CreateFloorDto, user: AuthenticatedUser) {
    await this.surveysService.assertEditableSurvey(dto.surveyId, user)
    const result = await this.floorsRepository.create(dto)
    const warnings = await this.floorsRepository.getUsageWarnings(dto.surveyId)
    return { ...result, warnings }
  }

  async update(id: string, dto: UpdateFloorDto, user: AuthenticatedUser) {
    const floor = await this.floorsRepository.findById(id)
    await this.surveysService.assertEditableSurvey(floor.surveyId, user)
    const result = await this.floorsRepository.update(id, dto)
    const warnings = await this.floorsRepository.getUsageWarnings(floor.surveyId)
    return { ...result, warnings }
  }

  async delete(id: string, user: AuthenticatedUser) {
    const floor = await this.floorsRepository.findById(id)
    await this.surveysService.assertEditableSurvey(floor.surveyId, user)
    const result = await this.floorsRepository.delete(id)
    const warnings = await this.floorsRepository.getUsageWarnings(floor.surveyId)
    return { ...result, warnings }
  }
}
