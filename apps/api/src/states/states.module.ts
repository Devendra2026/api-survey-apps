import { Module } from "@nestjs/common"
import { StatesController } from "./states.controller.js"
import { StatesRepository } from "./states.repository.js"
import { StatesService } from "./states.service.js"

@Module({
  controllers: [StatesController],
  providers: [StatesService, StatesRepository],
  exports: [StatesService],
})
export class StatesModule {}
