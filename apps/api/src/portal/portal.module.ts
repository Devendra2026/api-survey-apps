import { Module } from "@nestjs/common"
import { UlbApiKeyGuard } from "../common/guards/ulb-api-key.guard.js"
import { PortalSurveysController } from "./portal-surveys.controller.js"
import { PortalSurveysRepository } from "./portal-surveys.repository.js"
import { PortalSurveysService } from "./portal-surveys.service.js"

@Module({
  controllers: [PortalSurveysController],
  providers: [PortalSurveysService, PortalSurveysRepository, UlbApiKeyGuard],
})
export class PortalModule {}
