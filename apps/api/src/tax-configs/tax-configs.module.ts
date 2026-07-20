import { Module } from "@nestjs/common"
import { ConfigAuditModule } from "../config-audit/config-audit.module.js"
import { TaxConfigsController } from "./tax-configs.controller.js"
import { TaxConfigsService } from "./tax-configs.service.js"

@Module({
  imports: [ConfigAuditModule],
  controllers: [TaxConfigsController],
  providers: [TaxConfigsService],
  exports: [TaxConfigsService],
})
export class TaxConfigsModule {}
