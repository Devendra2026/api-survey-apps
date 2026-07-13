import { BadRequestException, Injectable } from "@nestjs/common"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { SurveysService } from "../surveys/surveys.service.js"
import { SurveyAuditsRepository } from "./survey-audits.repository.js"

@Injectable()
export class SurveyAuditsService {
  constructor(
    private readonly surveyAuditsRepository: SurveyAuditsRepository,
    private readonly surveysService: SurveysService
  ) {}

  async findAll(query: PaginationQueryDto, user: AuthenticatedUser, surveyId?: string) {
    if (!surveyId) {
      throw new BadRequestException("surveyId query parameter is required")
    }
    await this.surveysService.assertReadableSurvey(surveyId, user)
    return this.surveyAuditsRepository.findAll(query, surveyId)
  }

  async findBySurvey(surveyId: string, user: AuthenticatedUser) {
    await this.surveysService.assertReadableSurvey(surveyId, user)
    return this.surveyAuditsRepository.findBySurvey(surveyId)
  }
}
