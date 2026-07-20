import { Module } from "@nestjs/common"
import { ConfigAuditModule } from "../config-audit/config-audit.module.js"
import { StatesController } from "./states.controller.js"
import { StatesRepository } from "./states.repository.js"
import { StatesService } from "./states.service.js"

@Module({
  imports: [ConfigAuditModule],
  controllers: [StatesController],
  providers: [StatesService, StatesRepository],
  exports: [StatesService],
})
export class StatesModule {}
