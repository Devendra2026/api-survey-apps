import { BadRequestException, Injectable } from "@nestjs/common"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import type { CreateCoOwnerDto, UpdateCoOwnerDto } from "../floors/dto/related.dto.js"
import { SurveysService } from "../surveys/surveys.service.js"
import { CoOwnersRepository } from "./co-owners.repository.js"

@Injectable()
export class CoOwnersService {
  constructor(
    private readonly coOwnersRepository: CoOwnersRepository,
    private readonly surveysService: SurveysService
  ) {}

  async findAll(query: PaginationQueryDto, user: AuthenticatedUser, surveyId?: string) {
    if (!surveyId) {
      throw new BadRequestException("surveyId query parameter is required")
    }
    await this.surveysService.assertReadableSurvey(surveyId, user)
    return this.coOwnersRepository.findAll(query, surveyId)
  }

  async findById(id: string, user: AuthenticatedUser) {
    const item = await this.coOwnersRepository.findById(id)
    await this.surveysService.assertReadableSurvey(item.surveyId, user)
    return item
  }

  async create(dto: CreateCoOwnerDto, user: AuthenticatedUser) {
    await this.surveysService.assertEditableSurvey(dto.surveyId, user)
    return this.coOwnersRepository.create(dto)
  }

  async update(id: string, dto: UpdateCoOwnerDto, user: AuthenticatedUser) {
    const item = await this.coOwnersRepository.findById(id)
    await this.surveysService.assertEditableSurvey(item.surveyId, user)
    return this.coOwnersRepository.update(id, dto)
  }

  async delete(id: string, user: AuthenticatedUser) {
    const item = await this.coOwnersRepository.findById(id)
    await this.surveysService.assertEditableSurvey(item.surveyId, user)
    return this.coOwnersRepository.delete(id)
  }
}
