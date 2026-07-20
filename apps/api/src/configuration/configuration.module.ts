import { Module } from "@nestjs/common"
import { ConfigurationGeographyController } from "./configuration-geography.controller.js"
import { ConfigurationGeographyService } from "./configuration-geography.service.js"

@Module({
  controllers: [ConfigurationGeographyController],
  providers: [ConfigurationGeographyService],
  exports: [ConfigurationGeographyService],
})
export class ConfigurationModule {}
