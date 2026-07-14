import { Module } from "@nestjs/common"
import { ImportsModule } from "../imports/imports.module.js"
import { SurveyRegistryController } from "./survey-registry.controller.js"
import { SurveyRegistryRepository } from "./survey-registry.repository.js"
import { SurveyRegistryService } from "./survey-registry.service.js"

@Module({
  imports: [ImportsModule],
  controllers: [SurveyRegistryController],
  providers: [SurveyRegistryService, SurveyRegistryRepository],
})
export class SurveyRegistryModule {}
