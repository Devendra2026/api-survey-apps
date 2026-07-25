import { Module } from "@nestjs/common"
import { JobsModule } from "../jobs/jobs.module.js"
import { PrismaModule } from "../prisma/prisma.module.js"
import { EtlController } from "./etl.controller.js"
import { EtlService } from "./etl.service.js"

@Module({
  imports: [PrismaModule, JobsModule],
  controllers: [EtlController],
  providers: [EtlService],
  exports: [EtlService],
})
export class EtlModule {}
