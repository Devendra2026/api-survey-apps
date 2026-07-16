import { Module } from "@nestjs/common"
import { SurveysModule } from "../surveys/surveys.module.js"
import { QcSurveyController } from "./qc-survey.controller.js"
import { QcController } from "./qc.controller.js"
import { QcRepository } from "./qc.repository.js"
import { QcService } from "./qc.service.js"
import { QcRegistryController } from "./registry.controller.js"

@Module({
  imports: [SurveysModule],
  controllers: [QcController, QcRegistryController, QcSurveyController],
  providers: [QcService, QcRepository],
})
export class QcModule {}
