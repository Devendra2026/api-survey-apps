import { Module } from "@nestjs/common"
import { SurveysController } from "./surveys.controller.js"
import { SurveysRepository } from "./surveys.repository.js"
import { SurveysService } from "./surveys.service.js"

@Module({
  controllers: [SurveysController],
  providers: [SurveysService, SurveysRepository],
  exports: [SurveysService, SurveysRepository],
})
export class SurveysModule {}
