import { Module } from "@nestjs/common"
import { DemandNoticesController } from "./demand-notices.controller.js"
import { DemandNoticesService } from "./demand-notices.service.js"

@Module({
  controllers: [DemandNoticesController],
  providers: [DemandNoticesService],
  exports: [DemandNoticesService],
})
export class DemandNoticesModule {}
