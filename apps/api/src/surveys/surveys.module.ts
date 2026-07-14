import { Module } from "@nestjs/common"
import { JobsModule } from "../jobs/jobs.module.js"
import { SurveysController } from "./surveys.controller.js"
import { SurveysRepository } from "./surveys.repository.js"
import { SurveysService } from "./surveys.service.js"

@Module({
  imports: [JobsModule],
  controllers: [SurveysController],
  providers: [SurveysService, SurveysRepository],
  exports: [SurveysService, SurveysRepository],
})
export class SurveysModule {}
