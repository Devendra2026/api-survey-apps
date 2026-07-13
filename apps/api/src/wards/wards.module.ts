import { Module } from "@nestjs/common"
import { WardsController } from "./wards.controller.js"
import { WardsRepository } from "./wards.repository.js"
import { WardsService } from "./wards.service.js"

@Module({
  controllers: [WardsController],
  providers: [WardsService, WardsRepository],
  exports: [WardsService],
})
export class WardsModule {}
