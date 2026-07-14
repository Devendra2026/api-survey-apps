import { Module } from "@nestjs/common"
import { CommandCenterController } from "./command-center.controller.js"
import { CommandCenterRepository } from "./command-center.repository.js"
import { CommandCenterService } from "./command-center.service.js"

@Module({
  controllers: [CommandCenterController],
  providers: [CommandCenterService, CommandCenterRepository],
})
export class CommandCenterModule {}
