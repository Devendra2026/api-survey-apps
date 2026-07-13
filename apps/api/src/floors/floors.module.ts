import { Module } from "@nestjs/common"
import { SurveysModule } from "../surveys/surveys.module.js"
import { FloorsController } from "./floors.controller.js"
import { FloorsRepository } from "./floors.repository.js"
import { FloorsService } from "./floors.service.js"

@Module({
  imports: [SurveysModule],
  controllers: [FloorsController],
  providers: [FloorsService, FloorsRepository],
  exports: [FloorsService],
})
export class FloorsModule {}
