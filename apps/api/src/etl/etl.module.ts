import { Module } from "@nestjs/common"
import { JobsModule } from "../jobs/jobs.module.js"
import { PrismaModule } from "../prisma/prisma.module.js"
import { EtlController } from "./etl.controller.js"
import { EtlService } from "./etl.service.js"
import { ReconcileService } from "./reconcile.service.js"
import { WardAlignService } from "./ward-align.service.js"

@Module({
  imports: [PrismaModule, JobsModule],
  controllers: [EtlController],
  providers: [EtlService, WardAlignService, ReconcileService],
  exports: [EtlService, WardAlignService, ReconcileService],
})
export class EtlModule {}
