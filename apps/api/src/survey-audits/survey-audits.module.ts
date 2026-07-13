import { Module } from "@nestjs/common"
import { SurveysModule } from "../surveys/surveys.module.js"
import { SurveyAuditsController } from "./survey-audits.controller.js"
import { SurveyAuditsRepository } from "./survey-audits.repository.js"
import { SurveyAuditsService } from "./survey-audits.service.js"

@Module({
  imports: [SurveysModule],
  controllers: [SurveyAuditsController],
  providers: [SurveyAuditsService, SurveyAuditsRepository],
  exports: [SurveyAuditsService],
})
export class SurveyAuditsModule {}
