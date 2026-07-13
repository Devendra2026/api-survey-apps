import { Module } from "@nestjs/common"
import { PermissionsController } from "./permissions.controller.js"
import { PermissionsRepository } from "./permissions.repository.js"
import { PermissionsService } from "./permissions.service.js"

@Module({
  controllers: [PermissionsController],
  providers: [PermissionsService, PermissionsRepository],
  exports: [PermissionsService],
})
export class PermissionsModule {}
