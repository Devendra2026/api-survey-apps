import { Module } from "@nestjs/common"
import { ConfigAuditModule } from "../config-audit/config-audit.module.js"
import { ReferenceCatalogsController } from "./reference-catalogs.controller.js"
import { ReferenceCatalogsService } from "./reference-catalogs.service.js"

@Module({
  imports: [ConfigAuditModule],
  controllers: [ReferenceCatalogsController],
  providers: [ReferenceCatalogsService],
  exports: [ReferenceCatalogsService],
})
export class ReferenceCatalogsModule {}
