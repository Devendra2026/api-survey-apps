import { Module } from "@nestjs/common"
import { ConfigAuditController } from "./config-audit.controller.js"
import { ConfigAuditService } from "./config-audit.service.js"

@Module({
  controllers: [ConfigAuditController],
  providers: [ConfigAuditService],
  exports: [ConfigAuditService],
})
export class ConfigAuditModule {}
