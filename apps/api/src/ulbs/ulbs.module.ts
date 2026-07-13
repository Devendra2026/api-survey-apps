import { Module } from "@nestjs/common"
import { UlbsController } from "./ulbs.controller.js"
import { UlbsRepository } from "./ulbs.repository.js"
import { UlbsService } from "./ulbs.service.js"

@Module({
  controllers: [UlbsController],
  providers: [UlbsService, UlbsRepository],
  exports: [UlbsService],
})
export class UlbsModule {}
