import { Module } from "@nestjs/common"
import { DistrictsController } from "./districts.controller.js"
import { DistrictsRepository } from "./districts.repository.js"
import { DistrictsService } from "./districts.service.js"

@Module({
  controllers: [DistrictsController],
  providers: [DistrictsService, DistrictsRepository],
  exports: [DistrictsService],
})
export class DistrictsModule {}
