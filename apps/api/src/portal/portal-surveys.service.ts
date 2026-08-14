import { Injectable } from "@nestjs/common"
import type { PortalSurveyQueryDto } from "./dto/portal-survey-query.dto.js"
import { PortalSurveysRepository } from "./portal-surveys.repository.js"

@Injectable()
export class PortalSurveysService {
  constructor(private readonly portalSurveysRepository: PortalSurveysRepository) {}

  findAll(ulbId: string, query: PortalSurveyQueryDto) {
    return this.portalSurveysRepository.findAll(ulbId, query)
  }
}
