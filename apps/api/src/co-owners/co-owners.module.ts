import { Module } from "@nestjs/common"
import { SurveysModule } from "../surveys/surveys.module.js"
import { CoOwnersController } from "./co-owners.controller.js"
import { CoOwnersRepository } from "./co-owners.repository.js"
import { CoOwnersService } from "./co-owners.service.js"

@Module({
  imports: [SurveysModule],
  controllers: [CoOwnersController],
  providers: [CoOwnersService, CoOwnersRepository],
  exports: [CoOwnersService],
})
export class CoOwnersModule {}
